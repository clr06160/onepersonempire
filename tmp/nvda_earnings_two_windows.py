"""Build histogram payloads for both NVDA windows."""
from __future__ import annotations

import json
import math
import urllib.request
from pathlib import Path

CHART = Path(r"C:\Users\CoryRoberts\Projects\stocks\scanners\charts\NVDA.json")
ENV = Path(r"C:\Users\CoryRoberts\Projects\stocks\.env")
OUT = Path(r"C:\Users\CoryRoberts\onepersonempire\tmp\nvda_earnings_two_windows.json")


def fmp_key() -> str:
    for line in ENV.read_text(encoding="utf-8").splitlines():
        if line.startswith("FMP_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("no key")


def next_td(dates: list[str], start: str, offset: int) -> str | None:
    for i, d in enumerate(dates):
        if d >= start:
            j = i + offset
            return dates[j] if 0 <= j < len(dates) else None
    return None


def pct(a: float, b: float) -> float | None:
    return round(100.0 * (b - a) / a, 2) if a else None


def events_in_window(raw, dates, close_by, lo: str, hi: str):
    events = []
    seen: set[str] = set()
    for row in raw:
        d = str(row.get("date") or "")[:10]
        if not d or d < lo or d > hi or d in seen:
            continue
        seen.add(d)
        day0 = next_td(dates, d, 1)
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
                "day0Pct": pct(close_by[prior], close_by[day0]),
                "day3Pct": pct(close_by[prior], close_by[day3]) if day3 else None,
            }
        )
    events.sort(key=lambda e: e["reportDate"])
    return events


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


def hist(xs: list[float], width: float, lo: float, hi: float) -> list[dict]:
    """Fixed domain so windows compare on same bins."""
    bins = []
    edge = lo
    while edge < hi - 1e-9:
        count = sum(1 for x in xs if edge <= x < edge + width)
        bins.append({"label": f"{edge:g}", "count": count, "from": edge, "to": edge + width})
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

    windows = {
        "hot": {
            "label": "Oct 2022 – Jun 2024",
            "lo": "2022-10-01",
            "hi": "2024-06-30",
        },
        "later": {
            "label": "Jul 2024 – May 2026",
            "lo": "2024-07-01",
            "hi": "2026-06-30",
        },
    }

    # Shared bin edges for visual compare
    width = 4.0
    domain_lo, domain_hi = -20.0, 28.0

    out = {"ticker": "NVDA", "binWidthPct": width, "windows": {}}
    for key_name, meta in windows.items():
        ev = events_in_window(raw, dates, close_by, meta["lo"], meta["hi"])
        day0 = [e["day0Pct"] for e in ev if e["day0Pct"] is not None]
        day3 = [e["day3Pct"] for e in ev if e["day3Pct"] is not None]
        out["windows"][key_name] = {
            **meta,
            "events": ev,
            "stats": {"day0": stats(day0), "day3": stats(day3)},
            "histograms": {
                "day0": hist(day0, width, domain_lo, domain_hi),
                "day3": hist(day3, width, domain_lo, domain_hi),
            },
        }
        print(key_name, out["windows"][key_name]["stats"])

    OUT.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
