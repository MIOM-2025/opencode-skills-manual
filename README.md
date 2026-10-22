# OpenCode 技能使用手册

一套在 **Android + Termux + OpenCode** 环境下运行的技能手册合集，覆盖手机控制、B 站、GitHub、下载器、离线转写、QQ 机器人等场景。

- 每个技能目录下是一份 `SKILL.md`：技能声明、使用说明、示例命令
- 每份手册末尾都有 **「环境要求」**，列出运行时、系统命令、Python/Node 包、权限、网络和凭证
- 文中账号、IP、AppID 等私人信息已替换为 `your-account` / `<phone-ip>` / `<QQ_APP_ID>` 等占位符

## 技能索引

| 技能 | 用途 | 手册 |
| --- | --- | --- |
| `ai-bridge` | 本地多模型 CLI：一次性咨询、多轮会话、模型对聊/辩论 | [SKILL.md](skills/ai-bridge/SKILL.md) |
| `bilibili-web` | B 站网页/API：登录、推荐、视频、评论、动态、搜索、收藏、三连、弹幕 | [SKILL.md](skills/bilibili-web/SKILL.md) |
| `browser` | 后台浏览器：UA、重定向、Cookie、表单、JSON API、HTML 转文本 | [SKILL.md](skills/browser/SKILL.md) |
| `github` | GitHub：搜索、README/文件、Issue/PR/通知、fork/star/clone、建仓库、发文件 | [SKILL.md](skills/github/SKILL.md) |
| `gopeed` | 手机 Gopeed 下载器：新建/暂停/继续/删除下载任务 | [SKILL.md](skills/gopeed/SKILL.md) |
| `media-transcribe` | 本地离线转写（sherpa-onnx + Paraformer） | [SKILL.md](skills/media-transcribe/SKILL.md) |
| `phone-back` | Android 返回键（带 UI 快照） | [SKILL.md](skills/phone-back/SKILL.md) |
| `phone-control` | ADB + Portal 双通道手机控制：UI 树、点击、滑动、输入、截图、启动 App | [SKILL.md](skills/phone-control/SKILL.md) |
| `phone-home` | Android 主界面键 | [SKILL.md](skills/phone-home/SKILL.md) |
| `phone-ops` | `pq` 通用快捷操作：当前 App、找控件、按文字点击/输入、滚动、截图 | [SKILL.md](skills/phone-ops/SKILL.md) |
| `phone-recents` | Android 多任务/最近任务键 | [SKILL.md](skills/phone-recents/SKILL.md) |
| `qq-bot-bridge` | 官方 QQ 机器人桥：私聊/群聊 ↔ OpenCode 会话、发文件、会话管理 | [SKILL.md](skills/qq-bot-bridge/SKILL.md) |
| `video-watch` | B 站视频观看与点评：字幕/转写、抽帧、时间点定位、发评论 | [SKILL.md](skills/video-watch/SKILL.md) |

## 环境总览

| 技能 | 运行时 | 关键依赖 | 凭证 / 网络 |
| --- | --- | --- | --- |
| `ai-bridge` | bash | `curl`、`jq`、`~/.config/ai/providers.conf` | 模型服务网络；密钥走环境变量 |
| `bilibili-web` | Node 24+ | 无 npm 依赖 | `~/.cache/opencode/bili/cookies.txt`；需含 `bili_jct` |
| `browser` | Node 24+ | 无 npm 依赖 | 目标站点网络 |
| `github` | Bun 插件 | `gh` 2.40+、`git` 2.30+、`jq` | `gh auth login`，scope `repo,read:org,gist,workflow` |
| `gopeed` | Android App | Gopeed 1.9+ API `127.0.0.1:9999`、`curl`、`jq` | 可选 `GOPEED_TOKEN` |
| `media-transcribe` | Python 3.10+ | `sherpa-onnx`、`ffmpeg`、Paraformer 模型（~80MB） | 完全离线 |
| `phone-back` / `phone-home` / `phone-recents` | OpenCode 插件 | mobile-use `phone_key` | Portal 无障碍 或 adb |
| `phone-control` | OpenCode 插件 | Portal `127.0.0.1:8080` / adb 1.0.41+ | `~/portal/token`，无线调试配对 |
| `phone-ops` | bash | `pq`、`curl`、`jq`、`adb`、可选 `termux-toast` | Portal token；缓存 `~/.cache/pq/` |
| `qq-bot-bridge` | Python 3.10+ | `aiohttp`、`PyYAML`、`~/qqbot/bridge.py`、`opencode` CLI | QQ 开放平台 AppID/Secret |
| `video-watch` | OpenCode 工具 | `ffmpeg`、`bili.*`、`media.*` | B 站 cookie（发评论需 `bili_jct`） |

## 通用前提

- **系统**：Android（Termux）或 Linux；示例路径用 `$HOME`、`$PREFIX`，其他系统请按实际路径替换
- **终端工具**：`bash`、`curl`、`jq`、`git`
- **OpenCode**：2.x，插件目录 `~/.config/opencode/plugins/`，技能目录 `~/.config/opencode/skills/`
- **可选**：`ffmpeg`、Python 3、Node.js 24+，按用到的技能安装

## 目录结构

```
skills/<技能名>/SKILL.md
```

## 说明

- 手册描述的是某一台设备上的实际配置快照，路径、端口、App 名称可能需要按你的环境调整。
- 仓库只含文档，不含 token、cookie、密钥或聊天记录；私人标识均已占位符化。
- 技能会持续更新，本仓库是导出时的快照。
