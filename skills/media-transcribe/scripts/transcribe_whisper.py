#!/usr/bin/env python3
"""Offline audio transcription with sherpa-onnx Whisper (multilingual / English).

Same contract as transcribe_sherpa.py (Paraformer, Chinese only), but uses a
Whisper model so English and mixed-language audio come out readable instead of
being force-decoded as Chinese. Never plays audio, never uploads anything.

Model dir must contain a sherpa-onnx Whisper export:
  *-encoder*.onnx, *-decoder*.onnx (int8 variants preferred), *tokens.txt
"""
import argparse
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


def pick(model_dir: str, kind: str) -> str:
    names = sorted(os.listdir(model_dir))
    cands = [n for n in names if kind in n and n.endswith(".onnx")]
    if not cands:
        raise SystemExit(f"no {kind} onnx in {model_dir}")
    int8 = [n for n in cands if "int8" in n]
    return os.path.join(model_dir, (int8 or cands)[0])


def read_wav(path: str, sample_rate: int):
    with wave.open(path, "rb") as f:
        assert f.getframerate() == sample_rate, f.getframerate()
        frames = f.readframes(f.getnframes())
    import array as _array
    samples = _array.array("h")
    samples.frombytes(frames)
    if sys.byteorder == "big":
        samples.byteswap()
    return [s / 32768.0 for s in samples]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("--output", "-o", default="transcript")
    ap.add_argument("--model-dir", required=True)
    ap.add_argument("--language", default="en", help="en / zh / auto")
    ap.add_argument("--chunk", type=float, default=30.0)
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--wav", default=None, help="temporary 16k mono wav path")
    args = ap.parse_args()

    model_dir = args.model_dir
    encoder = pick(model_dir, "encoder")
    decoder = pick(model_dir, "decoder")
    tokens = next((os.path.join(model_dir, n) for n in os.listdir(model_dir) if n.endswith("tokens.txt")), None)
    if not tokens:
        raise SystemExit(f"no tokens.txt in {model_dir}")

    sample_rate = 16000
    wav_path = args.wav or os.path.splitext(args.output)[0] + ".16k.wav"
    wav_path = to_wav(args.input, wav_path)
    t0 = time.time()

    language = "" if args.language in ("auto", "detect") else args.language
    recognizer = sherpa_onnx.OfflineRecognizer.from_whisper(
        encoder=encoder,
        decoder=decoder,
        tokens=tokens,
        language=language,
        task="transcribe",
        num_threads=args.threads,
        decoding_method="greedy_search",
        debug=False,
    )
    samples = read_wav(wav_path, sample_rate)
    total = len(samples) / sample_rate
    step = int(args.chunk * sample_rate)

    segments = []
    pos = 0
    while pos < len(samples):
        piece = samples[pos:pos + step]
        stream = recognizer.create_stream()
        stream.accept_waveform(sample_rate, piece)
        recognizer.decode_stream(stream)
        text = (stream.result.text or "").strip()
        if text:
            segments.append({
                "from": round(pos / sample_rate, 2),
                "to": round(min(pos + len(piece), len(samples)) / sample_rate, 2),
                "text": text,
            })
        pos += step

    elapsed = time.time() - t0
    payload = {
        "input": args.input,
        "duration": round(total, 2),
        "language": args.language,
        "engine": "sherpa-onnx-whisper",
        "model_dir": model_dir,
        "elapsed_seconds": round(elapsed, 2),
        "segments": segments,
    }
    with open(args.output + ".json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    with open(args.output + ".txt", "w", encoding="utf-8") as f:
        for s in segments:
            f.write(f"[{fmt_time(s['from'])}-{fmt_time(s['to'])}] {s['text']}\n")

    print(json.dumps({
        "duration": payload["duration"],
        "segments": len(segments),
        "elapsed_seconds": payload["elapsed_seconds"],
        "json": args.output + ".json",
        "txt": args.output + ".txt",
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
