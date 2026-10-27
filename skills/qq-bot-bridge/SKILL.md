---
name: QQ Bot Bridge (官方 QQ 机器人控制 OpenCode)
description: "This phone runs an official Tencent QQ bot (AppID <QQ_APP_ID>, bot <BOT_NAME>) that bridges QQ private/group chat to OpenCode sessions. Use whenever the user asks to read QQ messages, reply to someone on QQ, send a file to QQ, check who messaged the bot, manage the bot service, list/switch/delete bridged OpenCode sessions, manage per-user/group access and attachment quotas, inspect full chat history, or troubleshoot the QQ bridge. Chinese triggers:「QQ 有人找我吗」「看看 QQ」「回复 QQ」「发文件给他」「机器人状态」「重启 QQ 桥」「谁能跟机器人说话」「群限额」「聊天记录」."
---

# QQ Bot Bridge

官方机器人（独立号，不碰个人号）↔ OpenCode。**优先用工具，不要用 shell 拼命令行。**

## 工具（MCP: `qq`）

| 工具 | 用途 |
|------|------|
| `tools.qq.status` | 桥状态、正在跑的任务、最近聊天 |
| `tools.qq.contacts` | 已知私聊/群/频道的完整 openid |
| `tools.qq.history` | 读某个聊天的最近记录，可按关键词搜索 |
| `tools.qq.history_list` | 列出所有有存档的聊天（全量记录概览） |
| `tools.qq.access` | 查看/设置开放权限：个人、群、会话分开 |
| `tools.qq.quota` | 查看/设置限额：个人、群、会话、全局默认分开 |
| `tools.qq.features` | 官方能力：指令面板 / 自定义菜单 / 群消息接收状态 |
| `tools.qq.send_text` | 发文字 |
| `tools.qq.send_file` | 发文件（>9MB 自动切片 part01/02…） |
| `tools.qq.sessions` | 列出 QQ 聊天 ↔ `ses_xxx` 映射 |
| `tools.qq.session_new` | 新建并切换会话 |
| `tools.qq.session_switch` | 切换会话 |
| `tools.qq.session_delete` | **默认销毁该聊天全部会话 + 聊天记录**（也删 OpenCode 会话） |
| `tools.qq.invite` | 拉群链接 |
| `tools.qq.mode` | 查看/切换对话模式：`owner` 仅主人 / `open` 所有人 |
| `tools.qq.groups` | 查看所有群配置（限额/超时/模型/开放权限）与会话覆盖 |
| `tools.qq.group_set` | 新增/修改群配置 |
| `tools.qq.group_del` | 删除群配置 |
| `tools.qq.group_rebind` | 群号变了：旧群 → 新群迁移配置 |
| `tools.qq.group_alias` | 给群加别名 |
| `tools.qq.users` | 列出用户单独配置 |
| `tools.qq.user_set` | 给单个 QQ 用户设限额/模型/开放权限 |
| `tools.qq.user_del` | 清除用户配置 |
| `tools.qq.session_rename` | 重命名本地会话名 |
| `tools.qq.session_override` | 给单个会话设覆盖配置 |
| `tools.qq.session_reset` | 清除会话覆盖 |
| `tools.qq.models` | 列出可切换模型 |
| `tools.qq.start` | 启动桥并等机器人上线（已在跑则不重复启动） |
| `tools.qq.stop` | 停止桥；**默认延迟 5 秒**，让回复先发出去；`delay=0` 立即停 |
| `tools.qq.restart` | 重启桥（改完配置/代码）；默认延迟 5 秒，`delay=0` 立即 |

规则：

- 不传 `chat` 时，自动作用于**当前 QQ 会话**（用 `_meta.sessionID` 反查）。
- 用户要文件：生成完立刻 `send_file`，**不要贴图床链接**；发完说清「文件名 + 大小 + 用途」。
- 切片文件按顺序发，提示对方全部收完后合并。
- 发消息受 5 分钟被动窗口限制；失败会返回原因。
- 启停别用 shell：`start` / `stop` / `restart` 已经做成工具，`stop`/`restart` 默认延迟 5 秒，避免这条回复发不出去。

## 用户侧命令（QQ 里发）

**对话模式（管理核心）**

- `/mode` 看当前模式；`/mode owner` / `/mode open` 切换；`/mode 1|2` 同义
- `/lock` 一键切回仅主人；`/unlock` 一键放开所有人
- `/admin` 看管理员名单；`/admin add <openid>`；`/admin del <openid|me>`（至少保留一人）
- `/whoami` 看自己的 openid —— **任何模式、任何人**都能用，不扣额度，方便报 ID 申请加入
- `/blocked [N]` 最近被回绝的人（时间/场景/openid/内容摘要）
- `/status` 显示当前模式和管理员人数

**帮助（每个命令都有详细说明）**

- `/help` 命令总览；`/help 命令` 看用法、说明、例子、别名（如 `/help gadd`、`/help 换群号`）

**会话**

- `/new [名字]` `/rename 新名字` `/switch 名字` `/list` `/list all` `/current`
- `/del [all]` `/history [N]` `/cancel` `/status`
- 新建会话默认名 = 群显示名 + 序号（`<BOT_NAME>1`、`<BOT_NAME>2`…）；`/new 测试` → `<BOT_NAME>-测试`
- 私聊用 openid 前 8 位；`/rename` 只改本地显示名

**模型 / 当前聊天快捷**

- `/models` 可用模型列表；`/model 3` 按序号切；`/model default` 回全局
- `/limit 9` 附件上限 MB；`/limit 0` 取消
- `/timeout 300` 超时秒数；`/timeout 0` 用全局
- `/guest on|off|auto` 当前聊天的开放权限（auto=跟随）
- `/sess` 看生效配置；`/sessdel` 清掉覆盖

**权限（能不能说话）与限额（附件多大）分开**

- `/access` 看总览；`/access user <openid|me> allow|deny|auto`
- `/access group <群ID或群名> allow|deny|auto`；`/access session allow|deny|auto`
- `/quota` 看总览；`/quota user <openid|me> <MB|0>`；`/quota group <群> <MB|0>`
- `/quota session <MB|0>`；`/quota default <MB|0>`（0=跟随/不限）
- 全局默认还可以设超时和模型：网页「限额」页三个输入框，或终端 `qq defaults limit=10 sec=600 model=opencode/...`
- 优先级：**会话覆盖 > 用户 > 群 > 全局**；管理员永远允许，个人权限优先于群权限

**群配置（影响整个群）**

- `/groups` 列出所有群配置 + 见过的群
- `/gadd <群ID或群名> [name=显示名] [mb=9] [sec=300] [model=…] [access=allow|deny|auto]`
- `/gdel <群ID或群名>` 删除，恢复全局
- `/grebind <旧群ID或群名> <新群ID>` 群号变了时整体迁移（旧群号留作别名）
- `/galias <群ID或群名> <别名>` 加别名，之后可用别名代替群 ID

**用户配置（影响某个 QQ 用户，所有聊天生效）**

- `/users` 列出用户单独配置
- `/user <openid|me> [name=名字] [mb=9] [sec=300] [model=…] [access=allow|deny|auto]`
- `/userdel <openid|me>` 清除；`/ulimit <openid|me> <MB|0>` 快捷限额

**官方能力 / 聊天记录**

- `/panel` 查看指令面板状态；`/panel install` 创建/更新私聊和群聊面板
- `/commands` 发可点击的命令标签；`/receive` 检查群消息接收状态和最近一次收到 @ 的时间
- `/history [N]` 当前聊天最近 N 条；`/history all` 全部聊天；`/history search 关键词`
- 群聊不 @ 机器人也要存档，必须让群管理员在机器人设置里开「接收所有消息」（`all`）
- QQ 只有三档：`all`（所有消息）、`only_mention`（仅 @）、`mention_and_context`（@ + 上下文）；机器人不能改。
  `all` 最稳：所有消息存档，@ 会回复，不 @ 只记录。`mention_and_context` 在部分群/客户端下 @ 事件不稳定，遇到 @ 没反应就切 `all`。

## 群配置 / 会话覆盖 / 模型

- 配置优先级：**会话覆盖 > 用户 > 群 > 全局**（`config.yaml`）。
- 群配置存 `~/qqbot/groups.json`；用户配置存 `~/qqbot/users.json`；会话覆盖存 `~/qqbot/session_overrides.json`；改完即时生效，不用重启。
- 群记录同时保存显示名、别名、最后活跃时间、QQ 真实群名和人数（自动从群信息接口读取，`/groups` 可见）；`/grebind` 用于群号变化，`/galias` 用于记不住群号时起别名。
- `guest` 三态：`null`=跟随，`true`=开放，`false`=关闭；界面层统一叫「开放权限」。
- 权限和限额是两套独立配置：`/access` 管能不能说话，`/quota` 管附件上限。
- 限额在下载完附件、调用 AI 之前校验，超了只回一句提示，不花额度。
- 全局默认（`groups.json` 的 `defaults`）包含限额、超时、模型；网页限额页和 `qq defaults` 可改，个人/群/会话可逐层覆盖。
- 群模型/超时会传给 `opencode run --model …`，按群隔离。
- 模型列表**实时**从 OpenCode 读：优先 `opencode models`，失败回退 zen API，再回退上次缓存；
  缓存 10 分钟，`/models refresh`（或 `GET /models?refresh=1`）强制刷新。不维护手写列表。
- `/models` 默认只列 `opencode/*`，`/models all` 看全部（本机 400+ 个），`/models <关键词>` 过滤；
  序号是完整列表里的真实序号，`/model 12` 直接切。

## Web 管理面板

```bash
qq web start     # 启动，默认 http://127.0.0.1:6200
qq web stop
qq web status
```

页面功能（十个标签页）：概览（极光玻璃视觉/统计/模式）、权限（个人/群分开）、
限额（个人/群/会话/全局默认分开）、群组（增删改/迁移/消息接收）、用户、会话（新建/切换/重命名/删除）、
记录（全量聊天存档/搜索/导出）、功能（指令面板/自定义菜单/群接收状态/API 清单/系统事件）、
拦截记录、模型库（搜索/刷新）。只监听 `127.0.0.1`，通过 `/api/*` 代理到控制口 6199，不直接暴露。

## 对话模式（省额度）

- **owner（默认）**：只有管理员名单里的 openid 能对话。其他人的私聊/群 @ 在最外层被回绝，**不建会话、不下附件、不调用 opencode**，不消耗模型额度；回绝提示同一人 5 分钟一次。`/whoami` 例外放行。
- **open**：所有人可对话，非管理员走 `guest_agent`（只读代理，不能建会话/发文件/操作手机），群内按用户隔离上下文；访客发管理命令一律回「只有主人能用命令」。
- 切换方式：QQ 里 `/mode owner|open`、`/lock`、`/unlock`；终端 `qq mode owner|open`；HTTP `POST /mode`；MCP `tools.qq.mode`。
- 持久化：模式在 `~/qqbot/mode.json`；管理员名单在 `~/qqbot/admins.json`（存在即覆盖 `config.yaml` 的 `admin_users`，首次 `/admin add` 时自动生成）。都不用重启。
- 加人流程：对方在 QQ 发 `/whoami` 拿到 openid → 主人 `/admin add <openid>` → 对方立即可对话。

## 完整聊天记录

- 已订阅 `GROUP_MESSAGE_CREATE`：群里**不 @ 的消息也会记录**（只入库，不回复）。
- 但群必须开启「接收所有消息」（`recv_msg_setting=all`）；`only_mention` 时只能收到 @ 和上下文。
  机器人不能自己改这个开关，需要群管理员在群设置里开；用 `/receive` 或网页面板检查。
- 被 @ 时自动把最近 20 条群聊记录带进 prompt。
- 记录存 `~/qqbot/history/<chat>.jsonl`，`history` / `history_list` 工具、`/history` 命令、网页「记录」页可查。
- 官方群/C2C 没有历史消息查询接口，只能靠事件存档；群成员列表接口也需平台授权（当前 11253）。
- 消息按 `msg_id` 去重，网关重连不会重复执行。

## CLI 兜底

```bash
qq status | tail 20 | sessions | invite | log 50
qq send "文本"            # 最近私聊
qq send -g "文本"         # 最近群
qq file <路径>            # 最近私聊
qq file -g <路径>         # 最近群
qq start | stop | restart
qq groups | gadd | gdel | grebind | galias
qq users | user | userdel | ulimit
qq access [user|group|session 目标 allow|deny|auto]
qq quota [user|group|session|default 目标 MB|0]
qq defaults [limit=MB] [sec=N] [model=…]
qq panel [status|install|refresh] | receive
qq history [key|all] [N] [关键词]
qq models [all|关键词|refresh] | sess | sessdel | sessrename
qq web start | stop | status
```

## 硬限制

- **5 分钟**被动回复窗口（必须带用户最近一条 `msg_id`）。
- 单条上限：群/频道约 10MB、私聊约 7MB；超过自动切 9MB / 6MB 分片。
- 未认证机器人：仅管理员可私聊、最多 1 个群。
- `openid` 不是 QQ 号。
- 群成员列表接口需要平台授权，当前返回 `11253`；群/C2C 没有官方历史消息查询接口。
- 全量群聊依赖群管理员开启「接收所有消息」；指令面板/自定义菜单若平台未授权会失败，面板创建当前已可用。

## 排障

| 现象 | 处理 |
|------|------|
| 收不到群消息 | 机器人是否以「机器人身份」进群；`qq invite` 重新拉 |
| 日志 `op=9` | intents 只能 `1<<25 \| 1<<30` |
| 回复停在「处理中」 | 看 `qq log`；多半是超时或发送失败 |
| 进程没了 | `qq start`；锁文件 `~/qqbot/bridge.lock` |
| 发送失败 | 检查 5 分钟窗口 / 文件是否超限 |

## 路径

`~/qqbot/bridge.py`（主程序）· `config.yaml`（凭据/模型）· `mode.json`（对话模式）· `groups.json`（群配置）· `session_overrides.json`（会话覆盖）· `manage.py`（网页面板）· `state.json`（会话映射）· `contacts.json`（msg_id）· `history/`（聊天记录）· `bridge.log`

改配置后：`qq restart && qq status`。**有任务在跑时不要 restart**（会丢回复）。

## 环境要求

| 项目 | 要求 |
| --- | --- |
| 运行时 | Python 3.10+ |
| Python 包 | `aiohttp`、`PyYAML` |
| 程序文件 | `~/qqbot/bridge.py`、`config.yaml`（QQ 机器人 AppID/Secret）、`qq` CLI |
| 外部服务 | 本机 `opencode` CLI/服务在运行；QQ 开放平台机器人已创建并上线 |
| 网络 | 能访问 QQ 开放平台网关（WebSocket/HTTP） |
| 权限 | 机器人需被私聊或拉进群；群消息需要 `group_openid` |
| 本地文件 | `~/qqbot/history/`（聊天记录）、`bridge.log`、`bridge.lock` |
| 模式/权限 | `~/qqbot/mode.json`、`admins.json`、`groups.json`、`users.json`、`session_overrides.json` |
| 控制接口 | `http://127.0.0.1:6199`（模式/权限/限额）；管理面板 `http://127.0.0.1:6200` |
| 说话范围 | `owner`（默认，仅管理员）/ `open`（所有人，非管理员只读） |
| 限制 | 单文件约 7MB（私聊）/10MB（群）；被动回复窗口 5 分钟 |

## 附带脚本

本目录 `scripts/` 下是手册对应的命令行实现（已脱敏，Termux 路径改为 `$HOME`/`$PREFIX`，shebang 统一为 `/usr/bin/env`）。注意：`qq` 只是 CLI 前端，桥主程序在 `~/qqbot/bridge.py`（未包含在本仓库）。

