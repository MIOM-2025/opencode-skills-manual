---
name: bilibili-web
description: Operate Bilibili through its website/API without opening the phone browser or Bilibili app — log in by official QR link, homepage recommendations, account info, uploads, videos, comments, dynamic text/images, subtitles, search, favorite folders, likes/coins/follows, one-click triple, and danmaku. Use whenever the user asks to browse Bilibili, check a B站 video, comment, post a dynamic, favorite, interact, send danmaku, search, or use their Bilibili account from the background.
---

# Bilibili Web / API

专用于 **B 站网页接口**，不启动手机浏览器，也不启动 `tv.danmaku.bili` App。  
需要 App 界面操作时，用 `phone-ops`；本 skill 只负责 HTTP/API。

OpenCode 里的首选入口是插件工具 `bili.*`（见 `plugins/web-tools`），例如
`bili.home`、`bili.folders`、`bili.dynamic`、`bili.comment`、`bili.triple`、`bili.danmaku`。
下面的 CLI 是同一引擎的备用入口，方便调试和在没有工具注册的环境里使用。

入口：

```bash
BILI=~/.config/opencode/skills/bilibili-web/scripts/bili.js
node "$BILI" --help
```

依赖：Node 24+、`curl` 可选。只使用 Node 内置模块，不装 npm 包。

## 登录

B 站扫码登录需要一个由用户本人确认的官方链接：

```bash
node "$BILI" login          # 已登录时会直接返回账号；要重新登录加 --force
```

把输出的 `loginUrl` 原样发给用户，让其在手机上点开并确认。然后：

```bash
node "$BILI" wait           # 轮询最多 180 秒，成功会自动保存 cookie
# 或手动单次检查：
node "$BILI" poll
```

会话保存在：

```text
~/.cache/opencode/bili/cookies.txt
```

- cookie 文件权限为 `600`，**不要把 cookie / SESSDATA / bili_jct 输出到聊天**。
- 登录链接是账号授权凭证，不要转发、不要写入公开仓库。
- 链接过期（`86038`）后重新 `login --force`。
- 扫码状态看 `data.code`，不是顶层 `code`：
  - `86101` 未扫码
  - `86090` 已扫码，等待确认
  - `0` 成功
  - `86038` 过期

检查当前会话：

```bash
node "$BILI" nav
```

## 浏览与读取

```bash
# 当前账号最近投稿（默认 5 条）
node "$BILI" latest
node "$BILI" latest 10

# 视频详情：标题、UP、aid、简介、播放/评论/点赞数据
node "$BILI" video BV1JJJU6pEiY

# 最新一级评论
node "$BILI" comments BV1JJJU6pEiY

# 视频 CC 字幕/逐句时间轴（有字幕轨时）
node "$BILI" subtitles BV1JJJU6pEiY
node "$BILI" subtitles BV1JJJU6pEiY --page 2
# 注意：很多视频只有 AI 字幕（ai-zh），可能识别错或与视频不匹配；
# 输出会带 aiGenerated / duration / note，异常时会丢弃不可靠字幕轨。
# 没有字幕时用 Whisper 转写音频，或抽帧给视觉模型。

# 搜索视频
node "$BILI" search "FNF 移植"

# 首页推荐（默认 10 条，最多 30 条）
node "$BILI" home
node "$BILI" home 20

# 当前账号的收藏夹
node "$BILI" folders

# 查看某个收藏夹里的视频（按 ID 或名称）
node "$BILI" folder-items 4250678585
node "$BILI" folder-items --folder "AI收藏夹"
```

输出都是 JSON，可直接接 `jq`。B 站接口可能限流（`-799`）；等待后再试，不要短时间连续重试。

## 收藏夹

新建收藏夹、收藏视频都需要 `--yes`。`--privacy 0` 是公开，`--privacy 1` 是私密；不传时默认公开。

```bash
# 新建（默认公开）
node "$BILI" create-folder "待看" --yes
node "$BILI" create-folder "私人收藏" --privacy 1 --yes

# 收藏到指定收藏夹（按名称或 ID）
node "$BILI" favorite BV1JJJU6pEiY --folder "待看" --yes
node "$BILI" favorite BV1JJJU6pEiY --folder-id 3136197585 --yes

# 不指定收藏夹时，使用/自动创建私密的“AI收藏夹”
node "$BILI" ai-favorite BV1JJJU6pEiY --yes
```

`AI收藏夹` 是给 AI 做价值筛选用的私密收藏夹，不会公开出现在主页。  
`ai-favorite` 只在它不存在时创建；已存在就直接复用。也可以用 `favorite` 显式传入收藏夹，
但不会自动新建不存在的普通收藏夹（先 `create-folder`）。

AI 收藏的筛选原则：只放与用户当前项目/明确兴趣直接相关、且可能之后会复用的内容；
不要批量抓取首页，不要因为“热门”就收藏；一次 1–3 条，并在回复里说明为什么选它。

## 写操作（必须确认）

点赞、投币、关注、收藏、发弹幕和评论都会以当前账号产生真实互动；除特别说明外都要求 `--yes`。
除非用户已经明确给出目标并说“执行”，否则先 dry-run，不要加 `--yes`。

```bash
# 点赞 / 取消点赞
node "$BILI" like BV1JJJU6pEiY --yes
node "$BILI" like BV1JJJU6pEiY --undo --yes

# 投币 1 或 2 枚（消耗账号硬币）
node "$BILI" coin BV1JJJU6pEiY --count 1 --yes

# 关注 / 取关，目标可以是视频 BV 或用户 MID
node "$BILI" follow BV1JJJU6pEiY --yes
node "$BILI" follow 3537124622076685 --undo --yes

# 一键三连：点赞 + 投币 + 收藏到 AI收藏夹
node "$BILI" triple BV1JJJU6pEiY --count 1 --yes

# 发弹幕（时间点单位毫秒，默认 1000；分 P 默认 1）
node "$BILI" danmaku BV1JJJU6pEiY "弹幕内容" --progress 1000 --page 1 --yes

# 删除自己发出的弹幕（需要发送响应里的 dmid）
node "$BILI" delete-danmaku 1234567890 --yes

# 评论 / 删除评论
# 评论里写 00:05 这样的时间点，B 站会自动渲染成可点击的跳转时间点。
node "$BILI" comment BV1JJJU6pEiY "00:05 这里的双人同屏和 SICK 连击..." --yes
node "$BILI" delete-comment BV1JJJU6pEiY 317776363521 --yes

# 动态：纯文本或本地图片（最多 9 张）；不传 --yes 只 dry-run
node "$BILI" dynamic "动态正文" --yes
node "$BILI" dynamic "动态正文" --images /path/a.jpg,/path/b.png --yes
```

对应的 OpenCode 工具：

```text
bili.dynamic({ content, images: ["/path/a.jpg"], confirm: true })
bili.comment({ bvid, message, timestamp_seconds: 5, confirm: true })
```

`bili.comment` 的 `timestamp_seconds` 会自动在开头生成 `MM:SS`；如果正文已经以
`MM:SS` 开头则不会重复添加。动态图片接口与视频上传是两条独立链路，动态图片不会
自动变成视频封面。

写操作依赖 cookie 中的 `bili_jct` 作为 CSRF token；缺失时重新登录。  
一键三连如果中途失败，会返回已完成的部分；不要自动重试投币，先检查结果。
发布评论后应回读 `comments` 验证 `rpid` 和文本，不要仅凭一次 POST 响应就断言成功。

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
- 请求需要 `Referer`（视频页/空间页）和桌面 UA；评论/互动 POST 需要 `Content-Type: application/x-www-form-urlencoded` 与 `csrf`。
- 不要用手机浏览器打开页面；需要看视频内容时，先下载/抽帧/转写，或走视频理解模型。
- 当前环境已安装 `ffmpeg`、`ffprobe`、`yt-dlp`；本地音频转写优先用 `media.transcribe`
  （sherpa-onnx + Paraformer），不要默认装云端 ASR。

## 常见故障

| 现象 | 处理 |
|---|---|
| `NOT_LOGGED_IN` / `-101` | `bili login --force`，让用户重新确认 |
| `-352` / 风控 | 检查 UA、Referer、WBI 参数；放慢频率 |
| `-799` 请求过于频繁 | 停止重试，等待几分钟 |
| `86038` | 登录链接过期，重新生成 |
| 评论 `-111` | `bili_jct` 缺失或过期，重新登录 |
| 评论 `12002` | 内容长度/敏感词/频率限制，换内容或稍后再试 |
