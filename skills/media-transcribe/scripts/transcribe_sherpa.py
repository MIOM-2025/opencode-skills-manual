#!/usr/bin/env python3
"""Offline audio transcription with sherpa-onnx Paraformer.

Converts any ffmpeg-readable file to 16 kHz mono WAV, splits it into
fixed-size chunks, transcribes each chunk, and writes JSON + timestamped text.
It never plays audio.
"""
import argparse
import array
import json
import os
import subprocess
import sys
import time
import wave

import sherpa_onnx


def to_wav(src: str, dst: str, sample_rate: int = 16000) -> str:
    if src.lower().endswith(".wav"):
        return src
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", src, "-vn", "-ac", "1", "-ar", str(sample_rate),
            "-c:a", "pcm_s16le", dst,
        ],
        check=True,
    )
    return dst


def fmt_time(seconds: float) -> str:
    seconds = max(0, int(seconds))
    return f"{seconds // 60:02d}:{seconds % 60:02d}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--output", "-o", default="transcript")
    ap.add_argument("--model-dir", required=True)
    ap.add_argument("--chunk", type=float, default=30.0)
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--wav", default=None, help="temporary 16k mono wav path")
    args = ap.parse_args()

    model = os.path.join(args.model_dir, "model.int8.onnx")
    tokens = os.path.join(args.model_dir, "tokens.txt")
    if not (os.path.isfile(model) and os.path.isfile(tokens)):
        print(f"missing model files in {args.model_dir}", file=sys.stderr)
        return 2

    wav_path = args.wav or os.path.splitext(args.output)[0] + ".16k.wav"
    wav_path = to_wav(args.input, wav_path)
    t0 = time.time()
    recognizer = sherpa_onnx.OfflineRecognizer.from_paraformer(
        paraformer=model,
        tokens=tokens,
        num_threads=args.threads,
        sample_rate=16000,
        feature_dim=80,
        decoding_method="greedy_search",
        debug=False,
    )
    load_s = time.time() - t0

    segments = []
    with wave.open(wav_path, "rb") as wf:
        sr = wf.getframerate()
        channels = wf.getnchannels()
        total_frames = wf.getnframes()
        chunk_frames = max(1, int(args.chunk * sr))
        if sr != 16000 or channels != 1:
            print(f"expected 16k mono wav, got {sr} Hz / {channels} ch", file=sys.stderr)
            return 3
        start = 0.0
        while True:
            raw = wf.readframes(chunk_frames)
            if not raw:
                break
            samples = array.array("h")
            samples.frombytes(raw)
            if sys.byteorder != "little":
                samples.byteswap()
            x = [s / 32768.0 for s in samples]
            stream = recognizer.create_stream()
            stream.accept_waveform(sr, x)
            recognizer.decode_stream(stream)
            text = (stream.result.text or "").strip()
            end = start + len(samples) / sr
            if text:
                segments.append({"start": round(start, 2), "end": round(end, 2), "text": text})
            start = end

    total_s = total_frames / 16000.0
    elapsed = time.time() - t0
    payload = {
        "input": os.path.abspath(args.input),
        "audio": os.path.abspath(wav_path),
        "model": os.path.abspath(model),
        "duration": round(total_s, 2),
        "load_seconds": round(load_s, 2),
        "elapsed_seconds": round(elapsed, 2),
        "segments": segments,
    }
    with open(args.output + ".json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    with open(args.output + ".txt", "w", encoding="utf-8") as f:
        for seg in segments:
            f.write(f"[{fmt_time(seg['start'])}-{fmt_time(seg['end'])}] {seg['text']}\n")
    print(json.dumps({
        "duration": round(total_s, 2),
        "segments": len(segments),
        "load_seconds": round(load_s, 2),
        "elapsed_seconds": round(elapsed, 2),
        "json": os.path.abspath(args.output + ".json"),
        "txt": os.path.abspath(args.output + ".txt"),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
