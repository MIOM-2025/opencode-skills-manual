---
name: generic-app-install
description: Install an app, APK, split APK, or command-line package on this Android/Termux device, then verify it runs. Use whenever the user says 安装程序/装个 App/安装 APK/装包, or asks to set up a tool. Parameterized: works with any package or APK, not one specific app.
---

# Generic App / Package Install

Parameterize everything. First identify **what** is being installed and **where**.

## 1. Android APK

Prefer the dedicated tool:

```text
phone_install(apkPath="/absolute/path/app.apk", replace=true)
```

Fallbacks:

```sh
adb install -r -d /absolute/path/app.apk      # -d allows version downgrade
adb install-multiple -r base.apk split1.apk   # split APK / App Bundle
```

After install:

```sh
adb shell pm list packages | grep <package>
adb shell cmd package resolve-activity --brief <package>
adb shell monkey -p <package> -c android.intent.category.LAUNCHER 1
```

If the APK is not on the device, copy it to a readable path first. Do not install an APK from an untrusted source without telling the user.

## 2. Termux / Linux packages

```sh
pkg update
pkg install -y <package>
command -v <binary>
<binary> --version
```

Use `apt` only when `pkg` is unavailable. For Python tools:

```sh
python -m pip install --user <package>
python -c "import <module>; print(<module>.__version__)"
```

For Node tools, prefer `npm install -g <package>` only if Node is already present; otherwise install Node first.

## 3. Verify, then hand off

- Check the app/package actually exists and launches.
- If the user asked to test it themselves, **notify them and stop**; do not open the app or start a game unless asked.
- Report: package name, version, install path, and one command to launch it.

## Pitfalls

- Split APKs require `install-multiple`; installing only the base fails.
- A downgrade needs `-d`; otherwise Android rejects it.
- Do not wipe app data unless the user asks; `replace=true` keeps data.
- On Android 11+, `/sdcard/Android/data` access is restricted; use the app's own file picker or a shared path.

## 环境要求

| 项目 | 要求 |
| --- | --- |
| 运行时 | Android + Termux |
| 工具 | `phone_install` 或 `adb`；`pkg` / `pip` |
| 权限 | 允许安装未知来源 App；adb 回退需要 USB/无线调试 |
| 存储 | APK 放在可读路径（如 `/sdcard/Download/`） |
| 网络 | 下载 APK / 包时需要 |

