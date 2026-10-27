---
name: cne-vhs-filter
description: Add a switchable VHS/CRT shader filter and a matching alternate health icon to a Codename Engine mod, with a default old shader, an optional striped/new shader, live switching, and no beat scaling for the alternate icon. Use for「加个滤镜」「新旧着色器切换」「New VHS Filter」「生命图标二不要跟节拍缩放」.
---

# Codename Engine: Switchable VHS Filter + Alternate HUD Icon

Keep the **old shader as default** and make any new/striped shader opt-in. A save flag must drive every camera, menu, game-over screen, and video overlay.

## 1. Keep two shader files

```text
shaders/vhs.frag       # old/default
shaders/vhs_new.frag   # optional new/striped
```

Do not overwrite the default. If the user supplies one text file with two labeled shader blocks, use the **filter-off** block as `vhs.frag` and the **filter-on** block as `vhs_new.frag`. If the filter-on block uses a different corner/curvature formula, replace its `applyCurvature()` with the filter-off version so both screens have identical edges. Verify both compile:

```sh
# strip #pragma and wrap with a minimal GLSL ES stub, then run glslangValidator
```

## 2. One save flag

Use a boolean such as `vhsNew`, default **false**:

```haxe
var vhsNew:Bool = (FlxG.save.data != null && FlxG.save.data.vhsNew == true);
var shaderName:String = vhsNew ? "vhs_new" : "vhs";
```

Add a one-time migration so an upgrade does not leave the old value enabled. Bump the integer whenever the shader set changes:

```haxe
if (FlxG.save.data != null && Reflect.field(FlxG.save.data, "vhsNewVersion") != 2) {
    Reflect.setField(FlxG.save.data, "vhsNew", false);
    Reflect.setField(FlxG.save.data, "vhsNewVersion", 2);
    FlxG.save.flush();
}
```

## 3. Apply it everywhere

Select the shader by name in:

- `songs/global.hx` (`camGame`, `camHUD`, Guilt video camera)
- the main menu and options menu cameras
- `GameOver` / death screen
- the warning-screen preview

Do **not** put full VHS on the logo camera if the request is curvature-only; use a separate curvature shader there.

## 4. Warning-screen checkbox with live switching

Add a fourth option:

```haxe
var labels = ["Censor Health Icons", "VHS Shader", "CRT Curvature", "New VHS Filter"];
var keys   = ["censorHealth", "vhsEnabled", "vhsCurve", "vhsNew"];
```

On toggle, remove the current shader and recreate it:

```haxe
function applyVhsSettings() {
    if (vhsShader != null) {
        try { FlxG.camera.removeShader(vhsShader); } catch (e:Dynamic) {}
        vhsShader = null;
    }
    if (!vhsOn) return;
    vhsShader = new CustomShader(vhsNew ? "vhs_new" : "vhs");
    FlxG.camera.addShader(vhsShader);
    try { vhsShader.setFloat("uInterlace", 1.0); } catch (e:Dynamic) {}
    try { vhsShader.setFloat("uCurvature", vhsCurve ? 4.0 : 0.0); } catch (e:Dynamic) {}
}
```

Call it for `vhsEnabled`, `vhsCurve`, and `vhsNew`. Persist the checkbox with `FlxG.save.flush()`.

## 5. Alternate health icon (`life2`)

- Pick `hud/life2` only when the censor option is on and the asset exists; otherwise fall back to `hud/heart`.
- Match the original heart canvas exactly (this mod: **233×371**). Keep the new art's aspect ratio, pad with transparent pixels, and center it; do not stretch the heart to fill the canvas. A 10:9 pixel heart at max width becomes 230×207 inside 233×371.
- If the user supplies a plain pixel heart, preserve its pixel pattern and regenerate at the target canvas instead of resampling the larger PNG. Preview the result in a self-contained HTML file before committing.
- Effects are optional: a plain pixel heart may be preferred over an RGB-split/VHS heart. The HUD VHS shader already adds global distortion.
- If the alternate icon is active, **do not scale it on `beatHit`** and do not lerp it in `postUpdate`; the health bars may still pulse.

```haxe
var usingLife2:Bool = false;
...
usingLife2 = (heartAsset == "hud/life2");
...
if (!usingLife2) heart.scale.set(0.63, 0.63);
...
if (!usingLife2) heart.scale.set(lerp(heart.scale.x, 0.55, 0.2), ...);
```

## 6. Verify

- Default state: old shader, `New VHS Filter` unchecked.
- Toggle on: stripes/new shader appear immediately on the warning screen.
- Toggle off: old shader returns immediately.
- Censor Health on + `life2` present: icon changes and stays static.
- Censor Health on + `life2` absent: original heart, no crash.
- Apply changes to the local shared engine **and** the repo; do not rebuild the APK unless asked.
- On this phone, the Codename Engine Android build reads `/sdcard/.CodenameEngine/mods/<Mod>/` (the external shared folder), not necessarily the app-private copy. Sync the changed files there and verify hashes.

## 环境要求

| 项目 | 要求 |
| --- | --- |
| 运行时 | Codename Engine 模组（Haxe / Flixel）源码 |
| 文件 | `shaders/vhs.frag`、`shaders/vhs_new.frag`、HUD 图标资源 |
| 可选 | `glslangValidator`（校验 shader 编译） |
| 权限 | 能写模组目录（本地仓库，或 ADB/Portal 推送到 app 私有目录） |
| 网络 | 不需要 |

