---
name: browser
description: Read and interact with websites in the background without opening the phone browser or an app — desktop/mobile User-Agent, redirects, cookies, JSON APIs, forms, and HTML-to-text. Use whenever the user asks to browse a page, fetch a URL, check a site's content, use a web API, or emulate a desktop/mobile browser from the terminal.
---

# Browser (background web access)

通用网页/HTTP 访问，不弹手机浏览器、不占前台、不操作输入法。  
B 站专用流程用 `bilibili-web`；这里只放通用方法。

## 先用哪个

1. **简单公开页面**：优先 `webfetch`，直接拿 Markdown。
2. **需要桌面/手机 UA、cookie、重定向、POST、JSON**：用本 skill 的 `fetch.js` 或 `curl`。
3. **强 JavaScript / 登录态复杂的页面**：找站点 API；没有 API 再考虑无头浏览器。当前环境没有安装 Playwright/Chromium，`fetch.js` 不执行 JS。

入口：

```bash
FETCH=~/.config/opencode/skills/browser/scripts/fetch.js
node "$FETCH" --help
```

依赖：Node 24+。只使用内置模块。

## 快速读取

```bash
# 默认 Windows Chrome 桌面 UA
node "$FETCH" https://example.com

# 手机 UA
node "$FETCH" https://example.com --mobile

# 带 cookie（Netscape 格式或每行 name=value）
node "$FETCH" https://example.com/private --cookie ~/.cache/opencode/browser/cookies.txt

# 保存原始响应；JSON 输出里会有 title/description/text/links
node "$FETCH" https://www.bilibili.com --out ~/.cache/opencode/browser/home.html
```

输出结构：

```json
{
  "requestedUrl": "...",
  "finalUrl": "...",
  "status": 200,
  "contentType": "text/html; charset=utf-8",
  "title": "...",
  "description": "...",
  "text": "正文预览（默认 12000 字）",
  "links": [{"text": "...", "url": "..."}],
  "savedTo": "$HOME/.cache/opencode/browser/last-response.bin"
}
```

用 `jq` 截取：

```bash
node "$FETCH" https://example.com | jq -r '.title, .text[:2000]'
```

## curl 配方

桌面 UA：

```bash
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
curl -sSL -A "$UA" -H 'Accept-Language: zh-CN,zh;q=0.9' \
  -c cookies.txt -b cookies.txt 'https://example.com' -o page.html
```

JSON API：

```bash
curl -sS -A "$UA" -H 'Accept: application/json' \
  -b cookies.txt 'https://api.example.com/items' | jq .
```

表单 POST（需要登录态时）：

```bash
curl -sS -A "$UA" -b cookies.txt \
  -H 'Referer: https://example.com/' \
  -H 'Origin: https://example.com' \
  --data-urlencode 'key=value' \
  --data-urlencode 'csrf=...' \
  'https://example.com/api/action' | jq .
```

- `-L` 跟随重定向，`-c/-b` 读写 cookie。
- 有些接口必须带 `Referer` 和 `Origin`，否则会 403 或风控。
- 不要从页面里抓 `csrf` 后盲目提交；先确认这是公开写操作，并得到用户确认。

## 浏览器模拟选择

| 目标 | UA |
|---|---|
| 电脑端网页 | Windows Chrome（`fetch.js` 默认） |
| 手机网页 | Android Chrome（`--mobile`） |
| B 站 | 桌面 UA + `Referer`；用 `bilibili-web` |

切换 UA 后，页面结构、默认接口和风控可能变化；同一会话不要频繁来回切。

## 限制与安全

- **不执行 JavaScript**：SPA 页面可能只拿到空壳；优先找 XHR/API。
- 当前没有 `ffmpeg`、`yt-dlp`、Python；需要下载/转码/视频理解时先安装或走专门工具。
- 不主动打开手机浏览器或 App；用户明确要求时才用 `phone-ops`。
- 绝不向前台 display 0 发送 Back 键，也不自动关闭用户输入法。
- 不把 `SESSDATA`、`bili_jct`、cookie 文件内容或登录二维码密钥发到聊天/仓库。
- 公开写操作（评论、发帖、点赞等）必须拿到用户明确确认和确切内容。
- 遇到 `403`/`429`：先停下，检查 UA/Referer/频率；不要连续重试。

## 常见故障

| 现象 | 处理 |
|---|---|
| 空 HTML / 只有 `<div id="app">` | 页面靠 JS 渲染，找 API 或换有 SSR 的页面 |
| 403 / 412 | 补 UA、Referer、Origin、Cookie；降低频率 |
| 429 | 等待，别重试风暴 |
| 乱码 | 检查 `content-type` 的 charset；`fetch.js` 会尝试解码 |
| 登录态丢失 | 重新走站点的登录流程；不要猜 cookie |

## 环境要求

| 项目 | 要求 |
| --- | --- |
| 运行时 | Node.js 24+（只使用内置模块） |
| 网络 | 能访问目标站点 |
| 输出目录 | `~/.cache/opencode/browser/`（响应体缓存） |
| 注意 | 不执行 JavaScript，需要 JS 的页面请用真实浏览器 |

## 附带脚本

本目录 `scripts/` 下是手册对应的命令行实现（已脱敏，Termux 路径改为 `$HOME`/`$PREFIX`，shebang 统一为 `/usr/bin/env`）。脚本按 Termux 环境编写，其它系统改包名/路径即可。

