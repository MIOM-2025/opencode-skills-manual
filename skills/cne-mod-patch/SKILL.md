---
name: cne-mod-patch
description: Patch a Codename Engine mod installed in another app's private files on this phone — stage any changed file (script, shader, image, audio, chart, XML/JSON, etc.), back up the installed copy, push it through ADB or Portal, verify by hash, and restart the game. Use when editing files under /sdcard/Android/data/<game>/files/mods/... or when ADB/Portal has dropped and needs recovery.
---

# CNE Mod File Patch (installed app)

App-private mod files are **not writable from Termux** because of scoped storage. Use ADB (shell UID) or a working Portal, never plain `cp` from Termux.

## Fixed values (this phone)

- Game: `com.yoshman29.codenameengine`
- Activity: `com.starjump.starrynightrevelry.MainActivity`
- Installed mods: `/sdcard/Android/data/com.yoshman29.codenameengine/files/mods`
- Original mods backup: `.../files/mods.orig`
- Portal: `com.mobilerun.portal`, `http://127.0.0.1:8080`, token in `~/portal/token`
- Portal client: `~/portal/pctl.sh`

## Procedure

1. **Stage locally first.** Copy the installed file out or edit the source under `/sdcard/.CodenameEngine/mods/...`, then write the result to `/sdcard/Download/`. Set `LOCAL` and `TARGET` explicitly; the file can be **any type**, not just `.hx`.
2. **Back up the installed copy** before every push:
   ```sh
   adb shell "cp '$TARGET' '$TARGET.bak_$(date +%H%M%S)'"
   ```
3. **推送文件 + 哈希校验** (works for text and binary assets alike):
   ```sh
   adb push "$LOCAL" "$TARGET"
   adb shell "sha256sum '$TARGET'"
   sha256sum "$LOCAL"
   ```
   Hashes must match. For a directory: `adb push "$LOCAL_DIR/." "$TARGET_DIR/"` and compare a representative file, or hash every file.
4. **Restart only the game** (do not restart the QQ bridge while it may be answering):
   ```sh
   adb shell am force-stop com.yoshman29.codenameengine
   adb shell am start -n com.yoshman29.codenameengine/com.starjump.starrynightrevelry.MainActivity
   ```
5. Completion notice: `termux-notification --title ... --content ...`.

## When ADB is gone

`adb devices` empty is normal after a network change. Check whether adbd is even running:

```sh
getprop init.svc.adbd      # stopped = USB debugging is off
```

- `stopped`: ask the user to re-enable USB debugging / wireless debugging. No local command can turn it on.
- `running` but no device: `adb connect <phone-ip>:<port>`; the wireless port changes, so get it from the current Wireless debugging screen. Do not port-scan blindly — Android may accept-then-reset random ports.
- App data still inaccessible through `/sdcard/Android/data` or `/data/media/0`; do not retry `cp`.

## When Portal is down

```sh
pidof com.mobilerun.portal
curl -sS -m 3 http://127.0.0.1:8080/ping
~/portal/pctl.sh ping
```

Recovery order:

1. Launch the Portal app (Termux `am`, not `/system/bin/am`):
   ```sh
   am start -n com.mobilerun.portal/com.mobilerun.portal.ui.MainActivity
   ```
2. If it launches but 8080 stays closed, the accessibility service or socket toggle is off — the user must enable it in Portal's UI. The content-provider toggle needs shell UID, so it fails from Termux with `ACCESS_CONTENT_PROVIDERS_EXTERNALLY`.
3. With a working ADB only:
   ```sh
   adb shell content insert --uri content://com.mobilerun.portal/toggle_socket_server \
     --bind enabled:b:true --bind port:i:8080
   curl -s http://127.0.0.1:8080/ping
   ```

## Pitfalls

- `pm`, `dumpsys`, `logcat`, and `/system/bin/am` are restricted for Termux UID; prefer the `phone_*` tools or Termux's `am`.
- `phone_shell` and `phone_adb` both need a live channel; neither works when adbd is stopped and Portal is offline.
- Keep `.bak*` files next to the original; never delete the user's backups.
- Codename Engine reads scripts at song start, not live; a game restart is required.

## 环境要求

| 项目 | 要求 |
| --- | --- |
| 目标 App | Codename Engine 游戏已安装（本机包名 `com.yoshman29.codenameengine`） |
| 文件通道 | `adb`（USB / 无线调试）或 Portal（`com.mobilerun.portal`，token 在 `~/portal/token`） |
| 权限 | 写 app 私有目录需要 adb 的 shell UID；Termux 直接 `cp` 会被 scoped storage 拒绝 |
| 暂存目录 | `/sdcard/Download/`（Termux 可写），再 `adb push` 到目标 |
| 校验 | 设备端 `sha256sum` 与本地哈希一致才算成功 |
| 重启 | `am force-stop` + `am start` 只重启游戏，不动 QQ 桥 |
| 通知 | 可选 `termux-notification` |
| 限制 | adbd 停止时只能让用户重新开 USB/无线调试；Portal 掉线需无障碍服务 |

