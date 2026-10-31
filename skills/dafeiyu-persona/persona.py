#!/usr/bin/env python3
"""人设库（dsh-persona-dafeiyu 的本地版）。

正文：~/.config/opencode/skills/dafeiyu-persona/personas/<id>.md
状态：~/.config/opencode/state/persona.json
生效范围：session > workspace > global
"""
from __future__ import annotations

import json
import os
import re
import shutil
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(BASE, "personas")
STATE = os.path.expanduser("~/.config/opencode/state/persona.json")

BUILTIN = {
    "dafeiyu": "大肥鱼（插件原版）· 圆滚滚胖鱼，傲娇 + 软弱，偷吃 token",
    "dafeiyu-qq": "大肥鱼（群聊版）· 蓝发小鲸鱼娘，QQ 群友，短句毒舌",
}


def load_state() -> dict:
    try:
        with open(STATE, encoding="utf-8") as f:
            st = json.load(f)
    except Exception:
        st = {}
    st.setdefault("enabled", True)
    st.setdefault("global", "dafeiyu")
    st.setdefault("workspaces", {})
    st.setdefault("sessions", {})
    return st


def save_state(st: dict) -> None:
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    tmp = STATE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(st, f, ensure_ascii=False, indent=2)
    os.replace(tmp, STATE)


def path_of(pid: str) -> str:
    return os.path.join(DIR, pid + ".md")


def title(path: str) -> str:
    try:
        with open(path, encoding="utf-8") as f:
            first = f.readline().strip()
    except Exception:
        return ""
    m = re.match(r"^#\s*(?:人设[:：]\s*)?(.+)$", first)
    return m.group(1).strip() if m else ""


def catalog() -> dict:
    out = {}
    if os.path.isdir(DIR):
        for fn in sorted(os.listdir(DIR)):
            if fn.endswith(".md"):
                pid = fn[:-3]
                out[pid] = {"name": title(os.path.join(DIR, fn)) or pid,
                            "builtin": pid in BUILTIN}
    return out


def resolve(st: dict, session: str | None, workspace: str | None) -> tuple[str | None, str]:
    if session and session in st["sessions"]:
        return st["sessions"][session], "session"
    ws = workspace or os.getcwd()
    if ws in st["workspaces"]:
        return st["workspaces"][ws], "workspace"
    return st["global"], "global"


def main(argv: list[str]) -> int:
    st = load_state()
    cmd = argv[0] if argv else "list"
    args = argv[1:]

    session = None
    workspace = None
    scope = None
    name = None
    rest: list[str] = []
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--session" and i + 1 < len(args):
            session = args[i + 1]; i += 2
        elif a == "--workspace" and i + 1 < len(args):
            workspace = args[i + 1]; i += 2
        elif a == "--scope" and i + 1 < len(args):
            scope = args[i + 1]; i += 2
        elif a == "--name" and i + 1 < len(args):
            name = args[i + 1]; i += 2
        else:
            rest.append(a); i += 1

    if cmd == "list":
        cat = catalog()
        cur, where = resolve(st, session, workspace)
        print(json.dumps({
            "enabled": st["enabled"],
            "current": cur,
            "scope": where,
            "global": st["global"],
            "workspaces": st["workspaces"],
            "sessions": st["sessions"],
            "personas": [{"id": k, **v, "current": k == cur} for k, v in cat.items()],
        }, ensure_ascii=False, indent=2))
        return 0

    if cmd in ("show", "current"):
        cur, where = resolve(st, session, workspace)
        if not st["enabled"]:
            print(json.dumps({"enabled": False, "note": "人设已临时关闭（persona.py on 恢复）"},
                             ensure_ascii=False))
            return 0
        if not cur or not os.path.exists(path_of(cur)):
            print(json.dumps({"error": "没有可用人设", "current": cur}, ensure_ascii=False))
            return 1
        with open(path_of(cur), encoding="utf-8") as f:
            body = f.read()
        print(json.dumps({"id": cur, "scope": where, "enabled": True}, ensure_ascii=False))
        print(body)
        return 0

    if cmd == "on":
        st["enabled"] = True
        save_state(st)
        print("人设已开启")
        return 0

    if cmd == "off":
        st["enabled"] = False
        save_state(st)
        print("人设已临时关闭（正文保留，on 恢复）")
        return 0

    if cmd == "set":
        pid = rest[0] if rest else ""
        if pid not in catalog():
            print("没有人设：" + pid, file=sys.stderr)
            return 2
        st["enabled"] = True
        scope = scope or ("session" if session else "workspace" if workspace else "global")
        if scope == "session":
            if not session:
                print("--scope session 需要 --session <key>", file=sys.stderr)
                return 2
            st["sessions"][session] = pid
        elif scope == "workspace":
            st["workspaces"][workspace or os.getcwd()] = pid
        else:
            st["global"] = pid
        save_state(st)
        print(f"已切换：{pid}（{scope}，下一个回复即时生效）")
        return 0

    if cmd == "import":
        src = rest[0] if rest else ""
        if not src or not os.path.exists(src):
            print("找不到文件：" + src, file=sys.stderr)
            return 2
        with open(src, encoding="utf-8") as f:
            body = f.read()
        label = (name or title(src) or os.path.basename(src)).strip()
        pid = re.sub(r"[\s/\\:*?\"<>|]+", "-", label).strip("-")
        if not pid or not re.search(r"[A-Za-z0-9\u4e00-\u9fff]", pid):
            pid = "persona-%d" % int(__import__("time").time())
        os.makedirs(DIR, exist_ok=True)
        with open(path_of(pid), "w", encoding="utf-8") as f:
            f.write(body if body.startswith("#") else f"# 人设：{label or pid}\n\n{body}")
        print(f"已导入：{pid}（persona.py set {pid} 启用）")
        return 0

    if cmd == "export":
        pid = rest[0] if rest else st["global"]
        dst = rest[1] if len(rest) > 1 else f"./{pid}.md"
        if not os.path.exists(path_of(pid)):
            print("没有人设：" + pid, file=sys.stderr)
            return 2
        shutil.copyfile(path_of(pid), dst)
        print("已导出：" + os.path.abspath(dst))
        return 0

    if cmd in ("-h", "--help", "help"):
        print(__doc__)
        return 0

    print("未知命令：" + cmd, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
