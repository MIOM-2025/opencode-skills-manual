---
name: dsh-stack
description: 一键起停本机三件套——dsh Web UI（:3080）、QQ 机器人桥（:6199）、QQ 管理网站（:6200）。已把验证过的命令、启动顺序、就绪判断和常见坑写死，省得每次重新摸索。仅在用户明确说「启动 dsh / 启动机器人 / 开管理网站 / 全家桶 / 关掉它们」时使用；不要自动调用。
---

# 本机三件套（dsh + QQ 桥 + 管理网站）

三件套互相独立，**开起来互不依赖**，只有管理网站要读桥的控制口。

| 服务 | 启动方式 | 地址 | 就绪判据 |
|---|---|---|---|
| dsh Web UI | `bash ~/dsh/start_dsh.sh` | `http://127.0.0.1:3080/?token=…` | 脚本自己轮询到「就绪」并打印带 token 的 URL |
| QQ 机器人 | **MCP 工具 `tools.qq.start`**（不要用 shell 的 `qq start`） | 控制口 `http://127.0.0.1:6199` | 返回「机器人上线」；`/status` 有 `uptime` |
| QQ 管理网站 | `qq web start` | `http://127.0.0.1:6200` | `curl -o /dev/null -w %{http_code}` 返回 **200** |

## 启动（标准流程）

1. **并行**：`bash ~/dsh/start_dsh.sh` 和 `tools.qq.start()` 同时发出去。
   - dsh 脚本自己会等，最多 60 秒，成功时最后一行就是带 token 的地址。
   - 脚本返回「已在运行」= 不用重复启动。
2. 两者都成功后：`qq web start`。
3. **面板不是立刻可用**：刚起时 `curl` 会返回 `000`，等 3~5 秒再验一次，返回 `200` 才算成。
4. 汇报时给三行表格：服务 / 状态 / 地址。dsh 的 token 链接属于凭据，别外发。

验证桥的活配置（顺带确认模型/模式）：

```bash
curl -s -m 3 http://127.0.0.1:6199/status | head -c 400
```

## 停止 / 重启

- 桥：`tools.qq.stop`（默认延迟 5 秒，让当前回复先发出去）；重启用 `tools.qq.restart`。
- 面板：`qq web stop`。
- dsh：`bash ~/dsh/stop_dsh.sh`。

## 坑

- **桥在跑任务时别重启**，会丢用户回复；`stop`/`restart` 的默认 5 秒延迟就是为这个。
- 桥起不来先看 `~/qqbot/bridge.log` 和锁文件 `~/qqbot/bridge.lock`；残留的锁要等进程真的退出。
- dsh 的日志在 `~/dsh/storage/dsh.log`，pid 在 `~/dsh/storage/dsh.pid`，最近一次 URL 在 `~/dsh/storage/url.txt`。
- 三个端口都只监听 `127.0.0.1`，外网访问要自己加 `--host` / `--trusted-host`，不要在回复里主动建议对外开放。
- 面板 `000` 不一定是挂了，先等 4 秒再测；还不行看 `~/qqbot/manage.log`。

## 不要做的事

- 不要用 `qq start` / `qq restart` 拼 shell：桥已经封装成 MCP 工具，工具里带「等上线」「延迟停止」这些逻辑。
- 不要把「查某个文件在哪」「看某个固定路径」也做成流程——那种一次性查询直接查，不值得沉淀成技能。
