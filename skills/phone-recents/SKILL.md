---
name: Phone Recents Key (多任务)
description: "Open the Android recents / app switcher with phone_key recents (APP_SWITCH) to switch between apps or inspect recent tasks. Reads the automatic UI snapshot. Use when the user says 多任务 / 最近任务 / recents / 切换应用."
---

# Phone Recents Key（多任务）

**调用：**

```json
phone_key { "key": "recents" }
```

等价于 `app_switch`，Android keycode 187。Portal 优先，adb 回退；结果自带 `— auto UI —`。

## 什么时候用

- 在最近任务里切回上一个 App。
- 查看当前打开了哪些任务。
- 需要关闭某个任务（先确认用户要求，不要默认清空）。

## 操作循环

1. `phone_key key="recents"`。
2. 读快照，按 `text` / `desc` 找目标 App 卡片。
3. 切换：点卡片中心。
4. 关闭单个任务：对卡片上滑（`phone_swipe`）或点卡片上的关闭按钮，然后读快照。
5. 关闭全部：找「全部清除 / 清除全部」按钮；**只有用户明确要求才点**。

## 注意

- 不同 ROM 的最近任务布局不同（横排卡片、竖排、网格）；以快照为准。
- 不要把 Termux / OpenCode 的任务清掉：它承载当前服务，清了可能中断会话。
- 有些 App 在最近任务里显示敏感内容；截图/回读时注意隐私。
- 如果 recents 没反应，改用 `phone-home` 回桌面再 `phone_open` 目标 App。

相关技能：`phone-back`、`phone-home`、`phone-control`。
