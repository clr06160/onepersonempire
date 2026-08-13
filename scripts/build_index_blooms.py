#!/usr/bin/env python3
"""Build long-history seasonal blooms for Dow / S&P / Nasdaq-100 / Russell 2000.

Writes WebPs + manifest into public/gallery/indexes/ (kept separate from the
scanner-pick art wall so art_lab publishes do not prune them).
Requires: pillow, numpy. Data: Yahoo Finance chart API (daily closes).
"""

from __future__ import annotations

import csv
import json
import math
import ssl
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "gallery" / "indexes"
CACHE_DIR = ROOT / "tmp" / "index-art"
MANIFEST = OUT_DIR / "manifest.json"
SIZE = 640
CX = CY = SIZE // 2

SERIES = [
    ("DOW", "^DJI", "Dow Jones"),
    ("SPX", "^GSPC", "S&P 500 (SPY)"),
    ("NDX", "^NDX", "Nasdaq-100 (QQQ)"),
    ("RUT", "^RUT", "Russell 2000 (IWM)"),
]


def fetch_daily(symbol: str) -> list[tuple[str, float, float, float, float]]:
    q = urllib.parse.quote(symbol, safe="")
    url = (
        f"https://query2.finance.yahoo.com/v8/finance/chart/{q}"
        "?period1=-2208988800&period2=1893456000&interval=1d"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, context=ctx, timeout=120) as response:
        data = json.load(response)
    result = data["chart"]["result"][0]
    timestamps = result["timestamp"]
    quote = result["indicators"]["quote"][0]
    rows: list[tuple[str, float, float, float, float]] = []
    for i, ts in enumerate(timestamps):
        close = quote["close"][i]
        if close is None:
            continue
        high = quote["high"][i] or close
        low = quote["low"][i] or close
        volume = (quote.get("volume") or [0])[i] or 0
        day = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
        rows.append((day, float(close), float(high), float(low), float(volume)))
    return rows


def year_frac(day: datetime) -> float:
    start = datetime(day.year, 1, 1)
    end = datetime(day.year + 1, 1, 1)
    return (day - start).total_seconds() / (end - start).total_seconds()


def momentum_color(mom: float, alpha: int = 220) -> tuple[int, int, int, int]:
    x = max(0.0, min(1.0, (mom + 0.15) / 0.5))
    if x < 0.25:
        t = x / 0.25
        r, g, b = int(30 + 40 * t), int(80 + 100 * t), int(200 + 30 * t)
    elif x < 0.5:
        t = (x - 0.25) / 0.25
        r, g, b = int(70 + 50 * t), int(180 + 40 * t), int(230 - 80 * t)
    elif x < 0.75:
        t = (x - 0.5) / 0.25
        r, g, b = int(120 + 100 * t), int(220 - 40 * t), int(150 - 100 * t)
    else:
        t = (x - 0.75) / 0.25
        r, g, b = int(220 + 35 * t), int(180 - 100 * t), int(50 - 30 * t)
    return (r, g, b, alpha)


def render_bloom(rows: list[dict], out_path: Path) -> None:
    closes = np.array([r["close"] for r in rows], dtype=float)
    logc = np.log(closes)
    log0, log1 = float(logc.min()), float(logc.max())
    span = max(log1 - log0, 1e-9)

    mom = np.zeros(len(closes))
    win = 63
    for i in range(len(closes)):
        j = max(0, i - win)
        if closes[j] > 0:
            mom[i] = closes[i] / closes[j] - 1.0

    r_inner, r_outer = 28, SIZE * 0.46
    img = Image.new("RGBA", (SIZE, SIZE), (7, 7, 16, 255))
    layers = []
    for scale, alpha, width_boost in [
        (1.00, 90, 0),
        (0.985, 70, 0),
        (1.015, 55, 0),
        (0.97, 40, 0),
    ]:
        layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer)
        pts = []
        for i, row in enumerate(rows):
            ang = year_frac(row["date"]) * 2 * math.pi - math.pi / 2
            rn = (logc[i] - log0) / span
            ret = 0.0 if i == 0 else (closes[i] - closes[i - 1]) / closes[i - 1]
            wiggle = max(-0.04, min(0.04, ret * 8))
            rad = (r_inner + (r_outer - r_inner) * rn) * scale * (1.0 + wiggle)
            x = CX + rad * math.cos(ang)
            y = CY + rad * math.sin(ang)
            pts.append((x, y, mom[i], abs(ret)))

        for i in range(1, len(pts)):
            x0, y0, m0, _ = pts[i - 1]
            x1, y1, m1, a1 = pts[i]
            if math.hypot(x1 - x0, y1 - y0) > SIZE * 0.35:
                continue
            color = momentum_color((m0 + m1) / 2, alpha=alpha)
            width = 1 if a1 < 0.015 else 2
            draw.line([(x0, y0), (x1, y1)], fill=color, width=width + width_boost)
        layers.append(layer)

    for layer in layers:
        img = Image.alpha_composite(img, layer)

    glow = img.filter(ImageFilter.GaussianBlur(radius=1.2))
    img = Image.alpha_composite(glow, img)

    bead = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    bead_draw = ImageDraw.Draw(bead)
    for rad, color in [(10, (255, 120, 80, 180)), (6, (255, 200, 160, 220)), (3, (255, 255, 255, 255))]:
        bead_draw.ellipse([CX - rad, CY - rad, CX + rad, CY + rad], fill=color)
    img = Image.alpha_composite(img, bead)
    img.convert("RGB").save(out_path, "WEBP", quality=90)


def main() -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    blurbs = {}
    for key, symbol, label in SERIES:
        raw = fetch_daily(symbol)
        csv_path = CACHE_DIR / f"{key}.csv"
        with csv_path.open("w", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(["date", "close", "high", "low", "volume"])
            writer.writerows(raw)
        rows = [
            {
                "date": datetime.strptime(day, "%Y-%m-%d"),
                "close": close,
                "high": high,
                "low": low,
                "volume": volume,
            }
            for day, close, high, low, volume in raw
        ]
        out_path = OUT_DIR / f"{key}_bloom.webp"
        render_bloom(rows, out_path)
        c0, c1 = rows[0]["close"], rows[-1]["close"]
        years = (rows[-1]["date"] - rows[0]["date"]).days / 365.25
        total = c1 / c0 - 1
        cagr = (c1 / c0) ** (1 / max(years, 1e-9)) - 1
        rets = np.diff(np.log([r["close"] for r in rows]))
        vol = float(np.std(rets) * math.sqrt(252))
        peak = -1e99
        drawdown = 0.0
        for row in rows:
            peak = max(peak, row["close"])
            drawdown = min(drawdown, row["close"] / peak - 1)
        short = {"DOW": "DOW", "SPX": "SPY", "NDX": "QQQ", "RUT": "IWM"}[key]
        title = {"DOW": "Dow Jones", "SPX": "S&P 500", "NDX": "Nasdaq-100", "RUT": "Russell 2000"}[key]
        blurbs[key] = {
            "key": key,
            "short": short,
            "title": title,
            "symbol": symbol,
            "label": label,
            "image": f"/gallery/indexes/{key}_bloom.webp",
            "start": rows[0]["date"].strftime("%Y-%m-%d"),
            "end": rows[-1]["date"].strftime("%Y-%m-%d"),
            "startYear": rows[0]["date"].year,
            "endYear": rows[-1]["date"].year,
            "n": len(rows),
            "years": round(years, 1),
            "totalPct": round(total * 100, 1),
            "cagrPct": round(cagr * 100, 1),
            "volPct": round(vol * 100),
            "maxDdPct": round(drawdown * 100, 1),
            "out": str(out_path),
        }
        print(blurbs[key])
    (CACHE_DIR / "blurbs.json").write_text(json.dumps(blurbs, indent=2))
    manifest = {
        "generatedAt": datetime.now(tz=timezone.utc).strftime("%Y-%m-%d"),
        "note": (
            "Long-history seasonal blooms for major indexes. "
            "Kept under /gallery/indexes so scanner-pick art publishes do not prune them."
        ),
        "items": [
            {k: blurbs[key][k] for k in (
                "key", "short", "title", "symbol", "image", "start", "end",
                "startYear", "endYear", "years", "totalPct", "cagrPct", "volPct", "maxDdPct",
            )}
            for key, _, _ in SERIES
        ],
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print("wrote", MANIFEST)


if __name__ == "__main__":
    main()
