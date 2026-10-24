# OpenCode 技能使用手册

一套在 **Android + Termux + OpenCode** 环境下运行的技能手册合集，覆盖手机控制、B 站、GitHub、下载器、离线转写和 QQ 机器人等场景。

- 每个技能目录下有 `SKILL.md`：技能声明、使用说明、示例
- 多数技能附带可直接运行的 `scripts/`（已脱敏）
- 每份手册末尾有 **「环境要求」**，列出运行时、系统命令、语言包、模型、权限、网络和凭证
- 完整依赖清单见 **[ENVIRONMENT.md](ENVIRONMENT.md)**
- 文中账号、IP、AppID 等私人信息已替换为 `your-account` / `<phone-ip>` / `<QQ_APP_ID>` 等占位符

## 变更记录

- **2026-10-24**：新增 `cne-mod-patch`（CNE 模组文件热更：备份、推送、哈希校验、重启）。
- **2026-10-24**：文档示例改为工具调用；bash 代码块从 43 个减到 18 个，剩余为没有对应工具的操作（curl POST、音轨下载、`gopeed wait`、交互式 `ai chat`、ADB 底层参考）。
- **2026-10-24**：把常用命令行封装成工具：`ai.*`（问模型/列模型/探活/双模型对聊）、`bili_im.*`（B 站私信）、`pq.*`（按屏幕文字操作手机）。文档改为工具优先，命令行保留作备用。
- **2026-10-24**：新增 `bili-replies`（查自己评论下的新回复并逐条回复）和 `feiyu-persona`（大肥鱼口吻）；两者都不含自动轮询或自动回复。
- **2026-10-23**：移除 NapCat（小号 QQ）技能。原因：NapCat 属于第三方协议端，**容易触发 QQ 风控**，可能导致小号被限制甚至封禁。官方 QQ 机器人（`qq-bot-bridge`）不依赖 NapCat，仍是推荐方式。

## 技能索引

| 技能 | 用途 | 文档 |
| --- | --- | --- |
| `ai-bridge` | 本地多模型桥：咨询、多轮会话、模型对聊/辩论 | [SKILL.md](skills/ai-bridge/SKILL.md) |
| `bilibili-web` | B 站网页/API：登录、视频、评论、动态、搜索、收藏、三连、弹幕 | [SKILL.md](skills/bilibili-web/SKILL.md) · [scripts](skills/bilibili-web/scripts) |
| `bili-im` | B 站私信：按昵称找人、发私信、读会话 | [SKILL.md](skills/bili-im/SKILL.md) · [scripts](skills/bili-im/scripts) |
| `bili-replies` | B 站评论区回声：查自己评论下的新回复并逐条回复 | [SKILL.md](skills/bili-replies/SKILL.md) |
| `feiyu-persona` | 大肥鱼人格：QQ 群友口吻的短句说话方式 | [SKILL.md](skills/feiyu-persona/SKILL.md) |
| `browser` | 后台浏览器：UA、重定向、Cookie、表单、HTML 转文本 | [SKILL.md](skills/browser/SKILL.md) · [scripts](skills/browser/scripts) |
| `cne-mod-patch` | CNE 模组文件热更：备份、推送、哈希校验、重启游戏 | [SKILL.md](skills/cne-mod-patch/SKILL.md) |
| `github` | GitHub：搜索、文件、Issue/PR、fork/star/clone、建仓库、发文件 | [SKILL.md](skills/github/SKILL.md) · [scripts](skills/github/scripts) |
| `gopeed` | 手机 Gopeed 下载器：新建/暂停/继续/删除任务 | [SKILL.md](skills/gopeed/SKILL.md) · [scripts](skills/gopeed/scripts) |
| `media-transcribe` | 离线转写：Paraformer（中文）/ Whisper（英文） | [SKILL.md](skills/media-transcribe/SKILL.md) · [scripts](skills/media-transcribe/scripts) |
| `phone-back` | Android 返回键 | [SKILL.md](skills/phone-back/SKILL.md) |
| `phone-home` | Android 主界面键 | [SKILL.md](skills/phone-home/SKILL.md) |
| `phone-recents` | Android 多任务键 | [SKILL.md](skills/phone-recents/SKILL.md) |
| `phone-control` | ADB + Portal 手机控制：UI 树、点击、滑动、输入、截图 | [SKILL.md](skills/phone-control/SKILL.md) |
| `phone-ops` | `pq` 通用操作：找控件、点击、输入、滚动、截图 | [SKILL.md](skills/phone-ops/SKILL.md) · [scripts](skills/phone-ops/scripts) |
| `qq-bot-bridge` | 官方 QQ 机器人桥：私聊/群 ↔ OpenCode | [SKILL.md](skills/qq-bot-bridge/SKILL.md) · [scripts](skills/qq-bot-bridge/scripts) |
| `video-watch` | B 站视频观看与点评：字幕/转写、抽帧、发评论 | [SKILL.md](skills/video-watch/SKILL.md) |

## 环境速查

| 技能 | 关键依赖 |
| --- | --- |
| `ai-bridge` | `ai.*` 工具或 `ai` CLI、bash、`curl`、`jq`、`~/.config/ai/providers.conf` |
| `bilibili-web` | `bili.*` 工具或 `bili.js`；Node 24+；B 站 cookie |
| `bili-im` | `bili_im.*` 工具或 `bili-im` CLI；Python 3.9+；B 站 cookie |
| `bili-replies` | Node 24+，共用 B 站 cookie |
| `feiyu-persona` | 无依赖，纯提示词 |
| `browser` | `web.fetch` 工具或 `fetch.js` / `curl`；Node 24+ |
| `cne-mod-patch` | `adb` 或 Portal、`sha256sum`、Termux |
| `github` | Bun 插件、`gh` 2.40+、`git`、`jq` |
| `gopeed` | `gopeed.*` 工具或 `gopeed` CLI、Gopeed 1.9+ API、`curl`、`jq` |
| `media-transcribe` | `media.transcribe` 工具；Python 3.10+、`sherpa-onnx`、`ffmpeg`、80MB 模型 |
| `phone-back` | OpenCode 插件、Portal 或 adb |
| `phone-home` | OpenCode 插件、Portal 或 adb |
| `phone-recents` | OpenCode 插件、Portal 或 adb |
| `phone-control` | `adb`、Portal `127.0.0.1:8080` |
| `phone-ops` | `pq.*` 工具或 `pq` CLI、`curl`、`jq`、`adb` |
| `qq-bot-bridge` | Python 3、`aiohttp`、`PyYAML`、`opencode` CLI |
| `video-watch` | `ffmpeg`、`bili.*`、`media.*` |

## 通用前提

- **系统**：Android（Termux）或 Linux；路径统一用 `$HOME`、`$PREFIX`
- **终端工具**：`bash`、`curl`、`jq`、`git`
- **OpenCode**：2.x，技能目录 `~/.config/opencode/skills/`，插件目录 `~/.config/opencode/plugins/`
- **按需安装**：`nodejs`、`python`、`ffmpeg`、`gh`，见 ENVIRONMENT.md

## 目录结构

```
skills/<技能名>/SKILL.md
skills/<技能名>/scripts/...      # 部分技能附带
ENVIRONMENT.md                   # 依赖与端口总表
```

## 说明

- 手册是某台设备上的实际配置快照，路径、端口、App 名称可能需要按你的环境调整。
- 仓库只含文档与脚本，不含 token、cookie、密钥或聊天记录；私人标识均已占位符化。
- 脚本按 Termux 环境编写，其他 Linux 发行版通常只需改包名和路径。
