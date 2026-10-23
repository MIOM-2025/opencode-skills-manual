---
name: bili-im（B站私信）
description: "用已登录的 B 站 Cookie 直接收发私信，不打开 App、不打开浏览器。支持按昵称搜人、发一句私信、读会话。Use whenever the user asks to 给某人发 B 站私信、B站聊天记录、联系某个 UP 主、在B站发消息 — including '发一条私信给 X'."
---

# B站私信（bili-im）

命令行工具：`bili-im`（已加入 PATH，源码在 `scripts/bili-im`）。

**不要现写 curl / python 调 B 站 IM 接口**，直接用它。

## 用法

```bash
bili-im whoami                          # 当前登录账号
bili-im search 关键词                    # 按昵称找人，返回 uid
bili-im send <uid|昵称> "文本"           # 发私信（昵称会先搜索）
bili-im read <uid|昵称> [条数]           # 读最近消息
bili-im sessions                        # 最近会话列表
```

加 `--json` 输出机器可读结果。

## 关键限制

- **对方未关注、未回复前，每个会话只能发 1 条**，第二条会被 B 站拒绝。要接着说必须等对方先回。
- 依赖 `~/.cache/opencode/bili/cookies.txt`（`bilibili-web` 技能登录后生成）。失效时用 `bili.login` 重新扫码。
- 文本不支持富文本/表情包；纯文本最稳。

## 实现要点（改代码时看）

- 发送：`POST https://api.vc.bilibili.com/web_im/v1/web_im/send_msg`
  - 查询参数需 **WBI 签名**：`w_sender_uid` / `w_receiver_id` + `wts` + `w_rid`
  - 表单字段是 `msg[content]`（不是 `msg_content`），`msg[timestamp]` 用**秒**
  - `msg[dev_id]` 固定 UUID 即可，不必与浏览器一致
  - `csrf` / `csrf_token` 取 `bili_jct`
- 读取：`svr_sync/fetch_session_msgs`，不需要 WBI
- 找 uid：`search/type?search_type=bili_user`

## 报错对照

| 现象 | 原因 |
|---|---|
| `-400 请求错误` | 参数名写错（`msg[content]`）、时间戳用了毫秒、或漏了 WBI 签名 |
| `-101 账号未登录` | Cookie 过期，重新登录 |
| 发送成功但对方没收到 | 触发「最多 1 条」限制，或对方设置了不接收陌生人私信 |

## 环境要求

| 项目 | 要求 |
| --- | --- |
| 运行时 | Python 3.9+（只用标准库，无第三方包） |
| 网络 | 可访问 `api.bilibili.com`、`api.vc.bilibili.com` |
| 凭证 | `~/.cache/opencode/bili/cookies.txt`（与 `bilibili-web` 共用，需含 `bili_jct`） |
| 限制 | 对方未关注/未回复前，每个会话只能发 1 条私信 |
| 富文本 | 不支持，纯文本最稳 |

## 附带脚本

本目录 `scripts/` 下是手册对应的命令行实现（已脱敏，Termux 路径改为 `$HOME`/`$PREFIX`，shebang 统一为 `/usr/bin/env`）。脚本按 Termux 环境编写，其它系统改包名/路径即可。

