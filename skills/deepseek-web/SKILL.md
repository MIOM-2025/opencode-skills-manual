---
name: deepseek-web
description: 把 chat.deepseek.com 网页接口包成本地 OpenAI 兼容端点（http://127.0.0.1:8899/v1），在 OpenCode 里以 deepseek-web/deepseek-chat、deepseek-web/deepseek-reasoner 使用。非官方逆向方案，可能触发风控，仅作备选。Use when the user asks 白嫖 DeepSeek 网页版、接网页版模型、deepseek-web provider.
---

# DeepSeek 网页版 → 本地 OpenAI 代理

> ⚠️ **风控提示**：这是把 `chat.deepseek.com` 网页接口逆向包成本地 OpenAI 端点的非官方方案。DeepSeek 可能随时改协议、弹验证码、限流或封号，**不建议日常使用**；优先官方 API 或 OpenCode 自带的免费模型。账号风险自负。

## 是什么

- 本地端口 `8899`，OpenAI 兼容：`/v1/chat/completions`
- OpenCode provider：`deepseek-web/deepseek-chat`（快答）、`deepseek-web/deepseek-reasoner`（思考）
- 零第三方 Node 依赖；PoW 用官方 `sha3_wasm_bg.wasm`
- 网页版没有原生 function calling，代理用提示词注入 + 流式解析模拟

## 快速开始

```bash
DIR=~/.config/opencode/skills/deepseek-web/scripts
# 首次：解出 wasm（仓库里存的是 base64）
[ -f "$DIR/sha3_wasm_bg.wasm" ] || base64 -d "$DIR/sha3_wasm_bg.wasm.b64" > "$DIR/sha3_wasm_bg.wasm"
"$DIR/run.sh" start
"$DIR/run.sh" status
"$DIR/run.sh" stop
```

provider 配置（`~/.config/opencode/opencode.json`）：

```json
"deepseek-web": {
  "npm": "@ai-sdk/openai-compatible",
  "name": "DeepSeek 网页版（白嫖）",
  "options": { "baseURL": "http://127.0.0.1:8899/v1", "apiKey": "sk-deepseek-web" },
  "models": {
    "deepseek-chat": { "name": "DeepSeek Chat（网页版·快答）" },
    "deepseek-reasoner": { "name": "DeepSeek Reasoner（网页版·思考）" }
  }
}
```

## 登录 / token

- token 与 cookie 存在 `~/.config/deepseek-web/state.json`（600），只在本机，不上传。
- 短信登录：本机用 `~/dslogin` 起镜像登录页（`http://127.0.0.1:8890/`），登录后自动写入 `state.json`；`dslogin` 未随仓库发布。
- 密码登录：在 `~/.config/deepseek-web/config.json` 填 `account` / `password`，再 `run.sh login`（需要 `browser.js` 和 `headless_shell`）。
- token 失效时代理会尝试从浏览器 profile 刷新；失败会发 `termux-notification` 提醒重新登录。

## 文件

| 路径 | 内容 |
| --- | --- |
| `scripts/server.js` | 代理本体（零依赖） |
| `scripts/run.sh` | start / stop / restart / status / login |
| `scripts/browser.js` | 可选：从 `headless_shell` profile 里取 token |
| `scripts/sha3_wasm_bg.wasm.b64` | 官方 PoW wasm 的 base64，首次运行前解码 |
| `~/.config/deepseek-web/state.json` | token + cookie（600） |
| `~/.config/deepseek-web/config.json` | 可选账号密码 |
| `~/.config/deepseek-web/server.log` | 日志 |

## 限制

- 非官方接口：协议随时可能变，验证码、限流、封号风险由账号承担。
- 单账号并发有限，不要拿它跑批量任务。
- 工具调用是模拟的，复杂 tool schema 可能不稳。
- 不要把 `state.json` 或 cookie 发到聊天、仓库或截图里。

## 环境要求

| 项目 | 要求 |
| --- | --- |
| 运行时 | Node.js 24+（`server.js` 零第三方依赖） |
| 系统命令 | `curl`、`base64`（首次解 wasm） |
| 网络 | 可访问 `chat.deepseek.com` |
| 凭证 | `~/.config/deepseek-web/state.json`（600，token + cookie） |
| 端口 | 8899（OpenAI 兼容）、8890（可选登录页） |
| 可选 | `headless_shell`（`browser.js` 刷新 token）、`termux-notification` |
| 风险 | 非官方逆向接口，可能验证码/限流/封号；**不建议日常使用** |

## 附带脚本

本目录 `scripts/` 下是手册对应的命令行实现（已脱敏，Termux 路径改为 `$HOME`/`$PREFIX`，shebang 统一为 `/usr/bin/env`）。脚本按 Termux 环境编写，其它系统改包名/路径即可。

