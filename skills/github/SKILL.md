---
name: GitHub（搜索/仓库/Issue/PR/账户）
description: "Read and operate GitHub without opening a browser or running shell commands: search repositories/code/users, read README and any file, browse issues/PRs/releases/notifications, fork/star/clone, create repos, write files, publish local docs, open issues/comments/PRs on the user's account. Use whenever the user asks to look up a GitHub repo, read a README, check issues/PRs, fork or clone a repository, publish files to GitHub, or manage their GitHub account — including Chinese requests like「看看这个 GitHub 仓库」「读一下 README」「帮我 fork」「发到 GitHub」「管理我的 GitHub」."
---

# GitHub — 全部用工具完成，不需要命令提示符

> 原则：**能用 `github.*` 工具就不开 shell**。读、写、建仓库、发文件、发 Issue/PR 都有对应工具；只有需要本地 git 历史（clone 后改代码再 push）时才落到命令行。

登录态配好后（账号 @your-account），工具直接调用即可。

## 工具清单（23 个）

**读**

| 工具 | 用途 |
| --- | --- |
| `github.status` | 当前账号、token、API 配额 |
| `github.search` | 搜仓库/代码/Issue/用户/提交 |
| `github.repo` | 仓库详情，`readme:true` 带 README |
| `github.readme` | README 原文（可指定分支） |
| `github.file` | 任意文件原文 |
| `github.tree` | 目录列表 |
| `github.issues` / `github.issue` | Issue 列表 / 正文+评论 |
| `github.pulls` / `github.pr` | PR 列表 / 详情+改动文件+评论 |
| `github.releases` | Release 与附件 |
| `github.notifications` | 未读通知，可标已读 |
| `github.user` | 用户/组织资料 |

**写（先跟用户确认内容）**

| 工具 | 用途 |
| --- | --- |
| `github.repo_create` | 新建公开/私有仓库（可建在组织下） |
| `github.put_file` | 新建或更新单个文件（自动处理 sha） |
| `github.push_local` | 本机文件批量上传，一次提交，不需要 git |
| `github.fork` | 复刻到自己的账号/组织 |
| `github.star` | 收藏 / 取消收藏 |
| `github.issue_create` | 新建 Issue |
| `github.comment` | 在 Issue/PR 下评论 |
| `github.pr_create` | 创建 PR（head 分支需已存在） |
| `github.clone` | 克隆到 `~/repos/<name>` |
| `github.api` | 兜底：任意 REST 接口 |

## 典型用法

**读一个仓库**

```
github.repo({repo:"termux/termux-app", readme:true})
github.tree({repo:"termux/termux-app", path:"app/src/main"})
github.file({repo:"termux/termux-app", path:"README.md"})
```

**搜代码**

```
github.search({query:"registerReceiver in:file language:java", type:"code"})
```

**查 Issue / PR**

```
github.issues({repo, state:"open", labels:"bug", limit:20})
github.issue({repo, number:205, comments:10})
github.pr({repo, number:45})
```

**发布文档到公开仓库（全程工具，无 shell）**

```
github.repo_create({name:"opencode-skills-manual", description:"…"})
github.put_file({repo:"your-account/opencode-skills-manual", path:"README.md", content:"…"})
github.push_local({
  repo:"your-account/opencode-skills-manual",
  files:[{local:"~/.config/opencode/skills/github/SKILL.md", remote:"skills/github/SKILL.md"}],
  message:"docs: add github skill",
})
```

`push_local` 会用 Git Data API 建 tree → commit → 更新 ref，所以**不需要 `git init/add/commit/push`**。

**Fork → 改 → PR**

```
github.fork({repo:"owner/project"})
github.clone({repo:"your-account/project"})
# 本地改文件（read/write 工具）
# 需要 git 时才用: git switch -c fix/typo && git commit && git push
github.pr_create({repo:"owner/project", title:"fix: typo", head:"your-account:fix/typo"})
```

## 命令行只留三类事

真正需要 shell 的只有：本地 `git` 历史操作（commit/push/rebase）、跑测试、`gh` 专属子命令。它们是备用通道，不是主路径：

```bash
ghs help          # 一次性查看等价命令
gh pr create      # git 流程里建 PR
```

## 登录（已完成的不用再跑）

```bash
ghlogin           # 设备授权；完成后自动配置 git 凭据 + token
```

- token 在 `~/.config/github/token`（600）和 `~/.config/gh/hosts.yml`
- 默认 scope：`repo, read:org, gist, workflow`
- 配额：登录后 5000 次/小时；`github.status` 可看剩余

## 注意

- fork/star/建 Issue/评论/建 PR 都是公开动作，执行前把目标、标题、正文念给用户确认
- 不要 force push 到别人的仓库；不要往默认分支直推大改动；不要删别人的分支/Release
- 私有仓库读不到时先怀疑权限（404 对未授权仓库是正常返回），别反复重试
- `push_local` 只支持文本文件，单文件 ≤2MB、总量 ≤20MB、一次 ≤100 个
- 403 + `rate limit` = 配额用完，`github.status` 看重置时间，别继续打

## 环境要求

| 项目 | 要求 |
| --- | --- |
| 运行时 | OpenCode 插件运行时（Bun）；`gh` CLI 2.40+；`git` 2.30+；`jq`（命令行 `ghs` 用） |
| 认证 | 执行 `gh auth login --web`（设备码），scope：`repo`、`read:org`、`gist`、`workflow` |
| 凭证文件 | `~/.config/gh/hosts.yml`；可选 `~/.config/github/token`（权限 600） |
| 网络 | 可访问 `api.github.com`、`github.com` |
| 配额 | 登录后 5000 次/小时；未登录 60 次/小时，且不能写 |
| 本地目录 | `~/repos/`（`github.clone` 的默认目标） |

