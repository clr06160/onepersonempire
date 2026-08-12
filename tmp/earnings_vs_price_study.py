"""Earnings reactions vs subsequent price path.

Question: do weak/strong post-print reactions line up with the stock leveling off
or rolling over — i.e. can the earnings tape track the chart regime?

For each ticker / earnings event:
  - day0Pct, day3Pct vs prior close (AMC => next session)
  - retToNextPrint: return from reaction day0 close to next earnings reaction day0
  - ret63d: return from day0 close to +63 trading days (or last available)
  - madeNewHighBeforeNext: did close make a new high between this day0 and next print?

Also per-ticker summary: rolling mean of last 3 day3 reactions vs forward path.
"""
from __future__ import annotations

import json
import math
import urllib.request
from pathlib import Path

CHARTS = Path(r"C:\Users\CoryRoberts\Projects\stocks\scanners\charts")
ENV = Path(r"C:\Users\CoryRoberts\Projects\stocks\.env")
OUT = Path(r"C:\Users\CoryRoberts\onepersonempire\tmp\earnings_vs_price_study.json")

# User seeds + similar "hot then cooled / still hot" names with local charts when possible.
TICKERS = [
    # user
    "CLS", "STRL", "FIX", "CRDO", "VIST",
    # infra / electrical / AI hardware
    "NVDA", "AVGO", "SMCI", "VRT", "PWR", "EME", "GEV", "CEG",
    "WDC", "MU", "ARM", "DELL", "ANET", "ASML", "AVAV",
    # software / growth that ripped then cooled or mixed
    "DDOG", "CRWD", "NET", "SNOW", "PLTR", "SHOP", "TEAM", "APP", "META", "FSLY",
    # speculative / high-beta
    "MSTR", "COIN", "HOOD", "OKLO", "TTAN",
]


def fmp_key() -> str:
    for line in ENV.read_text(encoding="utf-8").splitlines():
        if line.startswith("FMP_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("Missing FMP_API_KEY")


def http_json(url: str):
    with urllib.request.urlopen(url, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def load_closes(ticker: str) -> dict[str, float]:
    path = CHARTS / f"{ticker}.json"
    if path.exists():
        bars = json.loads(path.read_text(encoding="utf-8"))["bars"]
        return {b["time"][:10]: float(b["close"]) for b in bars}
    # FMP historical fallback
    key = fmp_key()
    url = (
        f"https://financialmodelingprep.com/stable/historical-price-eod/full"
        f"?symbol={ticker}&apikey={key}"
    )
    try:
        data = http_json(url)
    except Exception:
        # legacy
        url = (
            f"https://financialmodelingprep.com/api/v3/historical-price-full/{ticker}"
            f"?apikey={key}"
        )
        data = http_json(url)
    rows = data if isinstance(data, list) else data.get("historical") or []
    out = {}
    for row in rows:
        d = str(row.get("date") or "")[:10]
        c = row.get("close")
        if d and c is not None:
            out[d] = float(c)
    return out


def load_earnings(ticker: str, key: str) -> list[dict]:
    url = f"https://financialmodelingprep.com/stable/earnings?symbol={ticker}&apikey={key}"
    try:
        data = http_json(url)
        if isinstance(data, list):
            return data
    except Exception:
        pass
    url = (
        f"https://financialmodelingprep.com/api/v3/historical/earning_calendar/{ticker}"
        f"?apikey={key}"
    )
    data = http_json(url)
    return data if isinstance(data, list) else []


def next_td(dates: list[str], start: str, offset: int) -> str | None:
    for i, d in enumerate(dates):
        if d >= start:
            j = i + offset
            return dates[j] if 0 <= j < len(dates) else None
    return None


def pct(a: float, b: float) -> float | None:
    if a is None or b is None or not a:
        return None
    return round(100.0 * (b - a) / a, 2)


def build_ticker(ticker: str, key: str) -> dict | None:
    closes = load_closes(ticker)
    if len(closes) < 100:
        return {"ticker": ticker, "ok": False, "error": "insufficient prices"}
    dates = sorted(closes)
    earnings = load_earnings(ticker, key)

    events = []
    seen: set[str] = set()
    for row in earnings:
        report = str(row.get("date") or row.get("earningsDate") or "")[:10]
        if not report or report in seen or report > dates[-1]:
            continue
        # need enough history
        if report < "2021-01-01":
            continue
        seen.add(report)
        day0 = next_td(dates, report, 1)  # assume AMC
        if not day0:
            continue
        idx = dates.index(day0)
        if idx < 1:
            continue
        prior = dates[idx - 1]
        day3 = next_td(dates, day0, 3)
        day63 = next_td(dates, day0, 63)
        events.append(
            {
                "reportDate": report,
                "day0Date": day0,
                "day3Date": day3,
                "day0Pct": pct(closes[prior], closes[day0]),
                "day3Pct": pct(closes[prior], closes[day3]) if day3 else None,
                "ret63d": pct(closes[day0], closes[day63]) if day63 else None,
                "_day0Idx": idx,
            }
        )

    events.sort(key=lambda e: e["reportDate"])
    # fill retToNextPrint + new high before next
    for i, ev in enumerate(events):
        if i + 1 < len(events):
            nxt = events[i + 1]
            ev["retToNextPrint"] = pct(closes[ev["day0Date"]], closes[nxt["day0Date"]])
            start_i = ev["_day0Idx"]
            end_i = nxt["_day0Idx"]
            window = [closes[dates[j]] for j in range(start_i, end_i + 1)]
            peak = max(window) if window else None
            ev["madeNewHighBeforeNext"] = bool(peak and peak > closes[ev["day0Date"]] * 1.001)
        else:
            ev["retToNextPrint"] = None
            ev["madeNewHighBeforeNext"] = None
        ev.pop("_day0Idx", None)

    # monthly price path for charts (downsample)
    path = []
    last_month = ""
    for d in dates:
        if d < "2022-01-01":
            continue
        m = d[:7]
        if m != last_month:
            path.append({"date": d, "close": round(closes[d], 4)})
            last_month = m
    if dates and (not path or path[-1]["date"] != dates[-1]):
        path.append({"date": dates[-1], "close": round(closes[dates[-1]], 4)})

    # normalize path to 100 at first point for compare
    if path:
        base = path[0]["close"] or 1.0
        for p in path:
            p["idx"] = round(100.0 * p["close"] / base, 2)

    day0s = [e["day0Pct"] for e in events if e["day0Pct"] is not None]
    day3s = [e["day3Pct"] for e in events if e["day3Pct"] is not None]

    # correlation-ish: group prints by day3 reaction buckets vs retToNextPrint
    buckets = {
        "strongPlus": [],  # day3 >= 5
        "mildPlus": [],  # 0 <= day3 < 5
        "mildMinus": [],  # -5 < day3 < 0
        "strongMinus": [],  # day3 <= -5
    }
    for e in events:
        r = e.get("day3Pct")
        fwd = e.get("retToNextPrint")
        if r is None or fwd is None:
            continue
        if r >= 5:
            buckets["strongPlus"].append(fwd)
        elif r >= 0:
            buckets["mildPlus"].append(fwd)
        elif r > -5:
            buckets["mildMinus"].append(fwd)
        else:
            buckets["strongMinus"].append(fwd)

    def mean(xs: list[float]) -> float | None:
        return round(sum(xs) / len(xs), 2) if xs else None

    bucket_means = {k: {"n": len(v), "meanFwdToNext": mean(v)} for k, v in buckets.items()}

    # detect "first hard negative day3 (<= -5) after a prior strong (+5) print"
    regime_break = None
    saw_strong = False
    for e in events:
        r = e.get("day3Pct")
        if r is None:
            continue
        if r >= 5:
            saw_strong = True
        if saw_strong and r <= -5:
            regime_break = {
                "reportDate": e["reportDate"],
                "day3Pct": r,
                "day0Pct": e.get("day0Pct"),
                "retToNextPrint": e.get("retToNextPrint"),
                "ret63d": e.get("ret63d"),
            }
            break

    return {
        "ticker": ticker,
        "ok": True,
        "nEvents": len(events),
        "pricePath": path,
        "events": events,
        "stats": {
            "day0Mean": mean(day0s),
            "day3Mean": mean(day3s),
            "pctDay3Positive": round(100.0 * sum(1 for x in day3s if x > 0) / len(day3s), 1)
            if day3s
            else None,
        },
        "fwdByReactionBucket": bucket_means,
        "regimeBreak": regime_break,
    }


def pooled_buckets(rows: list[dict]) -> dict:
    pooled = {k: [] for k in ("strongPlus", "mildPlus", "mildMinus", "strongMinus")}
    for row in rows:
        if not row.get("ok"):
            continue
        for e in row["events"]:
            r = e.get("day3Pct")
            fwd = e.get("retToNextPrint")
            if r is None or fwd is None:
                continue
            if r >= 5:
                pooled["strongPlus"].append(fwd)
            elif r >= 0:
                pooled["mildPlus"].append(fwd)
            elif r > -5:
                pooled["mildMinus"].append(fwd)
            else:
                pooled["strongMinus"].append(fwd)

    def mean(xs: list[float]) -> float | None:
        return round(sum(xs) / len(xs), 2) if xs else None

    return {k: {"n": len(v), "meanFwdToNextPrint": mean(v)} for k, v in pooled.items()}


def main() -> None:
    key = fmp_key()
    rows = []
    for i, ticker in enumerate(TICKERS, 1):
        print(f"[{i}/{len(TICKERS)}] {ticker}", flush=True)
        try:
            rows.append(build_ticker(ticker, key))
        except Exception as exc:  # noqa: BLE001
            rows.append({"ticker": ticker, "ok": False, "error": str(exc)})

    ok_rows = [r for r in rows if r.get("ok")]
    payload = {
        "question": (
            "Do earnings reactions (day0/day3) line up with the stock leveling off or rolling over? "
            "Compare reaction strength to forward return until the next print."
        ),
        "method": (
            "AMC assumed: day0 = next session vs prior close; day3 = +3 sessions vs same prior close; "
            "fwd = close on next print's day0 vs this day0."
        ),
        "tickersRequested": TICKERS,
        "okCount": len(ok_rows),
        "pooledFwdByDay3Bucket": pooled_buckets(ok_rows),
        "tickers": rows,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print("wrote", OUT)
    print("pooled", json.dumps(payload["pooledFwdByDay3Bucket"], indent=2))
    breaks = [r for r in ok_rows if r.get("regimeBreak")]
    print(f"regimeBreak count {len(breaks)}")
    for r in breaks[:15]:
        b = r["regimeBreak"]
        print(
            f"  {r['ticker']} break {b['reportDate']} day3={b['day3Pct']} "
            f"fwdNext={b['retToNextPrint']} ret63={b['ret63d']}"
        )


if __name__ == "__main__":
    main()
