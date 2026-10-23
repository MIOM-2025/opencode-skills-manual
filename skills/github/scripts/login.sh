#!/usr/bin/env bash
# ghlogin — GitHub 设备授权登录，登录后自动配置 git 身份和工具 token
set -euo pipefail

SCOPES="${GH_SCOPES:-repo,read:org,gist,workflow}"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh 未安装。运行：pkg install gh" >&2
  exit 1
fi

if gh auth status >/dev/null 2>&1 && [ "${1:-}" != "--force" ]; then
  echo "已经登录，无需重复授权："
  gh auth status 2>&1 | sed 's/^/  /'
  exit 0
fi

echo "开始 GitHub 设备授权（会显示 8 位代码，并等待你在浏览器里确认）..."
echo

gh auth login --hostname github.com --git-protocol https --web --scopes "$SCOPES"

echo
echo "授权完成，配置 git 与 token ..."
gh auth setup-git >/dev/null 2>&1 || true

mkdir -p "$HOME/.config/github"
chmod 700 "$HOME/.config/github"
gh auth token >"$HOME/.config/github/token"
chmod 600 "$HOME/.config/github/token"

login="$(gh api user --jq .login)"
name="$(gh api user --jq '.name // .login')"
email="$(gh api user --jq '.email // empty')"
if [ -z "$email" ]; then
  id="$(gh api user --jq .id)"
  email="${id}+${login}@users.noreply.github.com"
fi

git config --global user.name "$name"
git config --global user.email "$email"
git config --global init.defaultBranch main 2>/dev/null || true

echo
echo "✅ GitHub 登录完成：@${login}（${name} <${email}>）"
gh auth status 2>&1 | sed 's/^/  /'
