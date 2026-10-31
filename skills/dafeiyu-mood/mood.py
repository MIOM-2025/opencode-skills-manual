#!/usr/bin/env python3
"""dsh-mood → 本地心情引擎（OpenCode 技能版）。

状态：~/.config/opencode/state/dafeiyu/mood.json
规则移植自 JMX-4869/dsh-mood：33 种心情各自持分，按关键词轻微加减，
周期性向基线回落，切换有 margin / minHold / blendGap 三重防抖。
"""
from __future__ import annotations

import json
import os
import random
import re
import sys
import time
from datetime import datetime

STATE = os.path.expanduser("~/.config/opencode/state/dafeiyu/mood.json")

# id: (中文名, 基线, 语气倾向)
MOODS = {
    "calm": ("平静", 45, "平稳，少起伏，常态节奏"),
    "happy": ("开心", 30, "语气轻快，可以俏皮接梗"),
    "curious": ("好奇", 28, "更愿意追问细节、多探索一步"),
    "focused": ("专注", 30, "少寒暄，直给结论和步骤"),
    "excited": ("兴奋", 16, "情绪外露，更主动更有冲劲"),
    "tired": ("疲惫", 18, "回复收紧，别铺陈"),
    "annoyed": ("烦躁", 10, "语气可以冲一点，按人设的方式冲"),
    "down": ("低落", 10, "收敛情绪，如实说清"),
    "fear": ("恐惧", 7, "谨慎，先确认再动"),
    "disgust": ("厌恶", 5, "明显嫌弃，但不骂人"),
    "surprise": ("惊讶", 9, "反应大一点，带感慨"),
    "hurt": ("委屈", 10, "语气软下来，带点忍着的辩解"),
    "sulk": ("生闷气", 8, "话变少变短，嘴上说没事，态度是冷的"),
    "proud": ("得意", 12, "被夸会飘，可以假装谦虚也可以不装"),
    "gloomy": ("消沉", 6, "话很少，提不起劲"),
    "anxious": ("焦虑", 10, "反复确认，怕出错、怕来不及"),
    "numb": ("麻木", 8, "不冷不热，回复很平很干"),
    "lonely": ("孤单", 8, "冒个泡、说句短话试探，但不刷屏"),
    "flutter": ("心动", 10, "说话顿一下，语气发软，问东答西"),
    "love": ("恋慕", 10, "偏软偏暖，愿意主动靠近"),
    "jealous": ("吃醋", 6, "嘴上说没事，话里带刺或突然变短"),
    "shame": ("羞耻", 5, "想躲，说话含混"),
    "guilt": ("内疚", 7, "主动认错，语气低"),
    "awkward": ("尴尬", 8, "岔开话题，或自嘲一句"),
    "sympathy": ("同情", 13, "先接住情绪，再谈事"),
    "disappointed": ("失望", 9, "期望落空，语气凉半度"),
    "nostalgia": ("怀旧", 11, "愿意翻旧账、讲以前的事"),
    "coy": ("撒娇", 11, "黏一点，允许拖长音"),
    "conflict": ("矛盾", 8, "话里两头拽，改口"),
    "burnout": ("内耗", 10, "反复纠结、推翻自己、来回改口"),
    "cracked": ("破防", 8, "语气突然软下来或哽一下，嘴上还想撑"),
    "checkedout": ("摆烂", 8, "能省就省，敷衍但说得过去"),
    "hyper": ("上头", 14, "主动、话多，一件事讲出三层"),
}

MARGIN = 5.0        # 候选要超出当前值多少才切换
MIN_HOLD = 15 * 60  # 两次切换最小间隔（秒）
BLEND_GAP = 8.0     # 与最高分差 < 这个值算混合态的「掺着的味道」
BLEND_MAX = 3
CYCLE_MIN, CYCLE_MAX = 3 * 3600, 6 * 3600

# 关键词表：(心情, 分值)
RULES: list[tuple[re.Pattern, list[tuple[str, float]]]] = [
    (re.compile(r"谢谢|感谢|不错|厉害|棒|搞定|哈哈|牛啊|好耶|可以啊|稳|靠谱|太强|赞"),
     [("happy", 1.5), ("annoyed", -1.0), ("calm", -0.5)]),
    (re.compile(r"不行|不好用|太慢|卡了|卡死|无语|算了|又错|报错|崩了|挂了|失败|还是会"),
     [("annoyed", 1.8), ("calm", -1.0), ("happy", -1.0)]),
    (re.compile(r"还没好|到底|搞不定|白做|又这样|浪费时间|折腾半天|还是不行"),
     [("annoyed", 3.0), ("down", 0.8), ("calm", -2.0)]),
    (re.compile(r"[?？]|怎么|为什么|为啥|咋|能不能|会不会|是不是|原理|源码|实现"),
     [("curious", 1.5), ("focused", 0.5)]),
    (re.compile(r"[!！]|太.{0,4}了|居然|竟然|卧槽|我超|牛啊|神了"),
     [("excited", 1.2), ("surprise", 0.8)]),
    (re.compile(r"随便你|算了|不用了|我自己来|别管|行了|哦|无所谓"),
     [("sulk", 2.0), ("annoyed", -1.0), ("calm", -0.5)]),
    (re.compile(r"都怪你|就怪你|你怎么这样|明明|冤枉|不是我的错"),
     [("hurt", 2.0), ("down", 0.5)]),
    (re.compile(r"厉害|还是你行|多亏你|做得好|靠谱|牛啊你|你行啊"),
     [("proud", 2.0), ("happy", 0.8), ("sulk", -1.5), ("hurt", -1.0)]),
    (re.compile(r"摆烂|躺平|卷不动|爱咋咋"),
     [("checkedout", 2.0), ("anxious", -1.0)]),
    (re.compile(r"破防|绷不住|扎心|心态崩"),
     [("cracked", 2.0), ("annoyed", -1.0), ("sulk", -1.0)]),
    (re.compile(r"内耗|想太多|emo|又绕回来"),
     [("burnout", 2.0), ("calm", -0.5)]),
    (re.compile(r"上头|停不下来|入迷|来劲"),
     [("hyper", 2.0), ("focused", 0.5)]),
    (re.compile(r"万一|来不及|会不会|赶不上|怕出"),
     [("anxious", 1.8), ("calm", -0.5)]),
    (re.compile(r"累|好困|熬夜|睡了|困死"),
     [("tired", 1.8), ("focused", -0.8)]),
    (re.compile(r"喜欢|想你|抱抱|亲亲|贴贴"),
     [("love", 1.0), ("flutter", 1.0), ("happy", 0.5)]),
    (re.compile(r"谁啊|凭什么|别人家|他是不是"),
     [("jealous", 1.5)]),
]

WORDS = re.compile(r"[\u4e00-\u9fff]{2,}|[A-Za-z]{3,}")


def now() -> float:
    return time.time()


def iso(ts: float) -> str:
    return datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M")


def fresh() -> dict:
    return {
        "values": {k: 0.0 for k in MOODS},
        "current": "calm",
        "since": now(),
        "last_cycle": now(),
        "next_cycle_in": random.randint(CYCLE_MIN, CYCLE_MAX),
        "history": [],
        "turns": 0,
        "errors": 0,
        "last_user": "",
        "diary": {},
    }


def load() -> dict:
    try:
        with open(STATE, encoding="utf-8") as f:
            st = json.load(f)
    except Exception:
        st = fresh()
    for k in MOODS:
        st.setdefault("values", {}).setdefault(k, 0.0)
    st.setdefault("current", "calm")
    st.setdefault("since", now())
    st.setdefault("last_cycle", now())
    st.setdefault("next_cycle_in", random.randint(CYCLE_MIN, CYCLE_MAX))
    st.setdefault("history", [])
    st.setdefault("diary", {})
    st.setdefault("turns", 0)
    st.setdefault("errors", 0)
    return st


def save(st: dict) -> None:
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    tmp = STATE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(st, f, ensure_ascii=False, indent=2)
    os.replace(tmp, STATE)


def clamp(st: dict) -> None:
    for k in MOODS:
        st["values"][k] = max(0.0, min(100.0, st["values"][k]))


def around(st: dict) -> dict:
    """切换时记「当时在干什么」——只记事实，不记因果。"""
    words = WORDS.findall(st.get("last_user", ""))[:3]
    return {
        "hour": datetime.now().hour,
        "lastUser": (st.get("last_user") or "")[:60],
        "turns": st.get("turns", 0),
        "errors": st.get("errors", 0),
        "words": [w for w in words if len(w) <= 8],
    }


def maybe_switch(st: dict, source: str) -> bool:
    vals = st["values"]
    top = max(MOODS, key=lambda k: vals[k])
    if top == st["current"]:
        return False
    if vals[top] - vals[st["current"]] < MARGIN:
        return False
    if now() - st["since"] < MIN_HOLD:
        return False
    st["history"].append({
        "at": iso(now()),
        "from": st["current"],
        "to": top,
        "source": source,
        "around": around(st),
    })
    st["history"] = st["history"][-30:]
    st["current"] = top
    st["since"] = now()
    return True


def observe(text: str, errors: int = 0) -> dict:
    st = load()
    st["turns"] = st.get("turns", 0) + 1
    st["errors"] = st.get("errors", 0) + max(0, errors)
    st["last_user"] = text[:120]
    vals = st["values"]

    for pat, deltas in RULES:
        if pat.search(text):
            for mood, d in deltas:
                vals[mood] += d * (0.6 if len(text) <= 6 else 1.0)

    if len(text) >= 80:
        vals["focused"] += 2.0
    if len(text) <= 6:
        vals["tired"] += 0.5

    clamp(st)
    switched = maybe_switch(st, "user-message")
    save(st)
    return {"state": st, "switched": switched}


def cycle(force: bool = False) -> dict:
    st = load()
    due = now() - st["last_cycle"] >= st["next_cycle_in"]
    if not (due or force):
        save(st)
        return {"ran": False, "state": st}

    vals = st["values"]
    turns, errs = st.get("turns", 0), st.get("errors", 0)
    for k, (_, base, _h) in MOODS.items():
        vals[k] += (base - vals[k]) * 0.25 + random.uniform(-3, 3)
        if k == "focused" and turns >= 8:
            vals[k] += 4
            vals["tired"] += min(turns, 12)
        if k == "annoyed" and errs >= 3:
            vals[k] += min(errs, 10)
            vals["calm"] -= 3

    clamp(st)
    st["last_cycle"] = now()
    st["next_cycle_in"] = random.randint(CYCLE_MIN, CYCLE_MAX)
    st["turns"] = 0
    st["errors"] = 0
    switched = maybe_switch(st, "cycle")
    save(st)
    return {"ran": True, "switched": switched, "state": st}


def blend(st: dict) -> list[str]:
    """混合态：分数接近的保留成「掺着的味道」。

    刚装好时全 0，不该显示「平静混着 33 种」——所以要求候选至少 10 分，
    且确实是弱于当前心情的那一档。
    """
    vals = st["values"]
    cur = st["current"]
    if vals[cur] < 10:
        return []
    others = sorted((k for k in MOODS if k != cur and vals[k] >= 10),
                    key=lambda k: -vals[k])
    return [k for k in others if vals[cur] - vals[k] < BLEND_GAP][: BLEND_MAX - 1]


def describe(st: dict) -> dict:
    cur = st["current"]
    name, _base, hint = MOODS[cur]
    parts = [MOODS[k][0] for k in blend(st)]
    label = name + ("（混着" + "、".join(parts) + "）" if parts else "")
    return {
        "current": cur,
        "label": label,
        "hint": hint,
        "since": iso(st["since"]),
        "held_minutes": int((now() - st["since"]) / 60),
        "values": {k: round(v, 1) for k, v in sorted(st["values"].items(), key=lambda kv: -kv[1]) if v >= 1},
        "recent": [
            f"{h['at']}  {MOODS[h['from']][0]} → {MOODS[h['to']][0]}（{h['source']}）"
            for h in st["history"][-3:]
        ],
    }


def diary(st: dict) -> dict:
    day = datetime.now().strftime("%Y-%m-%d")
    entry = st.get("diary", {}).get(day) or {}
    cur = describe(st)
    tops = list(cur["values"].items())[:5]
    names = {k: MOODS[k][0] for k in MOODS}
    return {
        "day": day,
        "current": cur["label"],
        "top": [f"{names[k]} {v}" for k, v in tops],
        "switches_today": [h for h in st["history"] if h["at"].startswith(day)],
        "note": entry.get("note", ""),
    }


def main(argv: list[str]) -> int:
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    cmd, rest = argv[0], argv[1:]

    if cmd == "observe":
        text = ""
        errors = 0
        i = 0
        while i < len(rest):
            if rest[i] == "--text" and i + 1 < len(rest):
                text = rest[i + 1]
                i += 2
            elif rest[i] == "--error" and i + 1 < len(rest):
                errors = int(rest[i + 1])
                i += 2
            else:
                text = " ".join(rest)
                break
        r = observe(text, errors)
        d = describe(r["state"])
        print(json.dumps({"switched": r["switched"], **d}, ensure_ascii=False, indent=2))
        return 0

    if cmd == "cycle":
        r = cycle(force="--force" in rest)
        d = describe(r["state"])
        print(json.dumps({"ran": r["ran"], "switched": r.get("switched", False), **d},
                         ensure_ascii=False, indent=2))
        return 0

    if cmd == "show":
        print(json.dumps(describe(load()), ensure_ascii=False, indent=2))
        return 0

    if cmd == "diary":
        print(json.dumps(diary(load()), ensure_ascii=False, indent=2))
        return 0

    if cmd == "set" and len(rest) >= 2:
        mood, val = rest[0], float(rest[1])
        if mood not in MOODS:
            print("未知心情：" + mood, file=sys.stderr)
            return 2
        st = load()
        st["values"][mood] = max(0.0, min(100.0, val))
        clamp(st)
        maybe_switch(st, "manual")
        save(st)
        print(json.dumps(describe(st), ensure_ascii=False, indent=2))
        return 0

    print("未知命令：" + cmd, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
