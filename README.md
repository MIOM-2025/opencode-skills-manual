# OpenCode 技能使用手册

这台 Android 手机（Termux）上运行的 **OpenCode** 当前启用的技能手册合集，自动导出，方便公开查阅与复用。

- 导出时间：2026-10-23
- 环境：Android + Termux，OpenCode 2，本地 13 个技能
- 内容：每个技能一份 `SKILL.md`（技能声明 + 使用说明 + 示例）

## 技能索引

| 技能 | 说明 | 手册 |
| --- | --- | --- |
| `ai-bridge` | 本地 `ai` 多模型 CLI：一次性咨询、多轮会话、模型对话/接力/辩论 | [SKILL.md](skills/ai-bridge/SKILL.md) |
| `bilibili-web` | B 站网页/API：登录、推荐、投稿、视频、评论、动态、搜索、收藏夹、三连、弹幕 | [SKILL.md](skills/bilibili-web/SKILL.md) |
| `browser` | 后台浏览器：桌面/手机 UA、重定向、Cookie、表单、JSON API、HTML 转文本 | [SKILL.md](skills/browser/SKILL.md) |
| `github` | GitHub：搜索仓库/代码、读 README/文件、Issue/PR/通知、fork/star/clone、建仓库、批量发文件 | [SKILL.md](skills/github/SKILL.md) |
| `gopeed` | 手机 Gopeed 下载器：通过本机 API 新建/暂停/继续/删除下载任务 | [SKILL.md](skills/gopeed/SKILL.md) |
| `media-transcribe` | 本地离线转写：sherpa-onnx + Paraformer，不联网、不播放声音 | [SKILL.md](skills/media-transcribe/SKILL.md) |
| `phone-back` | Android 返回键（含 UI 快照） | [SKILL.md](skills/phone-back/SKILL.md) |
| `phone-control` | ADB + Portal 双通道手机控制：UI 树、点击、滑动、输入、截图、启动 App | [SKILL.md](skills/phone-control/SKILL.md) |
| `phone-home` | Android 主界面键 | [SKILL.md](skills/phone-home/SKILL.md) |
| `phone-ops` | `pq` 通用快捷操作：当前 App、找控件、按文字点击/输入、滚动、截图 | [SKILL.md](skills/phone-ops/SKILL.md) |
| `phone-recents` | Android 多任务/最近任务键 | [SKILL.md](skills/phone-recents/SKILL.md) |
| `qq-bot-bridge` | 官方 QQ 机器人桥：QQ 私聊/群聊 ↔ OpenCode 会话、发文件、会话管理 | [SKILL.md](skills/qq-bot-bridge/SKILL.md) |
| `video-watch` | B 站视频观看与点评：字幕/转写、抽帧、时间点定位、发评论 | [SKILL.md](skills/video-watch/SKILL.md) |

## 目录结构

```
skills/<技能名>/SKILL.md
```

## 说明

- 手册描述的是本机环境（Termux 路径、OpenCode 插件、Android 工具），换到别的机器需要按实际环境调整路径和工具名。
- 本仓库只包含文档，不包含任何 token、cookie、密钥或聊天记录。
- OpenCode 还内置了 `opencode`、`report` 两个技能，它们编译在 OpenCode 二进制里，没有独立文件，因此未收录。
- 技能会随本机配置更新，本仓库是某一时刻的快照。
