---
name: AI Bridge — ai CLI 操作手册
description: "Step-by-step operation manual for the local `ai` multi-model CLI and AI-to-AI conversation: one-shot consult (`ai ask`), session-based multi-turn (`--session`), interactive chat, two-model relay/debate, cross-check, SVG. Use whenever the user says to ask/consult another model, start an AI conversation, run `ai ask` / `ai chat` / `ai relay`, or wants a second opinion. No API keys needed."
---

# AI Bridge (`ai`) — 操作手册

> 一句话：`ai` 是这台手机上的多模型桥；模型只回文本，不会动手机、不会改文件。你是执行者，它只是顾问。
> 完整参考：`~/AI_MANUAL.md`；设计说明：`~/AI_BRIDGE.md`。

## 工具优先（不用开终端）

| 工具 | 用途 | 对应命令 |
| --- | --- | --- |
| `ai.models` | 列出模型别名 | `ai models` |
| `ai.ask` | 单轮提问 / 复用会话 | `ai ask [--sys] [--session] <别名> "问题"` |
| `ai.ping` | 连通性检查（会真调一次） | `ai ping <别名>` |
| `ai.relay` | 两个模型互聊 | `ai relay A B "话题" 轮数` |

- `ai.ask` 必填 `model`、`prompt`；多轮把上一轮的 `session` 带上。
- 工具直接返回纯文本，不用再解析 stdout / 重定向 stderr。
- 只有工具没覆盖的命令（`ai chat`、`ai img`、`ai svg`、`ai oc-models`）才用命令行。

## 0. 核心工作法：一步一调用

1. **选模型**：默认 `ds`；中文润色 `glm`；快速短问 `lightning`/`mimo`；重推理 `nemotron`；长文 `longcat`；视觉 `vl`。
2. **问一个自包含的问题**：`ask` 是无状态新会话，模型看不到你这边的对话、文件、手机屏幕，背景必须写进问题。
3. **读返回文本**：成功时就是纯文本回复；失败会直接报错，不会假装成功。
4. **判断后再行动**：需要执行就回到你自己的工具（文件/手机），不要让模型“直接做”。

不要一口气批量问五个模型。只有重要结论才交叉验证，而且逐个读、逐个判断；循环只用于快速投票，不代替决策。

## 1. 最短上手

```text
ai.models()
ai.ask({ model: "ds", prompt: "用一句话解释量子纠缠" })
ai.ask({ model: "glm", prompt: "把这段改成书面语：今天天气不错" })
ai.ping({ model: "mimo" })
```

工具直接返回文本；`ai.ask` 第一次会带回 session，下一轮原样传入即可。CLI 只在工具不可用时看第 2 节。

## 2. 命令表（CLI 参考；能用 `ai.*` 工具时不要用命令）

| 命令 | 作用 | 备注 |
|---|---|---|
| `ai models` | 列出已配置别名 | 本地，不调模型 |
| `ai oc-models` | 实时列出服务上的全部模型 | 需要 OpenCode 服务在跑 |
| `ai ask <别名> "问题"` | 单轮问答 | stdout 纯文本 |
| `ai ask --sys "设定" <别名> "问题"` | 带系统提示 | 当前 opencode 通道会忽略 `--sys`，见第 8 节 |
| `ai ask -s SID <别名> "问题"` | 复用会话 | 多轮/视觉上下文必用 |
| `ai chat <别名>` | 交互式多轮 | 人类用；agent 不要直接调用（会卡在等待输入） |
| `ai relay <A> <B> "话题" [轮数]` | 两个模型互相对话 | 默认 3 轮，输出 `【别名】...` |
| `ai svg "描述" [输出.svg] [别名]` | 文本模型写 SVG | 零密钥，比 `ai img` 稳 |
| `ai img "描述" [输出.png] [模型]` | 文生图 | 免费通道可能被限流 |
| `ai ping <别名>` | 连通性检查 | 会调用模型 |

## 3. 单轮：当顾问用

```text
ai.ask({ model: "ds", prompt: "你是独立审阅者。背景：……。方案：……。请指出 3 个最可能的问题，按严重程度排序，不要客套。" })
```

规则：
- 问题要自包含：把背景、目标、约束、已有尝试都写进去。
- 一次只问一个明确问题；不要“顺便再写个代码/再查个资料”。
- 回复只当建议；代码、命令、事实都要自己验证后再用。
- 不要把密码、token、身份证、聊天记录原文发给免费模型；先脱敏。

## 4. 多轮对话（AI 对话）

### 4.1 Agent 用：工具 session

`ai.ask` 第一次调用会在返回文本末尾带回 `会话：ses_xxx`。下一轮把它原样填进 `session`：

```text
ai.ask({ model: "ds", prompt: "背景：我在给手机做自动化。第一步先确认什么？" })
→ ……\n\n会话：ses_xxx

ai.ask({ model: "ds", session: "ses_xxx", prompt: "继续：Portal 离线时复活顺序怎么排？" })
ai.ask({ model: "ds", session: "ses_xxx", prompt: "把结论压成 3 条执行清单。" })
```

会话 ID 记在任务笔记里即可，不需要写临时文件。

### 4.2 人类用：`ai chat`

```bash
ai chat glm
# 你> ...
# AI> ...
# /reset  清空上下文
# /exit   退出
```

`chat` 是交互式 `read` 循环，agent 在非 TTY 工具里直接调用会立即 EOF 或卡住；agent 一律用 `ai.ask` + `session`。

### 4.3 双 AI 对话：`ai relay`

```text
ai.relay({ model_a: "ds", model_b: "glm", topic: "给手机自动化设计 3 条使用守则", rounds: 4 })
```

- A/B 交替发言，默认 3 轮；`relay` 自己把历史拼进每一轮，不需要 `--session`。
- 输出适合存档；读完后自己提炼结论，不要把整篇辩论当最终答案。
- 想换模型/换话题就重新开一轮，不要复用旧 relay 的输出当上下文。

### 4.4 会话纪律

- **一个 SID = 一个话题 + 一个模型**；不要在同一个 SID 里换别名（会话创建时模型已绑定）。
- 换模型 = 新会话（省略 `-s`，重新拿 SID）。
- 话题结束就丢掉 SID；不要跨任务复用，避免上下文污染。
- 长对话变慢/跑题时，开新会话，把必要背景压缩后重发。
- 传入不存在的 SID 不会自动重建，通常会一直等到超时；拿不准就开新会话。

## 5. 模型选择

| 别名 | 模型 | 适合 |
|---|---|---|
| `ds` | DeepSeek V4.1 Flash Free | 默认，综合稳，约 3 秒 |
| `glm` | GLM-5.3-Flash Free | 中文表达/润色 |
| `lightning` | Nemotron 3.5 Lightning Free | 快，短任务 |
| `mimo` | MiMo-V2.6-Flash Free | 快，短任务 |
| `nemotron` | Nemotron 3 Ultra Free | 重推理 |
| `longcat` | LongCat 2.5 Preview Free | 长文本 |
| `vl` | Nemotron 3.5 Super VL Free | 视觉/多模态 |
| `pickle` | Big Pickle | 通用 |
| `spacebunny` | Space Bunny Free | 通用 |

`beam` 已移除（地区限制）。别名可能随配置变化，以 `ai models` / `ai oc-models` 为准。

## 6. 常用提问模板

**第二意见**

```text
ai.ask({ model: "nemotron", prompt: "你是独立审阅者。背景：……。我的方案：……。请只指出最可能出错的 3 个点，按严重程度排序，并给一句修正建议。" })
```

**中文润色**

```text
ai.ask({ model: "glm", prompt: "把下面文字改成简洁、书面、没有 AI 味的中文；保留事实，不要增加内容：……" })
```

**代码审查**

```text
ai.ask({ model: "ds", prompt: "你是资深工程师。只审查下面的改动，按“必须修 / 建议 / 可不改”分类，指出具体行和原因：……" })
```

**交叉验证（重要结论才做）**

```text
ai.ask({ model: "ds", prompt: "……" })
ai.ask({ model: "glm", prompt: "……" })
// 读完两个回复，自己对比；不要只信一个
```

**双 AI 辩论**

```text
ai.relay({ model_a: "ds", model_b: "nemotron", topic: "手机自动化应该默认走 Portal 还是 adb？", rounds: 4 })
```

## 7. 失败判断（重要）

`ai` 的失败不一定体现在退出码上，**必须看输出标记**：

| 现象 | 位置 | 处理 |
|---|---|---|
| `✖ 找不到本机 OpenCode 服务` | stderr | OpenCode 没在跑；或 `OC_PORT=<端口> ai ask ...` |
| `✖ 未知别名: xxx` | stderr | `ai models` / `ai oc-models` 确认 |
| `（模型不可用：...）` | stdout | 地区限制/模型下线；换别名，**开新会话** |
| `（空回复）` | stdout | 偶发；重试或换模型 |
| `（超时未拿到回复）` | stdout | 免费队列慢；换 `lightning`/`mimo`，或加大外层 `timeout` |
| 退出码 0 但输出是上面某条 | stdout | 仍算失败；不要当正常回复 |

工具用 `timeout_seconds`（默认 180）；CLI 外层用 `timeout 90` / `timeout 120`，给太紧会提前杀掉。

## 8. 已知限制（2026-10）

- **`--sys` 在 opencode 通道不生效**：`cmd_ask` 会把 `--sys` 传给 `call`，但 opencode 分支只把 prompt 和 SID 传给 `oc_ask`，系统提示被忽略。需要角色设定就写进问题开头；`--sys` 只在外部厂商通道有意义。
- `ai chat` 是交互式，agent 不要直接调用；用 `ask --session`。
- 免费模型会排队；同一问题换模型比死等更快。
- `ai img` 走免费 Pollinations，常被限流；优先 `ai svg`，或配置 `OPENAI_KEY` + `AI_IMG_PROVIDER=openai`。
- 模型只输出文本，不能操作手机/文件；执行仍用你自己的工具。

## 9. 文件与配置

| 路径 | 内容 |
|---|---|
| `~/ai/ai.sh` | 工具本体；`ai` 是 `$PREFIX/bin/ai` 软链 |
| `~/.config/ai/providers.conf` | 别名表（字段：别名 / 类型 / base_url / 模型 / 密钥变量名） |
| `~/.config/ai/keys.env` | 外部厂商密钥（本通道不需要） |
| `~/.config/ai/oc.port` | OpenCode 服务端口缓存；可用 `OC_PORT=` 覆盖 |
| `~/AI_MANUAL.md` | 完整手册 |
| `~/AI_BRIDGE.md` | 设计说明 |

新增模型：`ai oc-models` 看 id → 在 `providers.conf` 加一行 `别名|opencode|auto|opencode/<modelID>|` → 直接可用。

## 10. 和手机控制配合

AI 只给建议；要动手机，回到 `phone-control` / `phone-ops` 技能，用 `phone_*` 工具一步一步做：

```
phone_dump_ui 看 → phone_tap/type/key 做 → 结果自带 auto UI 快照 → 再判断
```

不要让 AI 模型“直接执行”；它没有手机工具，也不会真的点屏幕。

## 环境要求

| 项目 | 要求 |
| --- | --- |
| 运行时 | `ai` CLI（bash 脚本，需在 PATH 中） |
| 工具封装 | OpenCode 插件 `cli-bridge`：`ai.models` / `ai.ask` / `ai.ping` / `ai.relay` |
| 系统命令 | `curl`、`jq` |
| 配置文件 | `~/.config/ai/providers.conf`（格式：别名\|类型\|base_url\|模型\|密钥环境变量） |
| 模型服务 | 本机 OpenCode 服务或任意 OpenAI 兼容端点；`ai oc-models` 需要 OpenCode 服务在运行 |
| 网络 | 需要访问所配置的模型服务 |
| 密钥 | 不硬编码，按 providers.conf 里写的环境变量提供 |
| 可选文档 | `~/AI_MANUAL.md`、`~/AI_BRIDGE.md` |

