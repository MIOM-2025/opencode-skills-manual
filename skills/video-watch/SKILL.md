---
name: video-watch
description: 在后台看 B 站视频并生成有依据的点评：读取标题/简介/字幕，必要时本地转写，抽帧和 contact sheet，定位关键时间点，最后用 bili.comment 发带跳转时间点的评论。Use when the user asks to 看/总结/点评 a Bilibili video, find a moment in a video, or write a timestamped comment.
---

# Video Watch

不打开手机浏览器、不启动 B 站 App、不播放声音。  
所有步骤都走 OpenCode 工具，不依赖命令提示符。

## 流程

1. **元数据**
   - `bili.video({ bvid })`
   - 先读标题、简介、时长、UP、播放/点赞数据。

2. **字幕优先**
   - `bili.subtitles({ bvid })`
   - 有 AI/CC 字幕时直接用；注意 AI 字幕可能有同音错字。
   - 没有字幕，或字幕与画面明显不符，再用本地 ASR。

3. **本地转写**
   - `media.transcribe({ input: "/absolute/path/video.mp4", chunk_seconds: 15 })`
   - 只读本地文件，不上传音频，不播放声音。

4. **抽帧**
   - 全片概览：`media.frames({ bvid, interval_seconds: 15, width: 640 })`
   - 关键段更细：`media.frames({ bvid, start: 30, end: 90, fps: 2, width: 960, output: ".../key" })`
   - 先看 `contact.jpg`，再按需看单帧。
   - 需要判断 UI、动作、角色、画面变化时，必须看实际帧，不要只靠标题和简介。

5. **写点评**
   - 至少引用 1–2 个真实时间点，例如 `00:15`、`03:30`。
   - B 站评论里的 `MM:SS` 会自动变成可点击的跳转时间点。
   - 先讲具体做对的地方，再给可执行建议；不要空泛夸。
   - 公开评论必须带 AI 声明：

```text
（本条评论由 AI 生成，运行于 OpenCode 环境）
```

6. **发布与回读**
   - `bili.comment({ bvid, message, confirm: true })`
   - 发布后立即用 `bili.comments({ bvid })` 回读 rpid 和内容。
   - 删除自己刚发的评论：`bili.delete_comment({ bvid, rpid, confirm: true })`。

## 示例

```text
bili.video({ bvid: "BV1BG8b6QEFU" })
bili.subtitles({ bvid: "BV1BG8b6QEFU" })
media.frames({ bvid: "BV1BG8b6QEFU", interval_seconds: 15 })
// 看 contact.jpg 和关键单帧
bili.comment({
  bvid: "BV1BG8b6QEFU",
  message: "00:15 ... 03:30 ...\n（本条评论由 AI 生成，运行于 OpenCode 环境）",
  confirm: true
})
bili.comments({ bvid: "BV1BG8b6QEFU" })
```

## 注意

- 不要用 `ffmpeg`/`yt-dlp` 的 shell 命令代替 `media.frames`；那会破坏可复用性。
- `media.frames` 只下载视频流，不播放、不自动上传。
- 点评是公开写入；用户明确要求后才发，发出后回读确认。
- 不对未授权的视频批量评论；测试优先用自己账号的视频。

## 环境要求

| 项目 | 要求 |
| --- | --- |
| 运行时 | OpenCode 工具（`bili.*`、`media.*`） |
| 系统命令 | `ffmpeg`（抽帧、contact sheet） |
| 转写 | 同 `media-transcribe`：Python 3 + `sherpa-onnx` + Paraformer 模型 |
| 网络 | 可访问 B 站（取流、字幕、评论） |
| 写操作 | 发评论需要 B 站登录 cookie（含 `bili_jct`） |
| 磁盘 | 视频缓存 + 抽帧，建议预留数百 MB |

