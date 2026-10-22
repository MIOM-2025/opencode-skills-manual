---
name: Phone Control (ADB + Portal)
description: Operate this Android phone from Termux — dump the UI tree, find elements reliably, tap, swipe, type text, take screenshots, launch apps. App-agnostic; covers both the Portal accessibility channel and the adb/uiautomator channel. Use whenever the user asks to do something on the phone or in an app on it.
---

# Phone Control (ADB + Portal)

Full reference: `~/ADB_GUIDE_AI.md` (read it when something behaves unexpectedly).

## Skill index — this is the entry point

Load **this** skill for any phone task. 日常操作直接走 `phone-ops` 的 `pq` 命令（打包好的通用操作）：

| Skill | Load when |
|---|---|
| `phone-ops` | 通用常用操作打包（`pq`）：读树 / 按屏幕文字点击 / 输入 / 自动滑屏查找 / 截图 / 媒体 / 流程串 — **所有 App 通用，无 App 专属设定** |
| `phone-back` | 返回键：上一页 / 收键盘 / 关弹窗 |
| `phone-home` | Home 键：回主界面 / 任务收尾 |
| `phone-recents` | 多任务键：最近任务 / 切换 App |
| `ai-bridge` | consult another model from the shell (`ai ask/relay`) — not phone control |

This skill stays **app-agnostic**: no hard-coded ids, packages or coordinates for any app. Everything here must work for *any* screen.

## 工具优先 — adb / Portal 双通道（2026-10 起）

`phone_*` 工具**默认走 Portal**（更快）。Portal 离线时先尝试本机复活（content provider / 启动 Portal App），再尝试 adb 复活；都失败才切 adb。传 `serial: "portal"` 强制 Portal，显式 adb serial 强制 adb。

日常操作**一次一个工具调用**，禁止把整段流程写成脚本批量执行：

`phone_dump_ui` 看 → `phone_tap` / `phone_type` / `phone_swipe` / `phone_key` 做 → 结果里已自动附带操作后的 UI 快照（`— auto UI —`），**不需要再补一次 `phone_dump_ui`**。

下面的 `pctl.sh` / `pq` 章节保留为 Portal 底层与应急参考，不再是主路径。

## 三大金刚键（三个独立技能）

| 键 | 调用 | 技能 |
|---|---|---|
| 返回 | `phone_key key="back"` | `phone-back` |
| 主界面 | `phone_key key="home"` | `phone-home` |
| 多任务 | `phone_key key="recents"` | `phone-recents` |

三个键都会自动回读 UI 快照；不要再单独发 adb keyevent，也不需要再补 `phone_dump_ui`。

## 0. Core loop (never skip this)

Every step: **read the screen → pick the element → act → read again → decide**.

- **Operate, don't deliberate.** Phone work needs almost no reasoning: as soon as you can see the screen, act — one step, one action, one check. No planning essay, no weighing options, no "shall I do X first?" mid-run. The fastest correct path wins; extra analysis only makes it slower. **节奏：一次只决定下一步，每步等待 ≤0.5s；绝不原地傻等或重复重试 —— 日常操作直接 `pq …`（见 `phone-ops`）。**
- **The UI tree is the best source of truth.** Use it for every decision. A screenshot is the exception, never the default.
- Never run one long blind script of fixed coordinates. A script only accelerates an *already confirmed* screen state; the moment state differs, go back to the loop.
- **Toast on every step — mandatory.** `termux-toast -g bottom "③ 点发送 @540,837"`: numbered, short, with the coordinates. If `termux-toast` fails, fall back to `termux-notification --title "手机自动化" --content "③ …" --id phone-step`.

**Read the tree with `pctl.sh full` (not `state`):**

- `~/portal/pctl.sh full` → the **complete** tree: `text`, `contentDescription`, `hint`, `boundsInScreen`, `clickable` (~220 KB, native JSON, `jq`-friendly). **Locate every element here.**
- `~/portal/pctl.sh state` → small tree with no text/desc; use it only for `phone_state` (current app, focus, keyboard).
- Screenshot **only when the tree cannot answer**: self-drawn OpenFL/Unity surfaces, blank or duplicated WebView/Compose dumps, or a tree still stale after 3 reads. When you do, pass the downscale option (`phone_screenshot` `small`/`scale`) to keep it cheap.

**Fetch the whole tree in one call, filter locally:**

```bash
T=~/.cache/tree.json                                  # Android has no /tmp — never write there
~/portal/pctl.sh full | jq -r .result > "$T"          # ONE device round-trip: the complete tree
jq -r '[..|objects|select(.boundsInScreen)]|.[]
       |select(((.text//"")+(.contentDescription//""))|test("关键词"))
       |"\(.text)|\(.contentDescription)|\(.boundsInScreen.left),\(.boundsInScreen.top),\(.boundsInScreen.right),\(.boundsInScreen.bottom)|click=\(.clickable)"' "$T"
```

One fetch per step, then as much local `jq` as you like — no extra device calls.

**Poll, never `sleep`:**

```bash
for i in $(seq 1 25); do
  ~/portal/pctl.sh full | jq -r .result > "$T"
  jq -e '[..|objects|select(.boundsInScreen)]|.[]|select(((.text//"")+(.contentDescription//""))|test("关键词"))' "$T" >/dev/null && break
  sleep 0.2
done
```

**Check the compose box before hunting for a row.** If the tree already contains an editable field
(`className` contains `EditText`, `isEditable=true`, or a focused input), you are *already* on the compose/chat screen:
type and send. Do not go looking for a list row, and **never tap a title bar that merely repeats the target name** —
toolbars and rows can carry the same text but only one of them is the target.

**Channel priority:**

1. **Portal HTTP** (`pctl.sh …`) — local, milliseconds, no adb needed. **Portal first, always.**
2. `adb exec-out uiautomator dump /dev/stdout` — only when Portal is down **and** recovery below failed.
3. `adb exec-out screencap -p` — last resort.

**Portal down? Recover it — don't silently fall back to adb** (~30 s, far faster than uiautomator loops):

```bash
adb shell monkey -p com.mobilerun.portal -c android.intent.category.LAUNCHER 1   # or: ~/portal/pctl.sh app com.mobilerun.portal
sleep 5
adb shell content insert --uri content://com.mobilerun.portal/toggle_socket_server --bind enabled:b:true --bind port:i:8080
curl -s http://127.0.0.1:8080/ping     # expect {"status":"success","result":"pong"}
```

Symptom set: `pidof com.mobilerun.portal` empty, `content query …/ping` → `Accessibility service not available`, nothing listening on 8080.

The `phone_*` tools are an alternative front-end over the same adb/uiautomator work — use them when you need something the shell path doesn't expose, not as the default.

## 1. Preflight

```bash
adb devices                      # want "device", not "unauthorized"/"offline"
cat ~/portal/token               # Portal bearer token (36 chars)
~/portal/pctl.sh phone           # which app is in the foreground right now
```

- adb drops often and the wireless port changes each time: `adb connect 192.168.2.168:<port>`; `Connection refused` = ask the user for the new `IP:port` from Settings → Developer options → Wireless debugging (this adb has no mdns).
- If adb is dead you are **not** blocked — Portal is local and needs no adb.

## 2. Read the screen

```bash
~/portal/pctl.sh state                       # JSON: UI tree + foreground + focus (Portal)
adb exec-out uiautomator dump /dev/stdout 2>/dev/null   # XML tree, ~150ms (adb)
adb shell dumpsys window | grep mCurrentFocus | head -1
```

- Portal's `state` is **escaped JSON**: `sed 's/\\"/"/g'` before grepping. Its tree follows the *focused* window and lags 1–2s behind app switches.
- If a dump comes back with `package="com.termux"`, Termux stole focus — bring the target app to the front and dump again (retry up to 3x).
- Poll for an element instead of `sleep`-ing blindly: re-dump every ~200ms until the target node appears. This is what makes the loop fast (<1.5s per step).

## 3. Act

```bash
~/portal/pctl.sh tap X Y                 # click (foreground app only)
~/portal/pctl.sh swipe x1 y1 x2 y2 [ms]
~/portal/pctl.sh key 66                  # 66=Enter 67=Backspace 4=Back
~/portal/pctl.sh app com.android.settings    # 任意包名
~/portal/pctl.sh stop com.android.settings
~/portal/pctl.sh link "myapp://path"         # deep link
~/portal/pctl.sh shot ~/portal/s.png

adb shell input tap X Y
adb shell input swipe x1 y1 x2 y2 [ms]
adb shell input keyevent KEYCODE_WAKEUP
adb shell monkey -p <pkg> -c android.intent.category.LAUNCHER 1
```

- **Taps/gestures only work on the foreground app** (accessibility limitation, no root). You cannot operate an app in the background — bring it forward, act, move on.
- Check `currentApp` (Portal `phone`) before acting so you don't click into the wrong window.
- Coordinates are in device pixels: screen is **1080x2412** and `input tap` is in **portrait** space even when a game is landscape — convert for landscape apps.

## 4. Type text

Preferred (Portal — works in background, no IME switching, nothing to restore):

```bash
~/portal/pctl.sh text "要输入的文字"           # clear:true to wipe the field first
```

adb fallback (**typing over adb requires switching the IME** — and you must restore it afterwards; never leave ADB Keyboard selected):

```bash
adb shell ime set com.android.adbkeyboard/.AdbIME
adb shell am broadcast -a ADB_CLEAR_TEXT
adb shell am broadcast -a ADB_INPUT_B64 --es msg "$(printf '%s' "文字" | base64 -w0)"
adb shell ime set <用户原输入法包名/类名>        # never skip this
```

- Tap the field first so it has focus; broadcasting without switching IME silently does nothing — the #1 failure mode.
- `ADB_INPUT_B64` is more reliable than `ADB_INPUT_TEXT`; non-ASCII **must** be base64.
- Check the original IME **before** switching (`adb shell settings get secure default_input_method`) so you can restore exactly the right one.

## 5. Identify elements correctly (dual identification)

Text-only matching clicks the wrong thing. Real case: a draft in an **EditText** contained the word "发送", so the matcher tapped the compose box and verification was a false positive.

Require **multiple** signals before tapping:

- `resourceId` **and** `className` together — never text alone.
- From a text/desc match, walk **up to the nearest clickable ancestor** and tap *its* bounds centre.
- **Exclude** any node whose class contains `EditText` when you are matching message or field text.
- A label may exist **only** in `contentDescription`, with `text` truncated — match desc first, then text.
- Two nodes can carry the same string (title bar vs. list row, draft vs. sent bubble): the target is the one that is
  clickable / inside the list, never a toolbar label.
- Verify with two independent checks (e.g. the input became empty **and** the text now shows in a non-EditText node).

## 6. Screenshots / files

Both channels are verified working; use adb for a file you can `read`, Portal when adb is down.

```bash
adb exec-out screencap -p > ~/shot.png        # never `adb shell screencap` (breaks binary)
~/portal/pctl.sh shot ~/p.png                 # Portal (needs no adb); script decodes the
                                              # {"status":"success","result":"<base64>"} envelope
adb pull "$M/data/substates/GameOver.hx" ~/GameOver.hx
adb push ~/GameOver.hx "$M/data/substates/GameOver.hx"
adb shell "md5sum '$M/data/substates/GameOver.hx'"   # always verify after push
```

- `/sdcard/Android/data/...` is only reachable through adb.
- OpenFL/self-drawn games expose no accessibility nodes — screenshot and eyeball it.

## 7. Pitfalls

1. adb disconnects often and the wireless port changes; Portal survives that.
2. Termux's floating window steals accessibility focus → dumps come back as `com.termux`.
3. Never `adb shell screencap` (must be `exec-out`).
4. Keep script files CRLF; `cp -n` before editing; verify md5 after pushing.
5. Check the foreground app before every tap.
6. `termux-toast` needs Termux:API + `SYSTEM_ALERT_WINDOW` (both already granted here).
7. If a `phone_screenshot` / `phone_dump_ui annotate` call ever fails with a base64 or HTTP 400 error, the plugin lost its `file://` → `data:` image patch: run `bash ~/fix_mobile_use.sh` then `opencode service restart` (a bad image part in history breaks every later message).

## 8. Existing scripts — read them, never hand over control

| Script | What it is |
|---|---|
| `pq`（见 `phone-ops` 技能） | 通用操作入口：now/ui/find/tap/type/typein/wait/scrollto/shot/app/key/media/step（自动滑屏查找 + 回读验证） |
| `~/portal/pctl.sh` | the Portal HTTP client — pq 的下层通道 |

These are **reference implementations, not the engine**. Do it yourself, one step at a time, on the tree you just read.
Never answer "there's a script for that, run it" and never fire a whole script at a screen you have not just confirmed —
the user has rejected that explicitly.
