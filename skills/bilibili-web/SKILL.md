---
name: bilibili-web
description: Operate Bilibili through its website/API without opening the phone browser or Bilibili app — log in by official QR link, homepage recommendations, account info, uploads, videos, comments, dynamic text/images, subtitles, search, favorite folders, likes/coins/follows, one-click triple, and danmaku. Use whenever the user asks to browse Bilibili, check a B站 video, comment, post a dynamic, favorite, interact, send danmaku, search, or use their Bilibili account from the background.
---

# Bilibili Web / API

专用于 **B 站网页接口**，不启动手机浏览器，也不启动 `tv.danmaku.bili` App。  
需要 App 界面操作时，用 `phone-ops`；本 skill 只负责 HTTP/API。

## 工具优先

表里有的场景直接调工具，不要再写 `node` 命令；下面的 CLI 是同一引擎的备用入口。

| 场景 | 工具 |
| --- | --- |
| 登录 / 轮询 / 账号状态 | `bili.login` / `bili.poll` / `bili.status` |
| 首页推荐 / 搜索 / 视频详情 | `bili.home` / `bili.search` / `bili.video` |
| 字幕 / 最新投稿 | `bili.subtitles` / `bili.latest` |
| 一级评论 / 发评论 / 删评论 | `bili.comments` / `bili.comment` / `bili.delete_comment` |
| 楼中楼 / 回复 | `bili.reply_list` / `bili.reply` |
| 扫自己的新回复 | `bili.check_replies` |
| 判重（看过/评论/跳过） | `bili.seen_check` / `bili.seen_add` |
| 收藏夹 | `bili.folders` / `bili.folder_items` / `bili.create_folder` / `bili.favorite` / `bili.ai_favorite` |
| 点赞 / 投币 / 关注 / 三连 | `bili.like` / `bili.coin` / `bili.follow` / `bili.triple` |
| 弹幕 | `bili.danmaku` / `bili.delete_danmaku` |
| 动态 | `bili.dynamic` |

写操作工具都要 `confirm: true` 才真正执行；不传只预览。

备用 CLI：`~/.config/opencode/skills/bilibili-web/scripts/bili.js`（`node bili.js --help` 看全部子命令）。依赖 Node 24+，只用内置模块，不装 npm 包。

## 登录

调 `bili.login` 生成官方扫码链接，把 `loginUrl` 原样发给用户确认；然后 `bili.poll` 检查状态，成功后 cookie 自动保存。已登录时 `bili.login` 会直接返回账号，换号传 `force: true`。

- 扫码状态看 `data.code`：`86101` 未扫码、`86090` 已扫码待确认、`0` 成功、`86038` 过期。
- 会话在 `~/.cache/opencode/bili/cookies.txt`（600）。不要把 cookie / SESSDATA / bili_jct 发到聊天或写进公开仓库。
- 检查账号：`bili.status`。

## 浏览与读取

| 要什么 | 工具 |
| --- | --- |
| 最新投稿 | `bili.latest({ limit: 10 })` |
| 视频详情 | `bili.video({ bvid })` |
| 一级评论 | `bili.comments({ bvid })` |
| CC / AI 字幕 | `bili.subtitles({ bvid, page? })` |
| 搜索 | `bili.search({ keyword })` |
| 首页推荐 | `bili.home({ limit? })` |
| 收藏夹列表 / 内容 | `bili.folders()` / `bili.folder_items({ folder?, folder_id?, page?, limit? })` |

字幕注意：很多视频只有 AI 字幕（`ai-zh`），可能识别错；输出带 `aiGenerated` / `duration` / `note`，不可靠时会丢弃。没有字幕就用 `media.transcribe` 转写音轨。

## 收藏夹

- 新建：`bili.create_folder({ title, privacy: 0|1, confirm: true })`
- 收藏：`bili.favorite({ bvid, folder?, folder_id?, confirm: true })`
- AI 私密收藏夹：`bili.ai_favorite({ bvid, confirm: true })`，不存在时自动创建
- `AI收藏夹` 不公开；只放与当前项目/明确兴趣直接相关、之后可能复用的内容，一次 1–3 条，并说明为什么选它。

## 写操作（必须确认）

点赞、投币、关注、收藏、弹幕、评论都会以当前账号产生真实互动。工具必须 `confirm: true` 才发布，不传只预览。用户没明确说“执行”时先 dry-run。

| 操作 | 工具 |
| --- | --- |
| 点赞 / 取消 | `bili.like({ bvid, undo?, confirm: true })` |
| 投币 | `bili.coin({ bvid, count: 1|2, confirm: true })` |
| 关注 / 取关 | `bili.follow({ target, undo?, confirm: true })` |
| 一键三连 | `bili.triple({ bvid, count: 1|2, confirm: true })` |
| 发弹幕 / 删除 | `bili.danmaku({ bvid, message, progress?, page?, confirm: true })` / `bili.delete_danmaku({ dmid, confirm: true })` |
| 评论 / 删除 | `bili.comment({ bvid, message, timestamp_seconds?, confirm: true })` / `bili.delete_comment({ bvid, rpid, confirm: true })` |
| 楼中楼 / 回复 | `bili.reply_list({ bvid, rpid, page? })` / `bili.reply({ bvid, rpid, message, root?, confirm: true })` |
| 扫自己的新回复 | `bili.check_replies({ limit: 10 })` |
| 动态 | `bili.dynamic({ content?, images?, confirm: true })` |

评论里写 `00:05` 这样的时间点会自动渲染成可点击跳转；`bili.comment` 的 `timestamp_seconds` 也会在开头生成 `MM:SS`，正文已以时间点开头时不会重复。

写操作依赖 cookie 中的 `bili_jct` 作为 CSRF token；缺失时重新登录。  
一键三连如果中途失败，会返回已完成的部分；不要自动重试投币，先检查结果。
发布评论后应回读 `comments` 验证 `rpid` 和文本，不要仅凭一次 POST 响应就断言成功。

## 命令行兜底（没有对应工具）

```bash
BILI=~/.config/opencode/skills/bilibili-web/scripts/bili.js
# 只下音轨，给本地 ASR 用（工具不提供音频下载）
node "$BILI" audio BV1xx... --out /path/to/a.m4a
# 自己发过的评论列表
node "$BILI" my-comments 20

# 判重表 seen.md：看过/评论过哪些视频，避免重复刷、重复评论
#（工具有 seen_check / seen_add，评论成功后也会自动写）
node "$BILI" seen 50
node "$BILI" seen-check BV1xx...
node "$BILI" seen-add BV1xx... --title "标题" --status 评论 --rpid 317776363521
```

## 技术要点

- 默认使用 **Windows Chrome 桌面 UA**；可用 `node "$BILI" ua mobile` 切换。
- 空间投稿列表和搜索需要 **WBI 签名**：`scripts/bili.js` 会从 `nav` 的 `wbi_img` 生成 `w_rid`，不要手工猜参数。
- 常用接口：
  - 登录二维码：`passport.bilibili.com/x/passport-login/web/qrcode/generate`
  - 扫码轮询：`passport.bilibili.com/x/passport-login/web/qrcode/poll`
  - 导航/账号：`api.bilibili.com/x/web-interface/nav`
  - 视频详情：`api.bilibili.com/x/web-interface/view?bvid=...`
  - 评论列表：`api.bilibili.com/x/v2/reply?type=1&oid=<aid>`
  - 发评论：`POST api.bilibili.com/x/v2/reply/add`
  - 删除评论：`POST api.bilibili.com/x/v2/reply/del`
  - 首页推荐：`api.bilibili.com/x/web-interface/index/top/feed/rcmd`
  - 收藏夹列表：`api.bilibili.com/x/v3/fav/folder/created/list-all?up_mid=<mid>`
  - 收藏夹内容：`api.bilibili.com/x/v3/fav/resource/list?media_id=<id>`
  - 新建收藏夹：`POST api.bilibili.com/x/v3/fav/folder/add`
  - 收藏视频：`POST api.bilibili.com/x/v3/fav/resource/deal`
  - 点赞：`POST api.bilibili.com/x/web-interface/archive/like`
  - 投币：`POST api.bilibili.com/x/web-interface/coin/add`
  - 关注/取关：`POST api.bilibili.com/x/relation/modify`
  - 发弹幕：`POST api.bilibili.com/x/v2/dm/post`
  - 删除弹幕：`POST api.bilibili.com/x/v2/dm/retract`
- 楼中楼列表：`GET api.bilibili.com/x/v2/reply/reply?type=1&oid=<aid>&root=<rpid>`
- 回复评论：`POST api.bilibili.com/x/v2/reply/add`（带 `root` 根评论 + `parent` 被回复的 rpid）
- 请求需要 `Referer`（视频页/空间页）和桌面 UA；评论/互动 POST 需要 `Content-Type: application/x-www-form-urlencoded` 与 `csrf`。
- 不要用手机浏览器打开页面；需要看视频内容时，先下载/抽帧/转写，或走视频理解模型。
- 当前环境已安装 `ffmpeg`、`ffprobe`、`yt-dlp`；本地音频转写优先用 `media.transcribe`
  （sherpa-onnx + Paraformer），不要默认装云端 ASR。

## 常见故障

| 现象 | 处理 |
|---|---|
| `NOT_LOGGED_IN` / `-101` | `bili.login({ force: true })`，让用户重新确认 |
| `-352` / 风控 | 检查 UA、Referer、WBI 参数；放慢频率 |
| `-799` 请求过于频繁 | 停止重试，等待几分钟 |
| `86038` | 登录链接过期，重新生成 |
| 评论 `-111` | `bili_jct` 缺失或过期，重新登录 |
| 评论 `12002` | 内容长度/敏感词/频率限制，换内容或稍后再试 |

## 环境要求

| 项目 | 要求 |
| --- | --- |
| 运行时 | Node.js 24+（只使用内置模块，无需 npm 依赖） |
| 工具封装 | OpenCode 插件 `web-tools`：`bili.*`（登录、浏览、评论、互动、动态、弹幕） |
| 系统命令 | `curl`（可选，调试用） |
| 网络 | 可访问 `api.bilibili.com`、`bilibili.com`、`i0.hdslb.com` |
| 凭证 | `~/.cache/opencode/bili/cookies.txt`，扫码登录后自动生成 |
| 写操作 | cookie 必须包含 `bili_jct`（CSRF token），否则点赞/评论/弹幕会失败 |

## 附带脚本

本目录 `scripts/` 下是手册对应的命令行实现（已脱敏，Termux 路径改为 `$HOME`/`$PREFIX`，shebang 统一为 `/usr/bin/env`）。脚本按 Termux 环境编写，其它系统改包名/路径即可。

