"""NVDA earnings reactions: 2022-10-01 to 2024-06-30."""
from __future__ import annotations

import json
import math
import urllib.request
from pathlib import Path

CHART = Path(r"C:\Users\CoryRoberts\Projects\stocks\scanners\charts\NVDA.json")
ENV = Path(r"C:\Users\CoryRoberts\Projects\stocks\.env")
OUT = Path(r"C:\Users\CoryRoberts\onepersonempire\tmp\nvda_earnings_reactions_oct22_jun24.json")
LO, HI = "2022-10-01", "2024-06-30"


def fmp_key() -> str:
    for line in ENV.read_text(encoding="utf-8").splitlines():
        if line.startswith("FMP_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("no FMP key")


def next_td(dates: list[str], start: str, offset: int) -> str | None:
    for i, d in enumerate(dates):
        if d >= start:
            j = i + offset
            return dates[j] if 0 <= j < len(dates) else None
    return None


def pct(a: float, b: float) -> float | None:
    return round(100.0 * (b - a) / a, 2) if a else None


def stats(xs: list[float]) -> dict:
    s = sorted(xs)
    n = len(s)
    mean = sum(s) / n
    pos = sum(1 for x in s if x > 0)
    med = s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2
    return {
        "n": n,
        "mean": round(mean, 2),
        "median": round(med, 2),
        "min": s[0],
        "max": s[-1],
        "pctPositive": round(100.0 * pos / n, 1),
    }


def hist(xs: list[float], width: float = 2.0) -> list[dict]:
    lo_b = math.floor(min(xs) / width) * width
    hi_b = math.ceil(max(xs) / width) * width
    bins = []
    edge = lo_b
    while edge < hi_b - 1e-9:
        count = sum(1 for x in xs if edge <= x < edge + width)
        bins.append(
            {
                "from": edge,
                "to": edge + width,
                "label": f"{edge:g} to {edge + width:g}",
                "count": count,
            }
        )
        edge += width
    return bins


def main() -> None:
    key = fmp_key()
    url = f"https://financialmodelingprep.com/stable/earnings?symbol=NVDA&apikey={key}"
    with urllib.request.urlopen(url, timeout=45) as resp:
        raw = json.loads(resp.read().decode("utf-8"))

    bars = json.loads(CHART.read_text(encoding="utf-8"))["bars"]
    close_by = {b["time"][:10]: float(b["close"]) for b in bars}
    dates = sorted(close_by)

    events = []
    seen: set[str] = set()
    for row in raw:
        d = str(row.get("date") or "")[:10]
        if not d or d < LO or d > HI or d in seen:
            continue
        seen.add(d)
        day0 = next_td(dates, d, 1)  # AMC -> next session
        if not day0:
            continue
        idx = dates.index(day0)
        if idx < 1:
            continue
        prior = dates[idx - 1]
        day3 = next_td(dates, day0, 3)
        events.append(
            {
                "reportDate": d,
                "priorCloseDate": prior,
                "day0Date": day0,
                "day3Date": day3,
                "day0Pct": pct(close_by[prior], close_by[day0]),
                "day3Pct": pct(close_by[prior], close_by[day3]) if day3 else None,
            }
        )

    events.sort(key=lambda e: e["reportDate"])
    day0s = [e["day0Pct"] for e in events if e["day0Pct"] is not None]
    day3s = [e["day3Pct"] for e in events if e["day3Pct"] is not None]
    payload = {
        "ticker": "NVDA",
        "window": f"{LO} to {HI}",
        "events": events,
        "stats": {"day0": stats(day0s), "day3": stats(day3s)},
        "histograms": {"day0": hist(day0s), "day3": hist(day3s)},
    }
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(payload["stats"], indent=2))
    for e in events:
        print(f"{e['reportDate']} day0={e['day0Pct']}% day3={e['day3Pct']}%")


if __name__ == "__main__":
    main()
