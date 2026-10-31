#!/usr/bin/env python3
"""meow-memory 的本地版：七层记忆 + 关键词检索 + 去重 + 整理。

数据：~/.config/opencode/state/meow-memory/memory.json
条目：{id, layer, content, project, keywords[], importance, status, created_at, updated_at}
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import datetime

DB = os.path.expanduser("~/.config/opencode/state/meow-memory/memory.json")
LAYERS = ["soul", "user", "project", "fact", "lesson", "topic", "rules"]
STATUS = ["active", "archived"]

TOKEN = re.compile(r"[\u4e00-\u9fff]{2,}|[A-Za-z]{2,}|\d+")


def ts() -> float:
    return time.time()


def day(t: float) -> str:
    return datetime.fromtimestamp(t).strftime("%Y-%m-%d")


def load() -> list[dict]:
    try:
        with open(DB, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else data.get("items", [])
    except Exception:
        return []


def save(items: list[dict]) -> None:
    os.makedirs(os.path.dirname(DB), exist_ok=True)
    tmp = DB + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    os.replace(tmp, DB)


def norm(s: str) -> str:
    return re.sub(r"[\s，。、,.!?！？；;：:\"'“”‘’()（）\[\]]+", "", s.lower())


def similar(a: str, b: str) -> float:
    """粗粒度相似度：公共字符比例（中文足够用）。"""
    a, b = norm(a), norm(b)
    if not a or not b:
        return 0.0
    if a in b or b in a:
        return 1.0
    sa, sb = set(a), set(b)
    return len(sa & sb) / max(1, len(sa | sb))


def next_id(items: list[dict]) -> str:
    prefix = datetime.now().strftime("%Y%m%d")
    n = sum(1 for it in items if it["id"].startswith(prefix)) + 1
    return f"{prefix}-{n}"


def split_keywords(raw: str) -> list[str]:
    return [k.strip() for k in re.split(r"[,，、;；\s]+", raw or "") if k.strip()][:8]


def find_arg(argv: list[str], key: str) -> str | None:
    for i, a in enumerate(argv):
        if a == "--" + key and i + 1 < len(argv):
            return argv[i + 1]
    return None


def has_flag(argv: list[str], key: str) -> bool:
    return ("--" + key) in argv


def positional(argv: list[str]) -> list[str]:
    out, skip = [], False
    for a in argv:
        if skip:
            skip = False
            continue
        if a.startswith("--"):
            skip = True
            continue
        out.append(a)
    return out


def cmd_remember(argv: list[str]) -> int:
    layer = find_arg(argv, "layer") or "fact"
    content = find_arg(argv, "content") or (positional(argv)[0] if positional(argv) else "")
    if not content:
        print("缺少 --content", file=sys.stderr)
        return 2
    if layer not in LAYERS:
        print("未知层：" + layer, file=sys.stderr)
        return 2
    project = find_arg(argv, "project") or ""
    keywords = split_keywords(find_arg(argv, "keywords") or "")
    importance = int(find_arg(argv, "importance") or 3)
    items = load()

    for it in items:
        if it["layer"] != layer or it["status"] != "active":
            continue
        if (it.get("project") or "") != project:
            continue
        if similar(it["content"], content) >= 0.8:
            it["keywords"] = sorted(set(it["keywords"]) | set(keywords))
            it["importance"] = max(it["importance"], importance)
            it["content"] = it["content"] if len(it["content"]) >= len(content) else content
            it["updated_at"] = ts()
            save(items)
            print(json.dumps({"ok": True, "merged": True, "id": it["id"], "layer": layer},
                             ensure_ascii=False))
            return 0

    item = {
        "id": next_id(items),
        "layer": layer,
        "content": content,
        "project": project,
        "keywords": keywords,
        "importance": max(1, min(5, importance)),
        "status": "active",
        "created_at": ts(),
        "updated_at": ts(),
    }
    items.append(item)
    save(items)
    print(json.dumps({"ok": True, "merged": False, "id": item["id"], "layer": layer},
                     ensure_ascii=False))
    return 0


def score(it: dict, q: str, q_tokens: list[str]) -> float:
    s = 0.0
    qn = norm(q)
    for kw in it.get("keywords", []):
        if kw and norm(kw) in qn:
            s += 3.0
    content = norm(it["content"])
    for t in q_tokens:
        if norm(t) and norm(t) in content:
            s += 0.8
    s += it.get("importance", 3) * 0.6
    age_days = max(0.0, (ts() - it.get("updated_at", ts())) / 86400)
    s += max(0.0, 2.0 - age_days / 30.0)
    return s


def cmd_search(argv: list[str]) -> int:
    q = find_arg(argv, "query") or " ".join(positional(argv))
    if not q:
        print("缺少 --query", file=sys.stderr)
        return 2
    project = find_arg(argv, "project")
    layer = find_arg(argv, "layer")
    days = int(find_arg(argv, "days") or 0)
    topk = int(find_arg(argv, "top") or 2)
    tokens = TOKEN.findall(q)
    out = []
    for it in load():
        if it["status"] != "active":
            continue
        if layer and it["layer"] != layer:
            continue
        if project is not None and (it.get("project") or "") not in ("", project):
            continue
        if days and (ts() - it["updated_at"]) > days * 86400:
            continue
        sc = score(it, q, tokens)
        if sc <= it.get("importance", 3) * 0.6 + 0.4:  # 只有时间/重要度分，没有真实命中
            continue
        out.append((sc, it))
    out.sort(key=lambda x: -x[0])
    print(json.dumps({
        "query": q,
        "hits": [{"score": round(s, 1), **{k: it[k] for k in ("id", "layer", "content", "project", "importance")},
                  "updated": day(it["updated_at"])} for s, it in out[:topk]],
        "total_active": sum(1 for i in load() if i["status"] == "active"),
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_list(argv: list[str]) -> int:
    layer = find_arg(argv, "layer")
    project = find_arg(argv, "project")
    items = [it for it in load()
             if it["status"] == "active"
             and (not layer or it["layer"] == layer)
             and (project is None or (it.get("project") or "") == project)]
    items.sort(key=lambda it: (-it["importance"], -it["updated_at"]))
    print(json.dumps([{"id": it["id"], "layer": it["layer"], "content": it["content"][:80],
                       "project": it.get("project") or "-", "imp": it["importance"],
                       "updated": day(it["updated_at"])} for it in items],
                     ensure_ascii=False, indent=2))
    return 0


def cmd_read(argv: list[str]) -> int:
    tid = find_arg(argv, "id")
    for it in load():
        if it["id"] == tid:
            print(json.dumps(it, ensure_ascii=False, indent=2))
            return 0
    print("没有这条记忆：" + str(tid), file=sys.stderr)
    return 1


def cmd_update(argv: list[str]) -> int:
    tid = find_arg(argv, "id")
    items = load()
    for it in items:
        if it["id"] != tid:
            continue
        if find_arg(argv, "content") is not None:
            it["content"] = find_arg(argv, "content")
        if find_arg(argv, "importance") is not None:
            it["importance"] = max(1, min(5, int(find_arg(argv, "importance"))))
        if find_arg(argv, "status") is not None:
            st = find_arg(argv, "status")
            it["status"] = st if st in STATUS else it["status"]
        if find_arg(argv, "keywords") is not None:
            it["keywords"] = split_keywords(find_arg(argv, "keywords"))
        if find_arg(argv, "project") is not None:
            it["project"] = find_arg(argv, "project")
        if find_arg(argv, "layer") is not None:
            it["layer"] = find_arg(argv, "layer")
        it["updated_at"] = ts()
        save(items)
        print(json.dumps({"ok": True, "id": tid}, ensure_ascii=False))
        return 0
    print("没有这条记忆：" + str(tid), file=sys.stderr)
    return 1


def cmd_dream(argv: list[str]) -> int:
    items = load()
    merged = archived = 0
    alive = [it for it in items if it["status"] == "active"]

    # 1. 同层同项目内合并高相似条目
    keep: list[dict] = []
    for it in alive:
        hit = next((k for k in keep
                    if k["layer"] == it["layer"]
                    and (k.get("project") or "") == (it.get("project") or "")
                    and similar(k["content"], it["content"]) >= 0.85), None)
        if hit:
            hit["keywords"] = sorted(set(hit["keywords"]) | set(it["keywords"]))
            hit["importance"] = max(hit["importance"], it["importance"])
            hit["updated_at"] = ts()
            it["status"] = "archived"
            merged += 1
        else:
            keep.append(it)

    # 2. 归档过期低价值条目（>120 天且 importance<=2，topic 90 天）
    for it in alive:
        if it["status"] != "active":
            continue
        age = (ts() - it["updated_at"]) / 86400
        limit = 90 if it["layer"] == "topic" else 120
        if age > limit and it["importance"] <= 2:
            it["status"] = "archived"
            archived += 1

    save(items)
    print(json.dumps({
        "ok": True,
        "merged": merged,
        "archived": archived,
        "active": sum(1 for i in items if i["status"] == "active"),
        "total": len(items),
    }, ensure_ascii=False, indent=2))
    return 0


def main(argv: list[str]) -> int:
    if not argv or argv[0] in ("-h", "--help", "help"):
        print(__doc__)
        return 0
    cmd, rest = argv[0], argv[1:]
    table = {
        "remember": cmd_remember, "add": cmd_remember,
        "search": cmd_search, "find": cmd_search,
        "list": cmd_list, "ls": cmd_list,
        "read": cmd_read, "show": cmd_read,
        "update": cmd_update, "set": cmd_update,
        "dream": cmd_dream, "tidy": cmd_dream,
    }
    fn = table.get(cmd)
    if not fn:
        print("未知命令：" + cmd, file=sys.stderr)
        return 2
    return fn(rest)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
