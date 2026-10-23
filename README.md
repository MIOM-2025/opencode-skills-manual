# OpenCode 技能使用手册

一套在 **Android + Termux + OpenCode** 环境下运行的技能手册合集，覆盖手机控制、B 站、GitHub、下载器、离线转写、QQ 机器人和 NapCat 等场景。

- 每个技能目录下有 `SKILL.md`：技能声明、使用说明、示例
- 多数技能附带可直接运行的 `scripts/`（已脱敏）
- 每份手册末尾有 **「环境要求」**，列出运行时、系统命令、语言包、模型、权限、网络和凭证
- 完整依赖清单见 **[ENVIRONMENT.md](ENVIRONMENT.md)**
- 文中账号、IP、AppID 等私人信息已替换为 `your-account` / `<phone-ip>` / `<QQ_APP_ID>` 等占位符

## 技能索引

| 技能 | 用途 | 文档 |
| --- | --- | --- |
| `ai-bridge` | 本地多模型 CLI：咨询、多轮会话、模型对聊/辩论 | [SKILL.md](skills/ai-bridge/SKILL.md) |
| `bilibili-web` | B 站网页/API：登录、视频、评论、动态、搜索、收藏、三连、弹幕 | [SKILL.md](skills/bilibili-web/SKILL.md) · [scripts](skills/bilibili-web/scripts) |
| `bili-im` | B 站私信：按昵称找人、发私信、读会话 | [SKILL.md](skills/bili-im/SKILL.md) · [scripts](skills/bili-im/scripts) |
| `browser` | 后台浏览器：UA、重定向、Cookie、表单、HTML 转文本 | [SKILL.md](skills/browser/SKILL.md) · [scripts](skills/browser/scripts) |
| `github` | GitHub：搜索、文件、Issue/PR、fork/star/clone、建仓库、发文件 | [SKILL.md](skills/github/SKILL.md) · [scripts](skills/github/scripts) |
| `gopeed` | 手机 Gopeed 下载器：新建/暂停/继续/删除任务 | [SKILL.md](skills/gopeed/SKILL.md) · [scripts](skills/gopeed/scripts) |
| `media-transcribe` | 离线转写：sherpa-onnx + Paraformer | [SKILL.md](skills/media-transcribe/SKILL.md) · [scripts](skills/media-transcribe/scripts) |
| `napcat` | NapCat 小号 QQ：扫码/密码登录、OneBot11、WebUI | [SKILL.md](skills/napcat/SKILL.md) |
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
| `ai-bridge` | bash、`curl`、`jq`、`~/.config/ai/providers.conf` |
| `bilibili-web` | Node 24+，无 npm 依赖；B 站 cookie |
| `bili-im` | Python 3.9+（标准库）；B 站 cookie |
| `browser` | Node 24+，无 npm 依赖 |
| `github` | Bun 插件、`gh` 2.40+、`git`、`jq` |
| `gopeed` | Gopeed 1.9+ API、`curl`、`jq` |
| `media-transcribe` | Python 3.10+、`sherpa-onnx`、`ffmpeg`、80MB 模型 |
| `napcat` | proot Ubuntu、LinuxQQ、NapCat、VNC |
| `phone-back` | OpenCode 插件、Portal 或 adb |
| `phone-home` | OpenCode 插件、Portal 或 adb |
| `phone-recents` | OpenCode 插件、Portal 或 adb |
| `phone-control` | `adb`、Portal `127.0.0.1:8080` |
| `phone-ops` | `pq`、`curl`、`jq`、`adb` |
| `qq-bot-bridge` | Python 3、`aiohttp`、`PyYAML`、`opencode` CLI |
| `video-watch` | `ffmpeg`、`bili.*`、`media.*` |

## 通用前提

- **系统**：Android（Termux）或 Linux；路径统一用 `$HOME`、`$PREFIX`
- **终端工具**：`bash`、`curl`、`jq`、`git`
- **OpenCode**：2.x，技能目录 `~/.config/opencode/skills/`，插件目录 `~/.config/opencode/plugins/`
- **按需安装**：`nodejs`、`python`、`ffmpeg`、`gh`、`proot-distro`，见 ENVIRONMENT.md

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
