"""Which matters more for forward momentum: day0 or day3?"""
from __future__ import annotations

import json
from pathlib import Path
from statistics import mean, median

p = json.loads(Path(r"C:\Users\CoryRoberts\onepersonempire\tmp\earnings_vs_price_study.json").read_text())
ok = [t for t in p["tickers"] if t.get("ok")]


def corr(xs, ys):
    n = len(xs)
    if n < 3:
        return None
    mx, my = mean(xs), mean(ys)
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den = (sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys)) ** 0.5
    return round(num / den, 3) if den else None


def summarize(label: str, pred):
    buckets = {"big+": [], "noise": [], "big-": []}
    for t in ok:
        for e in t["events"]:
            if e.get("retToNextPrint") is None:
                continue
            v = pred(e)
            if v is None:
                continue
            fwd = e["retToNextPrint"]
            if v >= 10:
                buckets["big+"].append(fwd)
            elif v <= -10:
                buckets["big-"].append(fwd)
            elif abs(v) < 5:
                buckets["noise"].append(fwd)

    print(f"\n=== {label} (±10% bands) ===")
    for k in ["big+", "noise", "big-"]:
        xs = buckets[k]
        if not xs:
            print(k, "empty")
            continue
        print(
            k,
            "n=",
            len(xs),
            "med=",
            round(median(xs), 2),
            "mean=",
            round(mean(xs), 2),
            "neg%=",
            round(100 * sum(1 for x in xs if x < 0) / len(xs), 1),
        )


# correlations
d0, d3, fwd = [], [], []
for t in ok:
    for e in t["events"]:
        if e.get("retToNextPrint") is None:
            continue
        if e.get("day0Pct") is not None and e.get("day3Pct") is not None:
            d0.append(e["day0Pct"])
            d3.append(e["day3Pct"])
            fwd.append(e["retToNextPrint"])

print("corr day0 vs fwd", corr(d0, fwd))
print("corr day3 vs fwd", corr(d3, fwd))
print("corr day0 vs day3", corr(d0, d3))

summarize("DAY0", lambda e: e.get("day0Pct"))
summarize("DAY3", lambda e: e.get("day3Pct"))

# disagreement: day0 big+ but day3 not, etc.
disagree = {"d0+_d3-": [], "d0-_d3+": [], "both+": [], "both-": []}
for t in ok:
    for e in t["events"]:
        if e.get("retToNextPrint") is None or e.get("day0Pct") is None or e.get("day3Pct") is None:
            continue
        a, b, f = e["day0Pct"], e["day3Pct"], e["retToNextPrint"]
        if a >= 10 and b <= -10:
            disagree["d0+_d3-"].append(f)
        elif a <= -10 and b >= 10:
            disagree["d0-_d3+"].append(f)
        elif a >= 10 and b >= 10:
            disagree["both+"].append(f)
        elif a <= -10 and b <= -10:
            disagree["both-"].append(f)

print("\n=== disagreement ===")
for k, xs in disagree.items():
    if not xs:
        print(k, "n=0")
        continue
    print(k, "n=", len(xs), "med_fwd=", round(median(xs), 2), "mean=", round(mean(xs), 2))
