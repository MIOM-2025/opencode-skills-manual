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
| Python 包 | `sherpa-onnx`（离线推理） |
| 系统命令 | `ffmpeg`、`ffprobe`（抽音频、转 16k 单声道） |
| 模型 | `sherpa-onnx-paraformer-zh-small-2024-03-09`，约 80MB |
| 模型目录 | `~/.cache/opencode/asr/models/` |
| 磁盘 | 建议 ≥200MB（模型 + 中间 wav） |
| 网络 | 不需要，完全离线 |

## 附带脚本

本目录 `scripts/` 下是手册对应的命令行实现（已脱敏，Termux 路径改为 `$HOME`/`$PREFIX`，shebang 统一为 `/usr/bin/env`）。脚本按 Termux 环境编写，其它系统改包名/路径即可。

