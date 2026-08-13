import json
from datetime import datetime
from pathlib import Path
from statistics import mean, median

p = json.loads(Path(r"C:\Users\CoryRoberts\onepersonempire\tmp\earnings_vs_price_study.json").read_text())
ok = [t for t in p["tickers"] if t.get("ok")]


def bucket(r: float) -> str:
    if r >= 5:
        return "strong+"
    if r >= 0:
        return "mild+"
    if r > -5:
        return "mild-"
    return "strong-"


rows = {k: {"fwd": [], "ret63": [], "pace": []} for k in ["strong+", "mild+", "mild-", "strong-"]}
next_day3 = {"strong+": [], "strong-": []}

for t in ok:
    evs = t["events"]
    for i, e in enumerate(evs):
        r = e.get("day3Pct")
        if r is None:
            continue
        b = bucket(r)
        fwd = e.get("retToNextPrint")
        r63 = e.get("ret63d")
        if fwd is not None:
            rows[b]["fwd"].append(fwd)
            if i + 1 < len(evs):
                d0 = datetime.fromisoformat(e["reportDate"])
                d1 = datetime.fromisoformat(evs[i + 1]["reportDate"])
                months = max((d1 - d0).days / 30.0, 0.25)
                rows[b]["pace"].append(fwd / months)
        if r63 is not None:
            rows[b]["ret63"].append(r63)
        if i + 1 < len(evs) and evs[i + 1].get("day3Pct") is not None:
            if r >= 5:
                next_day3["strong+"].append(evs[i + 1]["day3Pct"])
            if r <= -5:
                next_day3["strong-"].append(evs[i + 1]["day3Pct"])

print("Forward momentum by day+3 bucket")
for k in ["strong+", "mild+", "mild-", "strong-"]:
    f = rows[k]["fwd"]
    pace = rows[k]["pace"]
    r63 = rows[k]["ret63"]
    neg = round(100 * sum(1 for x in f if x < 0) / len(f), 1) if f else None
    print(
        k,
        "n=",
        len(f),
        "med_fwd=",
        round(median(f), 2) if f else None,
        "mean_fwd=",
        round(mean(f), 2) if f else None,
        "med_%/mo=",
        round(median(pace), 2) if pace else None,
        "med_63d=",
        round(median(r63), 2) if r63 else None,
        "pct_neg_fwd=",
        neg,
    )

print("\nNext print day+3 after this print:")
for k, xs in next_day3.items():
    print(
        k,
        "n=",
        len(xs),
        "med_next_day3=",
        round(median(xs), 2),
        "mean=",
        round(mean(xs), 2),
        "pct_next_up=",
        round(100 * sum(1 for x in xs if x > 0) / len(xs), 1),
    )

# Pace ratio strong+ / strong-
sp = median(rows["strong+"]["pace"])
sm = median(rows["strong-"]["pace"])
print("\nMedian %/month pace strong+ vs strong-:", round(sp, 2), "vs", round(sm, 2), "ratio", round(sp / sm, 2) if sm else None)
print("Median fwd strong+ vs strong-:", round(median(rows["strong+"]["fwd"]), 2), "vs", round(median(rows["strong-"]["fwd"]), 2))
