---
name: Phone Home Key (主界面)
description: "Press the Android Home key with phone_key home to return to the launcher from any app, reset the screen, or finish a task cleanly. Reads the automatic UI snapshot. Use when the user says 回主界面 / 回桌面 / home / 退出当前 App."
---

# Phone Home Key（主界面）

**调用：**

```json
phone_key { "key": "home" }
```

Portal 优先，adb 回退；结果自带 `— auto UI —`，不用再 dump。

## 什么时候用

- 任何任务结束，回到桌面保持干净状态。
- 从深层页面快速回主界面，不想连续按 back。
- 打开另一个 App 前先归位。

## 操作循环

1. `phone_key key="home"`。
2. 读自动快照，确认 `Focused window` 是桌面。
3. 如果 Termux/OpenCode 悬浮窗还在，避开它覆盖的区域再点；不要点进悬浮窗，否则焦点会被抢走。

## 注意

- Home **不会杀死 App**，只是切到后台；App 仍在多任务里。
- 未保存的编辑/表单不会自动保存；需要保存先用 back 或页面按钮处理。
- 桌面图标/文件夹可能被悬浮窗遮住；先移动或换一个可见目标。
- 回桌面后可以用 `phone_open` 打开指定包名。

相关技能：`phone-back`、`phone-recents`、`phone-control`。
