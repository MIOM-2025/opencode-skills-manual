---
name: media-transcribe
description: 本地音频/视频转写，使用 sherpa-onnx + Paraformer，离线运行，不播放声音。Use when the user asks to transcribe audio, listen to a video, generate a transcript, or when a Bilibili video has no usable subtitles.
---

# Media Transcribe

本地离线转写，不依赖云端 API，不播放声音。

## 首选：直接调用工具

```text
media.transcribe({
  input: "/absolute/path/to/audio-or-video",
  output: "/optional/output/prefix"
})
```

返回 JSON，并生成：

- `<output>.json`：分段、时间轴、模型信息
- `<output>.txt`：`[mm:ss-mm:ss] text`
- `<output>.16k.wav`：16 kHz 单声道中间文件

## 依赖

- `ffmpeg` / `ffprobe`
- Python 3
- `sherpa-onnx`
- 模型：`sherpa-onnx-paraformer-zh-small-2024-03-09`

默认模型目录：

```text
~/.cache/opencode/asr/models/sherpa-onnx-paraformer-zh-small-2024-03-09
```

脚本：

```text
~/.config/opencode/skills/media-transcribe/scripts/transcribe_sherpa.py
```

## B 站视频的音轨（必须完整下载，不许截断）

`media.frames` 下的 mp4 只有视频流，直接转写会报 “Output file does not contain any stream”。取音轨两种方式，任选其一：

```bash
# 方式 1：bilibili-web 的脚本（如果这条命令可用）
BILI=~/.config/opencode/skills/bilibili-web/scripts/bili.js
node "$BILI" audio BV1xx... --out $PREFIX/tmp/opencode/a.m4a

# 方式 2：yt-dlp 兜底（本机实测可用）
cd $PREFIX/tmp/opencode
yt-dlp -f bestaudio -o 'a.%(ext)s' --no-playlist 'https://www.bilibili.com/video/BV1xx...'
```

- 一定要整条下载完再转写，不要只截前几十秒；转写结果里第一段到最后一秒都要有覆盖。
- 下载完先 `ls -lh` 看体积是否合理（几分钟的片子一般几 MB 到十几 MB）。
- 再 `media.transcribe({ input: "/.../a.m4a" })`。309 秒音频约 16 秒转完。

## 英文 / 混合语言：Whisper

Paraformer 只适合中文。英文或中英混合用同目录的 `transcribe_whisper.py`（sherpa-onnx Whisper 导出，仍完全离线；没有对应工具，只能用 CLI）：

```bash
python ~/.config/opencode/skills/media-transcribe/scripts/transcribe_whisper.py a.m4a \
  --model-dir ~/.cache/opencode/asr/models/sherpa-onnx-whisper-base.en \
  --language en --output out/prefix
```

模型目录要有 `*-encoder*.onnx`、`*-decoder*.onnx`、`*tokens.txt`；int8 优先。输出格式与 Paraformer 一致（JSON + 时间轴文本）。

模型下载（约 200 MB，一次就够）：

```bash
cd ~/.cache/opencode/asr/models
curl -L -C - -O 'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-base.en.tar.bz2'
tar xjf sherpa-onnx-whisper-base.en.tar.bz2 && rm sherpa-onnx-whisper-base.en.tar.bz2
```

- 下载慢就断点续传（`-C -`），下完先 `tar tjf` 验一遍再解压，别拿半截包硬解。
- 判断用哪个模型：音频是中文讲解 → Paraformer；英文/中英混杂 → Whisper base.en。
- 如果 Paraformer 转出来是「嗯 / 啦啦 / 我爱你」这种碎片，多半是没有旁白、只有 BGM，别硬猜内容，改走抽帧看画面。

## 处理策略

1. 优先读取 B 站 AI/CC 字幕。
2. 字幕缺失、时间轴异常或明显不可靠时，才用本地 ASR。
3. 视频先用 `ffmpeg` 抽 16 kHz 单声道音频。
4. 默认 30 秒一段；需要更细时间轴时把 `chunk_seconds` 调到 10–15。
5. ASR 可能有同音错字，重要人名/术语要结合字幕或上下文校正。

## 安全

- 只读本地文件，不上传音频。
- 不自动播放声音。
- 输出目录可写即可，不修改源文件。

## 环境要求

| 项目 | 要求 |
| --- | --- |
| 运行时 | Python 3.10+ |
| 工具封装 | `media.transcribe` / `media.frames` |
| Python 包 | `sherpa-onnx`（离线推理） |
| 系统命令 | `ffmpeg`、`ffprobe`（抽音频、转 16k 单声道） |
| 模型 | `sherpa-onnx-paraformer-zh-small-2024-03-09`，约 80MB |
| 可选模型 | Whisper 导出（英文/混合语言）：`*-encoder*.onnx`、`*-decoder*.onnx`、`tokens.txt`，int8 优先 |
| 模型目录 | `~/.cache/opencode/asr/models/` |
| 磁盘 | 建议 ≥200MB（模型 + 中间 wav） |
| 网络 | 不需要，完全离线 |

## 附带脚本

本目录 `scripts/` 下是手册对应的命令行实现（已脱敏，Termux 路径改为 `$HOME`/`$PREFIX`，shebang 统一为 `/usr/bin/env`）。脚本按 Termux 环境编写，其它系统改包名/路径即可。

