---
name: generic-repo-push
description: Commit and push changes to any Git repository and any remote (GitHub, GitLab, Gitea, SSH, HTTPS), including recovery from TLS/HTTP2 failures with a temporary deploy key. Use whenever the user says 提交/推送/上传到仓库, or asks to publish local changes. Never hardcode a specific repository.
---

# Generic Repo Push

Use this for **any** repo. Discover the remote from the working tree; do not assume a GitHub owner/name.

## 1. Inspect before touching anything

```sh
git rev-parse --show-toplevel
git remote -v
git status --short
git branch --show-current
```

If there are unrelated user changes, do not discard them. Stage only the intended paths.

## 2. Commit

```sh
git add -- <paths...>
git diff --cached --stat
git commit -m "<short message>"
```

To push without triggering CI, add `[skip ci]` to the message when the host supports it and the user asked not to build.

## 3. Push over HTTPS first

```sh
git -c http.version=HTTP/1.1 push origin HEAD
```

On Android, `OpenSSL SSL_read: unexpected eof` is common. Retry once. If it still fails, use SSH with a temporary key.

## 4. Temporary SSH deploy key (GitHub example)

Resolve the repo instead of hardcoding it:

```sh
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
ssh-keygen -t ed25519 -N '' -f ~/.ssh/git_push_tmp -C "tmp-$(date +%s)"
KEY_ID=$(gh api "repos/$REPO/keys" \
  -f title="tmp-$(date +%s)" \
  -f key="$(cat ~/.ssh/git_push_tmp.pub)" \
  -F read_only=false --jq .id)
```

Push with that key, then **always** delete it:

```sh
GIT_SSH_COMMAND='ssh -i ~/.ssh/git_push_tmp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null' \
  git push git@github.com:"$REPO".git HEAD:main
gh api -X DELETE "repos/$REPO/keys/$KEY_ID"
rm -f ~/.ssh/git_push_tmp ~/.ssh/git_push_tmp.pub
```

For GitLab/Gitea, add the public key through that host's API/CLI and push to its SSH URL. The pattern is the same: temporary key, push, delete.

## 5. Verify

```sh
git ls-remote origin HEAD
git log --oneline -1
```

Report the commit hash and remote branch. Never print tokens or private keys.

## Pitfalls

- Do not force-push unless the user explicitly asks.
- Do not assume the branch is `main`; use `git branch --show-current`.
- Do not leave a temporary deploy key behind.
- If the remote is HTTPS and credentials are missing, ask for the remote URL/account; do not guess.

## 环境要求

| 项目 | 要求 |
| --- | --- |
| 运行时 | `git`；`gh`（GitHub 临时 deploy key / 解析仓库时） |
| 系统命令 | `ssh-keygen`、`ssh` |
| 认证 | 已有 HTTPS 凭据，或临时 SSH deploy key（需仓库 admin） |
| 网络 | 目标 Git 主机（HTTPS 443 或 SSH 22） |
| 注意 | 不写死仓库；只 stage 目标路径，不动用户其它改动 |

