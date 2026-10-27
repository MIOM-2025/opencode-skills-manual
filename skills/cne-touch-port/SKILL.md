---
name: cne-touch-port
description: Turn an existing Codename Engine touch/mobile repo into a port of another mod — duplicate the template repo without uploading 500 MB, rename app/package/save paths, replace the bundled mod, update build workflows, build via GitHub Actions, and push. Use for requests like「以这个仓库为模板」「改成 XXX Port」「把 mod 放进仓库」「复刻后改包名」「重新构建 APK」.
---

# Codename Engine Touch Port

Use this when a full Codename Engine mobile repo already builds, and the user wants a **new port** based on it.

## 1. Duplicate the template without a huge upload

If the template is owned by the same account, GitHub cannot fork it to itself. Use the template-generate API instead; it copies files server-side.

```sh
# temporarily mark the source as a template
gh api -X PATCH repos/OWNER/SOURCE -f is_template=true

gh api -X POST repos/OWNER/SOURCE/generate \
  -f owner=OWNER -f name=NEW-REPO \
  -f description='...' -F private=false

# always put the flag back
gh api -X PATCH repos/OWNER/SOURCE -f is_template=false
```

Then clone the **new** repo. For large repos use depth 1 and HTTP/1.1; the default HTTP/2/TLS path often dies on this phone:

```sh
git -c http.version=HTTP/1.1 clone --depth 1 \
  https://github.com/OWNER/NEW-REPO.git
```

## 2. Rename the port (checklist)

Search outside the mod folder first:

```sh
grep -RniE 'OLD[- ]?PORT|oldpackage|old_file' \
  project.xml source .github README.md \
  --exclude-dir=OLD-MOD-FOLDER
```

Update all of these:

| File | What |
| --- | --- |
| `project.xml` | `title`, `file`, `packageName`, `package`, `version`, `company`, save paths |
| `source/funkin/backend/system/Main.hx` | `modToLoad` must equal the new `mods/<folder>` |
| `source/mobile/funkin/backend/utils/StorageUtil.hx` | `packageNameLocal`, `fileLocal` (fileLocal becomes `/.<folder>`) |
| `source/funkin/backend/system/Flags.hx` | `REPO_OWNER`, `REPO_NAME` for update checks |
| `.github/workflows/android.yml` | trigger branch `main`, artifact name |
| `.github/workflows/ios.yml` | branch, app/bundle paths, artifact name |
| `README.md` | title, mod folder, package ID, build steps |
| `art/icon*.png` + `project.xml` icon refs | replace template icons with the new mod icon |
| `mods/<folder>/data/config/modpack.ini` | NAME / DESCRIPTION / AUTHOR / VERSION / DOWNLOAD_LINK |

Package ID rules: lowercase, dot-separated Java segments, no leading digit. Example: `com.elmoreendingpain.port`.

## 3. Replace the bundled mod

Keep the template's `mods/readme.txt`, remove the old mod folder, add the new one.

```sh
git rm -r mods/OLD-MOD
mkdir -p mods/NEW-MOD
# copy the working mod, excluding local git and backups
tar -C "$SRC" \
  --exclude=.git --exclude='*.bak' --exclude='*.bakvhs' \
  -cf - . | tar -C "mods/NEW-MOD" -xf -
git add -f mods/NEW-MOD
```

`mods/*` is usually git-ignored, so **`-f` is required**.

Do not package `.git`, `*.bak*`, empty debug scripts, or unreferenced test videos.

## 4. Common mod-side fixes

### Censor-aware health icon

Read the warning-screen save flag, not a hardcoded image:

```haxe
var censorHealth:Bool = (FlxG.save.data != null && FlxG.save.data.censorHealth == true);
var heartAsset:String = censorHealth ? "hud/life2" : "hud/heart";
if (censorHealth && !Assets.exists(Paths.image(heartAsset))) heartAsset = "hud/heart";
heart = new FlxSprite(...).loadGraphic(Paths.image(heartAsset));
```

Default is off; missing replacement must fall back to the original.

### Curvature-only logo

Do **not** put the full VHS shader back on `camChain` if the user only wants the bend. Add a shader that only warps UVs, then:

```haxe
if (vhsCurve) {
    camChain.addShader(curveShader);
    curveShader.setFloat("uCurvature", 4.0);
}
```

Use the same `applyCurvature` math as the VHS shader so both match.

## 5. Build and verify

The Android workflow must trigger on `main`; the template often says `master`.

```sh
gh run list -R OWNER/NEW-REPO --limit 5
gh run view <run-id> -R OWNER/NEW-REPO --json status,conclusion,jobs
```

Wait for `Building the game` to finish. Do not call the port done until the APK artifact exists. If a run is stale after a newer push, cancel it to save runner time.

## 6. Push workaround

When Git HTTPS fails with `OpenSSL SSL_read: unexpected eof`:

1. Retry with `git -c http.version=HTTP/1.1 push origin main`.
2. If it still fails, create a temporary write deploy key:

```sh
ssh-keygen -t ed25519 -N '' -f ~/.ssh/github_tmp -C tmp
gh api repos/OWNER/REPO/keys \
  -f title=tmp -f key="$(cat ~/.ssh/github_tmp.pub)" -F read_only=false
GIT_SSH_COMMAND='ssh -i ~/.ssh/github_tmp -o StrictHostKeyChecking=no' \
  git push git@github.com:OWNER/REPO.git main
gh api -X DELETE repos/OWNER/REPO/keys/<id>
rm -f ~/.ssh/github_tmp ~/.ssh/github_tmp.pub
```

Always delete the temporary key.

## Pitfalls

- `mods/` is ignored by `.gitignore`; tracked files still ship, but new files need `git add -f`.
- Git on Android may normalize CRLF; text files are fine, binaries are unaffected.
- Do not edit the template repo's content. Only toggle `is_template` briefly and revert it.
- A 500 MB template may report `size: 0` briefly after generation; check `contents` before assuming failure.
- The app package name and `StorageUtil.packageNameLocal` must match exactly, or Android data paths break.
- `fileLocal` is used for `/.<mod>`; keep it consistent with `project.xml`'s `file`.

## 环境要求

| 项目 | 要求 |
| --- | --- |
| 运行时 | `gh`（已登录）+ `git`；一个能构建的 Codename Engine touch 仓库 |
| 系统命令 | `grep`、`git`、`gh` |
| 构建 | GitHub Actions（生成 APK）；大仓库用 `--depth 1` + HTTP/1.1 |
| 权限 | 仓库 `repo` + `workflow` scope（template generate、push、Actions） |
| 网络 | GitHub |
| 磁盘 | 模板仓库可达数百 MB，注意剩余空间 |

