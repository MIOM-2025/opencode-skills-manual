# 环境与依赖总表

本仓库技能共享一套 Android + Termux 环境。下面按系统包、语言包、模型、Android App、端口、目录列出，并给出安装命令。

## 1. 系统包（Termux）

```bash
pkg update
pkg install -y bash coreutils curl jq git nodejs python ffmpeg gh termux-api
```

| 包 | 导出时版本 | 使用者 |
| --- | --- | --- |
| bash | 5.x | ai-bridge、phone-ops、gopeed、github（ghs） |
| curl | 8.x | ai-bridge、gopeed、phone-ops |
| jq | 1.8 | ai-bridge、gopeed、phone-ops、github |
| git | 2.56 | github（clone/push）、脚本仓库 |
| nodejs | 24.x | bilibili-web、browser |
| python | 3.14 | media-transcribe、bili-im、qq-bot-bridge |
| ffmpeg | 9.x | media-transcribe、video-watch |
| gh | 2.103 | github |
| termux-api | 0.60 | phone-ops（termux-toast，可选） |

## 2. Python 包

```bash
pip install sherpa-onnx aiohttp pyyaml
```

| 包 | 使用者 | 说明 |
| --- | --- | --- |
| `sherpa-onnx` | media-transcribe、video-watch | 离线语音识别 |
| `aiohttp` | qq-bot-bridge | QQ 开放平台 WebSocket/HTTP |
| `PyYAML` | qq-bot-bridge | 读 `config.yaml` |
| 标准库 | bili-im | 不需要额外安装 |

## 3. 模型

| 模型 | 大小 | 路径 | 使用者 |
| --- | --- | --- | --- |
| `sherpa-onnx-paraformer-zh-small-2024-03-09` | ~80MB | `~/.cache/opencode/asr/models/` | media-transcribe、video-watch |

## 4. Android App 与权限

| 组件 | 作用 | 需要的权限 / 设置 |
| --- | --- | --- |
| Portal | 手机控制通道（HTTP 127.0.0.1:8080） | 无障碍服务；token 存 `~/portal/token` |
| adb（无线调试） | Portal 兜底通道 | 开发者选项 → 无线调试，配对后 `adb connect <phone-ip>:<port>` |
| Gopeed | 下载器 API | 后台运行、关闭电池优化、API 监听 127.0.0.1:9999 |
| Termux:API | `termux-toast` 等 | 安装 Termux:API App 并允许 |
| QQ（官方机器人） | 消息桥 | 机器人上线、被私聊或拉群 |

## 5. 端口

| 端口 | 服务 | 默认绑定 |
| --- | --- | --- |
| 8080 | Portal HTTP API | 127.0.0.1 |
| 9999 | Gopeed API | 127.0.0.1 |

## 6. 目录布局

```
~/.config/opencode/skills/     技能与脚本
~/.config/opencode/plugins/    插件（github、gopeed、web-tools 等）
~/.cache/opencode/             缓存：bili cookies、asr 模型、browser 响应、pq 树
~/repos/                       github.clone 默认目录
~/qqbot/                       QQ 桥主程序、配置、历史
~/portal/                      Portal token
~/.config/ai/providers.conf    ai CLI 模型别名
```

## 7. 按场景最小安装

| 想做什么 | 最少需要 |
| --- | --- |
| 看 B 站 / 发评论 / 私信 | Node 24 或 Python 3 + B 站 cookie |
| 读 GitHub / 发仓库 | `gh` + `git` + `jq` + 登录 |
| 下载文件 | Gopeed App + `curl` + `jq` |
| 转写音视频 | `ffmpeg` + Python + `sherpa-onnx` + 模型 |
| 操作手机 App | Portal（或 adb）+ `pq` |
| QQ 机器人 | Python + `aiohttp` + 官方机器人凭据 + `opencode` |

## 8. 已知限制

- Android 分区存储：脚本只能写 Termux 私有目录和授权目录
- 后台进程会被系统冻结：Gopeed/Portal/QQ 桥需要关闭电池优化
- 公网依赖：B 站、GitHub、QQ 网关都需要外网；ASR 完全离线
- 文件发送上限：QQ 私聊约 7MB、群约 10MB，超出需切片
