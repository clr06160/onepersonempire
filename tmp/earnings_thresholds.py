"""Find day+3 reaction thresholds that separate noise from real momentum shifts."""
from __future__ import annotations

import json
from pathlib import Path
from statistics import mean, median

p = json.loads(Path(r"C:\Users\CoryRoberts\onepersonempire\tmp\earnings_vs_price_study.json").read_text())
ok = [t for t in p["tickers"] if t.get("ok")]

pairs = []
for t in ok:
    for e in t["events"]:
        if e.get("day3Pct") is None or e.get("retToNextPrint") is None:
            continue
        pairs.append((e["day3Pct"], e["retToNextPrint"], t["ticker"], e["reportDate"]))

# Fine buckets by day3
edges = [-999, -15, -10, -5, -2, 2, 5, 10, 15, 999]
labels = ["le-15", "-15_-10", "-10_-5", "-5_-2", "-2_+2", "+2_+5", "+5_+10", "+10_+15", "ge+15"]


def in_bucket(x: float, i: int) -> bool:
    return edges[i] <= x < edges[i + 1]


print("day3 bucket -> n, med_fwd, mean_fwd, pct_neg")
for i, lab in enumerate(labels):
    xs = [fwd for d3, fwd, _, _ in pairs if in_bucket(d3, i)]
    if not xs:
        print(lab, "empty")
        continue
    print(
        f"{lab:10} n={len(xs):3} med={median(xs):6.2f} mean={mean(xs):6.2f} "
        f"neg%={100 * sum(1 for x in xs if x < 0) / len(xs):5.1f}"
    )

# NVDA sequence
nvda = next(t for t in ok if t["ticker"] == "NVDA")
print("\nNVDA prints (day3 -> fwd to next):")
for e in nvda["events"]:
    if e["reportDate"] < "2022-10-01":
        continue
    print(
        e["reportDate"],
        f"d0={e.get('day0Pct')}",
        f"d3={e.get('day3Pct')}",
        f"fwd={e.get('retToNextPrint')}",
    )

# Propose thresholds: compare |d3|<2 vs d3<=-8 vs d3>=8
for name, pred in [
    ("noise |d3|<2", lambda d: abs(d) < 2),
    ("small loss -5..-2", lambda d: -5 <= d < -2),
    ("big loss d3<=-8", lambda d: d <= -8),
    ("mid loss -8..-5", lambda d: -8 < d <= -5),
    ("small win +2..+5", lambda d: 2 <= d < 5),
    ("big win d3>=+8", lambda d: d >= 8),
]:
    xs = [fwd for d3, fwd, _, _ in pairs if pred(d3)]
    print(
        name,
        "n=",
        len(xs),
        "med=",
        round(median(xs), 2) if xs else None,
        "mean=",
        round(mean(xs), 2) if xs else None,
    )
