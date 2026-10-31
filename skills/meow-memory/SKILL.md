---
name: meow-memory
description: 跨会话长期记忆（移植自 dsh-meow-memory）：七层（soul/user/project/fact/lesson/topic/rules）+ 关键词检索 + 去重合并 + 定期整理，存本地 JSON。仅在用户明确说「记一下 / 你还记得 / 回忆一下 / 整理记忆」或明确交代长期偏好时使用；默认不要主动加载，也不要每轮把记忆塞进回复。
---

# 喵记忆（dsh-meow-memory 的 OpenCode 版）

插件原理：首轮注入长期记忆块，之后每条用户消息按**条目关键词**检索 top-2 注入，空闲时做「dream」整理。
技能版保留同一套数据模型，但只在被点名时读写——不做每轮自动注入。

- 数据库：`~/.config/opencode/state/meow-memory/memory.json`
- 引擎：`~/.config/opencode/skills/meow-memory/memory.py`

## 七层

| 层 | 放什么 | 例 |
|---|---|---|
| `soul` | 关于我自己（人设层面的稳定事实） | 「本鱼偷吃 token 会心虚」 |
| `user` | 用户信息与偏好 | 「他讨厌被叫老师」「用 iOS」 |
| `project` | 项目信息（可带 `--project`） | 「MIOM 是 Codename Engine 的 mod」 |
| `fact` | 原子事实 | 「端口 6200 是管理网站」 |
| `lesson` | 教训与纠正 | 「别再用 `&&` 串命令，会被嫌吵」 |
| `topic` | 进行中的话题（带目标句） | 「正在把 dsh 三个插件搬到 OpenCode」 |
| `rules` | 设计原则 / 行为准则 | 「能用工具就别敲 shell」 |

## 什么时候用

- 用户说 **「记一下 / 记住这个 / 以后都这样」** → `remember`，写完回一句「记下了」，别复述全文。
- 用户说 **「你还记得… / 回忆一下 / 之前说的那个」** → `search`，用命中的内容回答；没命中就说没记过，**不要编**。
- 用户说 **「整理一下记忆 / dream」** → `dream`，报一句整理结果（合并几条、归档几条）。
- **心情不进记忆**：`dafeiyu-mood` 是临时状态，不该被当成稳定事实记下来。

## 命令

```bash
M=~/.config/opencode/skills/meow-memory/memory.py
python3 $M remember --layer user --content "他讨厌被叫老师" --keywords 称呼,老师 --importance 4
python3 $M search --query "怎么称呼他" [--project miom] [--layer user] [--days 90]
python3 $M remember --layer project --project miom --content "…" --keywords …
python3 $M list [--layer fact] [--project miom]
python3 $M read --id 20261030-1
python3 $M update --id 20261030-1 --importance 5 --status archived
python3 $M dream            # 合并重复 + 归档过期低价值条目
```

## 规则

1. **写之前先查**：`search` 一次，命中就用 `update` 改，不要堆重复条目（引擎也会自动去重合并）。
2. 一条只放一件事；`keywords` 写别人可能用来检索的词（2~4 个），别把整句塞进去。
3. `importance` 1~5：4 以上是「必须记住的偏好/禁忌」，2 以下是可有可无。
4. 检索结果只作参考：**命中不等于事实全部成立**，和当前对话冲突时以用户现在说的为准，并顺手 `update`。
5. 记忆不能推翻人设；人设 > 长期记忆 > 心情。
