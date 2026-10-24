---
name: video-watch
description: 在后台看 B 站视频并生成有依据的点评：读取标题/简介/字幕，必要时本地转写，抽帧和 contact sheet，定位关键时间点，最后用 bili.comment 发带跳转时间点的评论。Use when the user asks to 看/总结/点评 a Bilibili video, find a moment in a video, or write a timestamped comment.
---

# Video Watch

不打开手机浏览器、不启动 B 站 App、不播放声音。  
所有步骤都走 OpenCode 工具，不依赖命令提示符。

## 三件套：一条都不能省

**每一条视频都要走全这三步，不是"二选一"，也不是"字幕好用就不听写"：**

| 步骤 | 做什么 | 省不省 |
|---|---|---|
| 字幕 | `bili.subtitles` 读全文 + 时间轴 | 不能省；没字幕就记「缺失」，不能记成"不可信" |
| 音频 | 取音轨 + `media.transcribe` 全文听写 | 不能省，哪怕字幕完整也要听（字幕会漏、会错字、会盖掉画面外的旁白） |
| 画面 | `media.frames` + 看 contact sheet / 关键单帧 | 不能省，尤其 UI、演示、数据、角色动作 |

- 三者的作用是**互相校验**，不是互相替代：字幕给措辞，ASR 给真实时间轴和发音，画面给"到底在演示什么"。
- 只有三者对完，才允许写点评；对不上就写"这里字幕和画面不一致"，不要硬圆。
- 跑完在脑子里留一份对账：哪句来自字幕、哪句来自 ASR、哪句是画面看到的。

## 流程

0. **先查判重表**
   - `bili.seen_check({ bvid })` → `seen: true` 就直接跳过，别重复看、更别重复评论。
   - 看完后 `bili.seen_add({ bvid, title, status: "看过" })`；发评论时会自动记成「评论」+ rpid。

1. **元数据**
   - `bili.video({ bvid })`
   - 先读标题、简介、时长、UP、播放/点赞数据。

2. **字幕必读，再判断可信度**（这一步必须做，哪怕最后判定不可信）
   - `bili.subtitles({ bvid })`，**把整条字幕读一遍**（`text` + `cues` 时间轴都要过）。
   - 不许因为「AI 生成」就直接跳过去听写——大多数 AI 字幕是能用的，同音错字（人名、术语）靠上下文和画面校一下即可。
   - **可信度怎么判**（三者交叉：字幕 / 转写 / 画面）：
     - 可信度**高**：字幕内容与标题、简介、画面说的是一件事 → 措辞参考字幕，时间轴仍以 ASR 为准。
     - 可信度**中**：有个别段落对不上或明显错字 → 逐段用 ASR 校，别整条扔掉。
     - 可信度**低**：大面积串台（跟画面、标题完全无关，像别人的段子）、`rawCueCount` 远少于时长应有的句数、或整段复读机 → 判定不可信，这条视频不再参考字幕的**措辞**，但「读过并判定不可信」这个动作不能省，ASR 和画面照走。
   - 完全没字幕（`No CC/subtitle track`）≠ 不可信，只是缺一条线索，ASR 和画面照走。

3. **本地转写（真的听声音）**
   - 先拿音轨：`bili audio BV... --out /tmp/a.m4a`（抽帧下来的 mp4 没有音轨！）
     - 本机若没有 `bili` CLI，兜底：`yt-dlp -f bestaudio -o 'x.%(ext)s' <url>`（可用，但只用于取音轨，抽帧仍走 `media.frames`）
   - 再转写：`media.transcribe({ input: "/tmp/a.m4a", chunk_seconds: 15 })`
   - 只读本地文件，不上传音频，不播放声音。
   - 实测：101 秒约 15 秒转完，309 秒约 16 秒，很便宜，别省这一步。
   - ASR 有同音错字（人名、术语），要跟字幕和画面三方对一下。

4. **抽帧**
   - 全片概览：`media.frames({ bvid, interval_seconds: 15, width: 640 })`
   - 关键段更细：`media.frames({ bvid, start: 30, end: 90, fps: 2, width: 960, output: ".../key" })`
   - 先看 `contact.jpg`，再按需看单帧。
   - 需要判断 UI、动作、角色、画面变化时，必须看实际帧，不要只靠标题和简介。

5. **写点评**
   - **以自己的真实想法为主**。看到什么、想到什么就说什么，不要套模板，不要为了像"影评"而写影评。
   - **默认带时间戳**：至少给 2～3 个 `MM:SS` 锚点，让读者能跳过去核对；时间点必须来自字幕 cues 或 ASR 段落的真实时间轴，不许估。
   - 纯讲感受也可以带一个锚点，别写一整段没有落点的空话。
   - 先讲具体做对的地方，再给可执行建议；不要空泛夸。
   - 公开评论必须带 AI 标注（账号是主人的，话是 AI 说的）：
     `（AI生成）`，放句尾即可，不要写成长长一行免责声明。

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

## 评论之后

看视频的技能到「发布 + 回读」为止。  
**有人回复你、要你去答，那是另一件事**，走 `bili-replies` 技能，不要在这里顺手做。

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

