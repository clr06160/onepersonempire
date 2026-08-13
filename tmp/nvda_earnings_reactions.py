"""NVDA earnings reaction study: day-of and +3 trading days, last ~3 years."""
from __future__ import annotations

import json
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

CHART = Path(r"C:\Users\CoryRoberts\Projects\stocks\scanners\charts\NVDA.json")
OUT = Path(r"C:\Users\CoryRoberts\onepersonempire\tmp\nvda_earnings_reactions.json")
ENV_CANDIDATES = [
    Path(r"C:\Users\CoryRoberts\Projects\stocks\.env"),
    Path(r"C:\Users\CoryRoberts\onepersonempire\.env.local"),
]


def load_fmp_key() -> str:
    for path in ENV_CANDIDATES:
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.startswith("FMP_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def fetch_earnings(api_key: str) -> list[dict]:
    urls = [
        f"https://financialmodelingprep.com/stable/earnings?symbol=NVDA&apikey={api_key}",
        f"https://financialmodelingprep.com/api/v3/historical/earning_calendar/NVDA?apikey={api_key}",
        f"https://financialmodelingprep.com/api/v3/earnings-surprises/NVDA?apikey={api_key}",
    ]
    last_err: Exception | None = None
    for url in urls:
        try:
            with urllib.request.urlopen(url, timeout=45) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            if isinstance(data, list) and data:
                print(f"ok {url.split('apikey')[0]} n={len(data)} sample={data[0]}")
                return data
            print(f"empty {url.split('apikey')[0]} type={type(data)}")
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            print(f"fail {url.split('apikey')[0]} {exc}")
    if last_err:
        raise last_err
    return []


def next_trading_day(dates: list[str], start: str, offset: int) -> str | None:
    """offset=0 => first trading day on/after start; offset=1 => next after that, etc."""
    for i, d in enumerate(dates):
        if d >= start:
            j = i + offset
            if 0 <= j < len(dates):
                return dates[j]
            return None
    return None


def pct(a: float, b: float) -> float | None:
    if not a:
        return None
    return round(100.0 * (b - a) / a, 2)


def main() -> None:
    chart = json.loads(CHART.read_text(encoding="utf-8"))
    bars = chart["bars"]
    close_by = {b["time"][:10]: float(b["close"]) for b in bars}
    dates = sorted(close_by)

    api_key = load_fmp_key()
    if not api_key:
        raise SystemExit("Missing FMP_API_KEY")

    raw = fetch_earnings(api_key)
    cutoff = (date.today() - timedelta(days=365 * 3 + 30)).isoformat()

    events: list[dict] = []
    seen: set[str] = set()
    for row in raw:
        d = str(row.get("date") or row.get("earningsDate") or row.get("fiscalDateEnding") or "")[:10]
        if not d or d < cutoff or d in seen:
            continue
        # Skip future
        if d > date.today().isoformat():
            continue
        seen.add(d)
        time_label = str(row.get("time") or row.get("when") or "").lower()
        # If AMC / after, first reaction session is next trading day.
        # If BMO / before, reaction session is same calendar day if market open.
        after = any(x in time_label for x in ("amc", "after", "post"))
        before = any(x in time_label for x in ("bmo", "before", "pre"))
        if after or (not before and not after):
            # Default NVDA historically AMC — treat unknown as AMC.
            reaction_start = next_trading_day(dates, d, 1 if after or not before else 0)
            # For unknown default AMC: if report date is a trading day, reaction is next day.
            if not after and not before:
                reaction_start = next_trading_day(dates, d, 1)
        else:
            reaction_start = next_trading_day(dates, d, 0)

        if not reaction_start:
            continue
        day0 = reaction_start
        day3 = next_trading_day(dates, day0, 3)
        # Prior close = trading day before reaction start
        idx = dates.index(day0)
        if idx < 1:
            continue
        prior = dates[idx - 1]
        c_prior = close_by[prior]
        c0 = close_by[day0]
        day_ret = pct(c_prior, c0)
        three_ret = pct(c_prior, close_by[day3]) if day3 else None

        events.append(
            {
                "reportDate": d,
                "time": time_label or "assumed_amc",
                "priorCloseDate": prior,
                "day0Date": day0,
                "day3Date": day3,
                "day0Pct": day_ret,
                "day3Pct": three_ret,
                "eps": row.get("eps") or row.get("epsActual"),
                "epsEstimated": row.get("epsEstimated") or row.get("estimatedEarning"),
                "revenue": row.get("revenue") or row.get("revenueActual"),
                "revenueEstimated": row.get("revenueEstimated"),
            }
        )

    events.sort(key=lambda e: e["reportDate"])
    day0s = [e["day0Pct"] for e in events if e["day0Pct"] is not None]
    day3s = [e["day3Pct"] for e in events if e["day3Pct"] is not None]

    def stats(xs: list[float]) -> dict:
        if not xs:
            return {}
        s = sorted(xs)
        n = len(s)
        mean = sum(s) / n
        pos = sum(1 for x in s if x > 0)
        return {
            "n": n,
            "mean": round(mean, 2),
            "median": round(s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2, 2),
            "min": s[0],
            "max": s[-1],
            "pctPositive": round(100.0 * pos / n, 1),
        }

    # Histogram bins (2% width)
    def hist(xs: list[float], width: float = 2.0) -> list[dict]:
        if not xs:
            return []
        lo = int((min(xs) // width) * width) - width
        hi = int((max(xs) // width) * width) + width
        bins = []
        edge = lo
        while edge < hi:
            count = sum(1 for x in xs if edge <= x < edge + width)
            bins.append({"from": edge, "to": edge + width, "label": f"{edge:g} to {edge+width:g}", "count": count})
            edge += width
        return bins

    payload = {
        "ticker": "NVDA",
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "window": "last ~3 years",
        "method": (
            "Reaction day0 = first trading session after report (AMC => next day). "
            "Return vs prior close. day3 = close 3 trading days after day0 vs same prior close."
        ),
        "events": events,
        "stats": {"day0": stats(day0s), "day3": stats(day3s)},
        "histograms": {"day0": hist(day0s, 2.0), "day3": hist(day3s, 2.0)},
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps({"stats": payload["stats"], "nEvents": len(events), "out": str(OUT)}, indent=2))
    for e in events:
        print(f"{e['reportDate']} day0={e['day0Pct']}% day3={e['day3Pct']}% ({e['day0Date']} -> {e['day3Date']})")


if __name__ == "__main__":
    main()
