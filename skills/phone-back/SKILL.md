---
name: Phone Back Key (返回键)
description: "Press the Android Back key with phone_key back to go up one screen, dismiss the keyboard or a dialog, or leave a settings subpage. Reads the automatic UI snapshot. Use when the user says 返回 / back / 上一页 / 关闭弹窗."
---

# Phone Back Key（返回键）

**调用：**

```json
phone_key { "key": "back" }
```

Portal 优先，adb 自动回退；不需要传 serial。结果会直接带 `— auto UI —`，**不要**再补 `phone_dump_ui`。

## 什么时候用

- 关闭弹窗、菜单、搜索框、输入法。
- 从设置子页/详情页回上一级。
- 取消当前操作，回到上一屏。

## 不要用

- 想退出整个 App 回桌面 → 用 `phone-home`（按 back 可能退出登录/关闭未保存内容）。
- 页面根屏按 back 可能直接退出 App；先看快照。

## 操作循环

1. `phone_key key="back"`。
2. 读自动快照。若界面没变：
   - 很可能第一次 back 只是收起了输入法/弹窗；再按一次。
   - 连续两次没变化就停，改用 `phone_dump_ui` 或 `phone-home`，不要盲目连按。
3. 如果弹出「保存/放弃/退出」对话框，先读按钮文字，不要默认点“确定”。

## 注意

- 浏览器/WebView 里 back 是“网页后退”，不一定是退出 App。
- 部分 App 根屏 back 只是把 App 切到后台，不会杀进程。
- 桌面按 back 可能无反应；需要回主界面用 `phone-home`。
- 返回后如果焦点落到 Termux 悬浮窗，避开左上角再点。

相关技能：`phone-home`、`phone-recents`、`phone-control`。

## 环境要求

| 项目 | 要求 |
| --- | --- |
| 运行时 | OpenCode mobile-use 插件（`phone_key` 工具） |
| 通道 | Portal（推荐）或 adb，插件会自动回退 |
| 权限 | Portal 无障碍服务，或 Android USB/无线调试 |
| 网络 | 仅本机回环 |

