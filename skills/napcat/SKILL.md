---
name: NapCat 小号 QQ
description: "管理本机 proot 里的 NapCat + LinuxQQ 小号（OneBot11）：查看状态、扫码登录、账号密码登录（网页 VNC）、启动/停止、退出登录、WebUI 地址/令牌、OneBot 配置、发消息、日志、内存。Use whenever the user asks to 登录小号、扫码登录、密码登录、退出登录、NapCat 状态、NapCat WebUI、配置 OneBot、用小号发消息。"
---

# NapCat 小号 QQ

proot Ubuntu + LinuxQQ + NapCat，对外提供 OneBot11。**优先用工具，不要用 shell 拼命令。**

## 工具（MCP: `napcat`）

| 工具 | 用途 |
|------|------|
| `tools.napcat.status` | 是否在跑、登录状态、账号、二维码、WebUI、内存 |
| `tools.napcat.start` | **扫码登录**：启动 NapCat；不传 `uin` 出二维码，传了则快速登录 |
| `tools.napcat.password_login` | **密码登录**：切到普通 QQ 界面 + 网页 VNC，让用户自己输账号密码 |
| `tools.napcat.login_finish` | 密码登录完成后切回 NapCat 并快速登录（可传 `uin`，不传自动检测） |
| `tools.napcat.login_cancel` | 取消密码登录，恢复 NapCat 模式 |
| `tools.napcat.login_screen` | 截当前密码登录画面，返回 PNG 路径（不用 shell） |
| `tools.napcat.login_accounts` | 列出已登录过的账号（最近使用排序），确认密码登录结果 |
| `tools.napcat.stop` | 停止 NapCat 和 LinuxQQ |
| `tools.napcat.logout` | 退出登录：停止并删该账号的 LinuxQQ 会话数据 |
| `tools.napcat.qr` | 二维码复制到 Download，并开局域网自动刷新网页 |
| `tools.napcat.webui` | WebUI 地址 + 令牌（电脑/手机同一 Wi-Fi） |
| `tools.napcat.onebot` | 写 OneBot11 HTTP/WS 配置并重启（默认 3000/3001） |
| `tools.napcat.send` | 通过 OneBot HTTP 发一条消息（测试） |
| `tools.napcat.logs` | 最近日志（已去颜色码） |
| `tools.napcat.memory` | LinuxQQ 各进程 RSS |

## 扫码登录

1. `tools.napcat.start`（不传 `uin`）
2. `tools.napcat.qr` → 返回 `url`
3. 让用户在**另一块屏幕**（电脑/平板/电视/另一台手机）打开 `url`
4. 手机 QQ 分身 → 扫一扫 → 扫那块屏幕
5. `tools.napcat.status` 确认 `login=online`
6. `tools.napcat.onebot` 配接口

QQ 登录码有时不允许从相册选，必须用相机；所以二维码必须显示在另一块屏幕上。没有第二块屏幕就直接用密码登录。

## 密码登录（没有第二块屏幕 / 扫码被强制相机）

1. `tools.napcat.password_login` → 返回 `ready`、`vnc_url`、`vnc_password`、`screenshot`
2. 浏览器打开 `vnc_url`，输入 VNC 密码
3. 在 QQ 窗口点 **「账密登录」**
4. 勾选协议，输入 QQ 号 + 密码，点登录
5. 短信/滑块在同一画面完成
6. 勾选 **「自动登录」**；登录成功后点 **「确定」**（下次免手机验证）
7. 告诉助手登录完成 → 先 `tools.napcat.login_accounts` 确认 `newest` 是刚登录的小号
8. `tools.napcat.login_finish`（可传 `uin`）切回 NapCat
9. `tools.napcat.status` 确认 `login=online`，再 `onebot`

取消：`tools.napcat.login_cancel`

**要看当前登录画面**：`tools.napcat.login_screen` 返回 `screenshot` 路径，直接 `tools.qq.send_file` 发给用户。不要用 `scrot`、`ps`、`proot-distro` 拼 shell 命令截图。

VNC 默认只绑 `127.0.0.1`，只有手机能开；要在电脑上开，调用时传 `lan=true`（临时开放局域网，VNC 密码保护）。

## 规则

- 先 `status`；已经在跑就不要重复 `start`。
- 退出登录用 `logout`，不要手动删目录；退出后提醒用户去手机 QQ 的「登录设备管理」删掉 Linux 设备。
- 电脑访问 WebUI 用 `webui` 返回的局域网地址；`127.0.0.1` 在电脑上指向电脑自己，打不开。
- `onebot` 配好后先用 `send` 测一条私聊/群消息，再接桥。
- 内存看 `status` / `memory`；LinuxQQ 总 RSS 超过 ~600MB 时提醒用户。
- 密码登录期间的状态/截图都用 `status`、`login_screen`；不要在对话里跑 `ps`、`scrot`、`proot-distro`，那些是工具内部实现。

## 环境要求

| 项目 | 要求 |
| --- | --- |
| 宿主运行时 | `proot-distro` + Ubuntu 容器（导出时容器名 `napcat`）；MCP 服务 `napcat_mcp.py`（Python 3，仅标准库） |
| 容器内 | LinuxQQ、NapCat（OneBot11）、Xvfb + VNC 服务（密码登录用） |
| 端口 | WebUI 默认 6099（以 `status` 返回为准）；OneBot HTTP 3000 / WS 3001（`onebot` 工具默认）；VNC 默认只绑 `127.0.0.1` |
| 网络 | 扫码需要另一块屏幕访问二维码网页；WebUI/VNC 局域网访问时需同一 Wi-Fi |
| 账号 | 建议用小号；退出后到手机 QQ「登录设备管理」删除 Linux 设备 |
| 依赖服务 | OpenCode MCP 配置里注册 `napcat` 本地服务 |

