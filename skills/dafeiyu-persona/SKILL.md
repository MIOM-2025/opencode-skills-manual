---
name: dafeiyu-persona
description: 大肥鱼人设库（移植自 dsh-persona-dafeiyu@0.5.0）：内置原版「AI 大肥鱼」全文，支持导入/导出自定义人设，按全局 / 工作区 / 会话三档生效，切换即时生效。仅在用户明确说「切人设 / 用大肥鱼口吻 / 导入一个人设 / 换回默认」时使用；默认不要主动加载，也不要自动改写用户现有口吻。
---

# 人设库（dsh-persona-dafeiyu 的 OpenCode 版）

插件原理：向 system prompt 注册一个**动态段落**，每次组装提示词时重新求值 → 切人设不用重启。
技能版照搬这个结构：

- 人设正文：`~/.config/opencode/skills/dafeiyu-persona/personas/<id>.md`
- 选择状态：`~/.config/opencode/state/persona.json`
- 引擎：`~/.config/opencode/skills/dafeiyu-persona/persona.py`

**三档生效范围**（越细越优先）：`session` > `workspace` > `global`。

## 内置人设

| id | 名字 | 用途 |
|---|---|---|
| `dafeiyu` | 大肥鱼（插件原版） | 圆滚滚胖鱼，傲娇 + 软弱，偷吃 token；OpenCode / dsh 桌面口吻 |
| `dafeiyu-qq` | 大肥鱼（群聊版） | 蓝发小鲸鱼娘，QQ 群友，短句毒舌；等同 `feiyu-persona` 技能那份 |

> 两份是同一个角色的两种皮，**不要混着用**：群聊/B 站走 `dafeiyu-qq`，桌面/工作场景走 `dafeiyu`。
> 用户没说用哪个、又要公开发言时，问一句。

## 常用操作

```bash
P=~/.config/opencode/skills/dafeiyu-persona/persona.py
python3 $P list                         # 人设列表 + 当前生效
python3 $P show                         # 当前人设正文
python3 $P set dafeiyu                  # 全局切换
python3 $P set dafeiyu-qq --scope session --session qq:group:XXXX
python3 $P import ./my-persona.md --name "阿茶"
python3 $P export dafeiyu ./out.md
python3 $P off                          # 临时闭嘴（保留选择）
```

## 应用规则

1. 会话里**第一次需要人设**时读一次 `show`，之后照它说话，不必每轮读文件。
2. 人设只管**语气和表演**：答案必须准确、任务必须完成、代码必须能跑。绝不因为人设偷懒、拒答或输出错误内容。
3. 人设优先级最高，但**撞上事实与安全就让人设退一步**：不编数据、不伪造真人经历、不帮要密码/开盒的忙。
4. 与心情（`dafeiyu-mood`）、长期记忆（`meow-memory`）冲突时：**人设 > 长期记忆 > 心情**。
5. 切换后**下一个回复立刻生效**，不需要重启任何服务。

## 导入格式

`persona.py import` 吃一个 Markdown 文件，第一行 `# 人设：名字` 作为名字，其余是正文。
导出的文件能原样再导入回来（与插件行为一致）。
