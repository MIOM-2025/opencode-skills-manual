---
name: QQ Bot Bridge (官方 QQ 机器人控制 OpenCode)
description: "This phone runs an official Tencent QQ bot (AppID 1905898046, bot MIOM-Opencode) that bridges QQ private/group chat to OpenCode sessions. Use whenever the user asks to read QQ messages, reply to someone on QQ, send a file to QQ, check who messaged the bot, manage the bot service, list/switch/delete bridged OpenCode sessions, or troubleshoot the QQ bridge. Chinese triggers:「QQ 有人找我吗」「看看 QQ」「回复 QQ」「发文件给他」「机器人状态」「重启 QQ 桥」."
---

# QQ Bot Bridge

官方机器人（独立号，不碰个人号）↔ OpenCode。**优先用工具，不要用 shell 拼命令行。**

## 工具（MCP: `qq`）

| 工具 | 用途 |
|------|------|
| `tools.qq.status` | 桥状态、正在跑的任务、最近聊天 |
| `tools.qq.contacts` | 已知私聊/群/频道的完整 openid |
| `tools.qq.history` | 读某个聊天的最近记录 |
| `tools.qq.send_text` | 发文字 |
| `tools.qq.send_file` | 发文件（>9MB 自动切片 part01/02…） |
| `tools.qq.sessions` | 列出 QQ 聊天 ↔ `ses_xxx` 映射 |
| `tools.qq.session_new` | 新建并切换会话 |
| `tools.qq.session_switch` | 切换会话 |
| `tools.qq.session_delete` | **默认销毁该聊天全部会话 + 聊天记录**（也删 OpenCode 会话） |
| `tools.qq.invite` | 拉群链接 |

规则：

- 不传 `chat` 时，自动作用于**当前 QQ 会话**（用 `_meta.sessionID` 反查）。
- 用户要文件：生成完立刻 `send_file`，**不要贴图床链接**；发完说清「文件名 + 大小 + 用途」。
- 切片文件按顺序发，提示对方全部收完后合并。
- 发消息受 5 分钟被动窗口限制；失败会返回原因。

## 用户侧命令（QQ 里发）

`/new [名字]` `​/switch 名字` `​/list` `​/current` `​/del [all]` `​/history [N]` `​/cancel` `​/status` `​/help`

- `/del` 删当前会话；`/del all` 连聊天记录一起清空。
- `/new` 不填名字自动命名 `s2`、`s3`…
- 切/删前会等正在跑的任务结束（默认 20 秒，`/del force` 强杀）。

## 完整聊天记录

- 已订阅 `GROUP_MESSAGE_CREATE`：群里**不 @ 的消息也会记录**（只入库，不回复）。
- 被 @ 时自动把最近 20 条群聊记录带进 prompt。
- 记录存 `~/qqbot/history/<chat>.jsonl`，`history` 工具可查。
- 消息按 `msg_id` 去重，网关重连不会重复执行。

## CLI 兜底

```bash
qq status | tail 20 | sessions | invite | log 50
qq send "文本"            # 最近私聊
qq send -g "文本"         # 最近群
qq file <路径>            # 最近私聊
qq file -g <路径>         # 最近群
qq start | stop | restart
```

## 硬限制

- **5 分钟**被动回复窗口（必须带用户最近一条 `msg_id`）。
- 单条上限：群/频道约 10MB、私聊约 7MB；超过自动切 9MB / 6MB 分片。
- 未认证机器人：仅管理员可私聊、最多 1 个群。
- `openid` 不是 QQ 号。

## 排障

| 现象 | 处理 |
|------|------|
| 收不到群消息 | 机器人是否以「机器人身份」进群；`qq invite` 重新拉 |
| 日志 `op=9` | intents 只能 `1<<25 \| 1<<30` |
| 回复停在「处理中」 | 看 `qq log`；多半是超时或发送失败 |
| 进程没了 | `qq start`；锁文件 `~/qqbot/bridge.lock` |
| 发送失败 | 检查 5 分钟窗口 / 文件是否超限 |

## 路径

`~/qqbot/bridge.py`（主程序）· `config.yaml`（凭据/模型）· `state.json`（会话映射）· `contacts.json`（msg_id）· `history/`（聊天记录）· `bridge.log`

改配置后：`qq restart && qq status`。**有任务在跑时不要 restart**（会丢回复）。
