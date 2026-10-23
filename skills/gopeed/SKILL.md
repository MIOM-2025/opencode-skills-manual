---
name: Gopeed Downloader (手机多线程下载)
description: "Send download URLs to the Gopeed app on this Android phone through its local REST API at http://127.0.0.1:9999, then check progress, pause/resume, or delete tasks. Use whenever the user asks to download a file, APK, magnet, torrent, or other link with Gopeed, send a link to Gopeed, or manage Gopeed download tasks — including Chinese requests like「用 Gopeed 下载」「把链接发给 Gopeed」「多线程下载」."
---

# Gopeed Downloader — 手机多线程下载

> 一句话：把链接 POST 给本机 Gopeed，让 Gopeed 用它的多线程引擎下载；不要用 `curl`/`wget` 自己下。

## 快速命令

入口在 PATH：`gopeed`（源码：`~/.config/opencode/skills/gopeed/scripts/gopeed`）。

```bash
gopeed health                 # 检查 API，显示版本/地址
gopeed add "https://..."      # 新建下载，返回 task id
gopeed add "magnet:?xt=..."   # 磁力/BT 同样走这里
gopeed list                   # 最近任务
gopeed list running           # 只看运行中
gopeed show <task-id>         # 单个任务详情
gopeed wait <task-id> [秒]    # 阻塞等待（测试/小文件用；大文件别等）
gopeed pause <task-id>        # 暂停
gopeed resume <task-id>       # 继续（API 里叫 continue）
gopeed delete <task-id>       # 删除任务，保留已下载文件
gopeed delete <task-id> --force  # 连文件一起删；先确认
```

`add` 可选参数：

```bash
gopeed add "https://..." --name "自定义文件名"
gopeed add "https://..." --path "/storage/emulated/0/Download/Gopeed"
```

不传 `--path` 就用 Gopeed 自己配置的下载目录。不要猜目录；用户没要求就不要改。

## 标准流程

1. **先检查**：`gopeed health`。
2. **连接失败**（`Could not connect` / `connection refused`）：
   - 用 `phone_open` 启动 `com.gopeed.gopeed`，等 1~2 秒再 `gopeed health`。
   - 如果有“Portal 想要打开 Gopeed”的系统弹窗，点“打开”。
   - 还不行就让用户在 Gopeed 里打开：**设置 → 高级 → API → 监听地址填 `127.0.0.1:9999` → 启动**。
   - 当前手机已验证 Gopeed `1.9.3` 在该地址可用；不要改成 `0.0.0.0`，不要把端口暴露到局域网。
3. **发送链接**：`gopeed add "<URL>"`。URL 一定要加引号，尤其是带 `&`、`?` 的链接。
4. **回报结果**：把 task id、状态、文件名/进度告诉用户。小文件可 `gopeed wait`；大文件不要阻塞，给 id 让用户稍后 `gopeed list`/`show`。
5. **用户要暂停/继续/删除**：用对应命令；删除默认保留文件，`--force` 才删文件，执行前确认。

## API 事实（已核对 Gopeed 源码与 1.9.3 实机）

- Base URL：`http://127.0.0.1:9999`
- 健康检查：`GET /api/v1/info`
- 新建任务：`POST /api/v1/tasks`
  ```json
  {"req":{"url":"https://example.com/file.zip"},"opts":{"name":"可选文件名","path":"可选目录"}}
  ```
- 任务列表：`GET /api/v1/tasks`（可加 `?status=running`）
- 任务详情：`GET /api/v1/tasks/{id}`
- 暂停：`PUT /api/v1/tasks/{id}/pause`
- 继续：`PUT /api/v1/tasks/{id}/continue`
- 删除：`DELETE /api/v1/tasks/{id}`；`?force=true` 连文件删
- 返回统一是 `{"code":0,"msg":"","data":...}`；`code != 0` 是错误，`1001` 是 token 未通过。
- 默认可以不带 token；如果用户开了“接口令牌”，脚本会读 `GOPEED_TOKEN` 或 `~/.config/gopeed/token`，并发送 `X-Api-Token`。

## 注意

- Gopeed 必须在运行，API 服务必须启动；App 被系统杀掉后 `health` 会失败，重新打开即可。
- Gopeed 在后台被 Android 冻结时，API 可能先连上再超时；把 Gopeed 切回前台，或给 Gopeed 关闭电池优化/允许后台运行。
- 这是本机 localhost API，不是公网服务；不要把监听地址改成 `0.0.0.0`。
- Android 的下载目录受分区存储限制；`--path` 必须是 Gopeed 能写的目录。默认目录最稳。
- 用户给的是网页而不是直链时，先说明“这是网页，不一定能直接下”；能拿到真实文件 URL 再 add。
- 不要用 `phone_media` 之类的媒体控制来“暂停下载”；下载任务用 `gopeed pause`。
- 不要在 Gopeed 里重复添加同一 URL；先 `gopeed list` 看有没有已存在/已完成的任务。

## 环境要求

| 项目 | 要求 |
| --- | --- |
| 运行时 | Android 版 Gopeed（1.9+），在「设置 → 高级 → API」启动服务，监听 `127.0.0.1:9999` |
| 系统命令 | `curl`、`jq` |
| 权限 | 允许 Gopeed 后台运行、关闭电池优化，否则 API 会被系统冻结 |
| 网络 | 下载任务本身需要外网 |
| 可选 | 开了「接口令牌」时，通过 `GOPEED_TOKEN` 或 `~/.config/gopeed/token` 提供 |

## 附带脚本

本目录 `scripts/` 下是手册对应的命令行实现（已脱敏，Termux 路径改为 `$HOME`/`$PREFIX`，shebang 统一为 `/usr/bin/env`）。`gopeed` 需要 Gopeed App 的本地 API 已启动。

