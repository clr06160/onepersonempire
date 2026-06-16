from __future__ import annotations

import argparse
import csv
import json
import sys
import webbrowser
from datetime import datetime
from pathlib import Path


SCANNERS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCANNERS_DIR.parent
REPORTS_DIR = PROJECT_ROOT / "reports"
OUT = SCANNERS_DIR / "stock_scanner_dashboard.html"
JSON_OUT = SCANNERS_DIR / "stock_scanner_dashboard.json"


def latest_selected(path: Path, variant: str) -> tuple[str, list[str]]:
    rows: list[dict[str, str]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            if str(row.get("variant", "")) == variant:
                rows.append(row)
    if not rows:
        return "n/a", []

    def date_key(row: dict[str, str]) -> datetime:
        value = str(row.get("date", "") or row.get("rebalance_date", ""))
        try:
            return datetime.fromisoformat(value[:10])
        except ValueError:
            return datetime.min

    row = sorted(rows, key=date_key)[-1]
    tickers = [item.strip() for item in str(row.get("selected_tickers", "")).split(",") if item.strip()]
    return date_key(row).date().isoformat(), tickers


def selected_on_or_before(path: Path, variant: str, target_date: str) -> tuple[str, list[str]]:
    target = datetime.fromisoformat(target_date[:10])
    rows: list[dict[str, str]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            if str(row.get("variant", "")) != variant:
                continue
            value = str(row.get("date", "") or row.get("rebalance_date", ""))
            try:
                row_date = datetime.fromisoformat(value[:10])
            except ValueError:
                continue
            if row_date <= target:
                row["_parsed_date"] = row_date.isoformat()
                rows.append(row)
    if not rows:
        return "n/a", []
    row = sorted(rows, key=lambda item: item["_parsed_date"])[-1]
    tickers = [item.strip() for item in str(row.get("selected_tickers", "")).split(",") if item.strip()]
    return row["_parsed_date"][:10], tickers


def saved_system_payload() -> list[dict]:
    quality_reb = REPORTS_DIR / "iwm_powertrend_hybrid_quality_2026-06-15_rebalances.csv"
    raw_weekly_reb = REPORTS_DIR / "iwm_weekly_accel_no_stop_jupyter_rebalances.csv"
    raw_monthly_reb = REPORTS_DIR / "tight_setup_acceleration_iwm_top200_stop_grid_2026-06-14_rebalances.csv"
    qqq_reb = REPORTS_DIR / "tight_setup_acceleration_stop_grid_2026-06-14_rebalances.csv"

    core_date, core_top = latest_selected(quality_reb, "top10_two_month_quality_qqq200_half_only")
    monthly_core_date, monthly_core_top = latest_selected(quality_reb, "top10_monthly_quality_qqq200_half_only")
    raw10_monthly_date, raw10_monthly_top = latest_selected(raw_monthly_reb, "iwm_top200_accel_top10_monthly__baseline_acceleration")
    raw10_weekly_date, raw10_weekly_top = latest_selected(raw_weekly_reb, "iwm_top200_accel_top10_weekly__baseline_acceleration")
    raw5_monthly_date, raw5_monthly_top = latest_selected(raw_monthly_reb, "iwm_top200_accel_top5_monthly__baseline_acceleration")
    raw5_quarterly_date, raw5_quarterly_top = selected_on_or_before(
        raw_monthly_reb,
        "iwm_top200_accel_top5_monthly__baseline_acceleration",
        "2026-05-01",
    )
    raw5_weekly_date, raw5_weekly_top = latest_selected(raw_weekly_reb, "iwm_top200_accel_top5_weekly__baseline_acceleration")
    qqq_date, qqq_top = latest_selected(qqq_reb, "nasdaq100_accel_top10_monthly__baseline_acceleration")

    return [
        {
            "id": "core",
            "label": "Core: IWM Quality 2-Month",
            "role": "Best core candidate",
            "stats": {"CAGR": "64.15%", "Max DD": "-25.91%", "Avg DD": "-6.60%", "Loss Years": "0"},
            "date": core_date,
            "top": core_top[:10],
            "method": [
                "IWM top200 by latest cached dollar volume.",
                "Top10 acceleration after balanced growth/margin > 0.",
                "Quality means sales growth > 0 and EBITDA margin > 0.",
                "QQQ200 half exposure: full above QQQ 200-day SMA, half below.",
                "Rebalance every two months.",
            ],
            "note": "Current best investable-looking system. Strong return with much cleaner drawdown.",
        },
        {
            "id": "monthly-core",
            "label": "Prior Core: IWM Quality Monthly",
            "role": "Benchmark",
            "stats": {"CAGR": "45.38%", "Max DD": "-26.05%", "Avg DD": "-7.28%", "Loss Years": "0"},
            "date": monthly_core_date,
            "top": monthly_core_top[:10],
            "method": [
                "Same quality filter as core.",
                "QQQ200 half exposure.",
                "Monthly rebalance.",
            ],
            "note": "Useful benchmark. Superseded by the two-month cadence in latest tests.",
        },
        {
            "id": "raw10",
            "label": "Aggressive: Raw PowerTrend Top10",
            "role": "Aggressive sleeve",
            "stats": {"CAGR": "131.35%", "Max DD": "-38.97%", "Avg DD": "-11.83%", "Loss Years": "0"},
            "date": raw10_monthly_date,
            "top": raw10_monthly_top[:10],
            "watchDate": raw10_weekly_date,
            "watch": raw10_weekly_top[:10],
            "method": [
                "IWM top200.",
                "Top10 raw acceleration only.",
                "PowerTrend ON: weekly basket.",
                "PowerTrend OFF: monthly basket.",
                "No quality filter and no QQQ200 half.",
            ],
            "note": "Huge upside, still high drawdown. Best used as smaller aggressive sleeve.",
        },
        {
            "id": "raw5",
            "label": "Rocket: Raw PowerTrend Top5",
            "role": "Competition-style",
            "stats": {"CAGR": "160.83%", "Max DD": "-58.67%", "Avg DD": "-19.87%", "Loss Years": "1"},
            "date": raw5_monthly_date,
            "top": raw5_monthly_top[:5],
            "watchDate": raw5_weekly_date,
            "watch": raw5_weekly_top[:5],
            "method": [
                "IWM top200.",
                "Top5 raw acceleration only.",
                "PowerTrend ON: weekly basket.",
                "PowerTrend OFF: monthly basket.",
            ],
            "note": "Investment competition style. Very high return and very high pain.",
        },
        {
            "id": "raw5-quarterly",
            "label": "191-197% Test: Raw Top5 PowerTrend / Quarterly",
            "role": "Highest-return raw hybrid",
            "stats": {"CAGR": "197.06%", "Max DD": "-56.67%", "Avg DD": "-14.71%", "Loss Years": "0"},
            "date": raw5_quarterly_date,
            "top": raw5_quarterly_top[:5],
            "watchDate": raw5_weekly_date,
            "watch": raw5_weekly_top[:5],
            "method": [
                "IWM top200.",
                "Top5 raw acceleration only.",
                "PowerTrend ON: weekly basket.",
                "PowerTrend OFF: quarterly basket, offset1 calendar.",
                "No quality filter and no QQQ200 half.",
            ],
            "note": "This is the ~191-197% raw hybrid test: 197.06% CAGR with -56.67% max DD in the latest run. Treat as competition/aggressive research, not core.",
        },
        {
            "id": "qqq",
            "label": "QQQ Pure Acceleration",
            "role": "Large-cap growth sleeve",
            "stats": {"CAGR": "31.62%", "Max DD": "-48.23%", "Avg DD": "n/a", "Loss Years": "2"},
            "date": qqq_date,
            "top": qqq_top[:10],
            "method": [
                "Nasdaq-100 / QQQ current constituents.",
                "Top10 raw acceleration.",
                "Monthly rebalance.",
                "No quality filter and no stops.",
            ],
            "note": "Clean QQQ signal, but IWM systems have been stronger in this research.",
        },
    ]


def live_system_payload(update_prices: bool = True, full_price_update: bool = False) -> list[dict]:
    import numpy as np
    import pandas as pd

    today = datetime.now().date()
    if today.weekday() >= 5:
        raise RuntimeError(f"Weekend skip: {today.isoformat()} is not a Monday-Friday trading day.")

    print("Starting live stock scanner...", flush=True)

    if str(PROJECT_ROOT) not in sys.path:
        sys.path.insert(0, str(PROJECT_ROOT))

    from nasdaq100_accel_momentum_risk_runner import load_price_frame
    from nasdaq100_second_derivative_scanner import ScannerConfig, build_schedules, completed_feature_frame, rank_acceleration_candidates
    from nasdaq_power_trend_runner import RunConfig as PowerTrendConfig
    from nasdaq_power_trend_runner import add_power_trend_features, build_market_frame
    from qqq_accel_quality_overlay_runner import rank_quality_candidates_by_mode
    from quality_regime_router_runner import RouterConfig, UNIVERSES, load_cashflows, load_financials, load_tickers, quality_candidate_frame
    from tight_setup_acceleration_runner import TightConfig, add_tight_indicators, enrich_ranked_with_tight_features, select_iwm_top_dollar_volume

    start_year = 2021
    iwm_top_count = 200
    iwm_daily_update_count = 500
    top10 = 10
    top5 = 5

    raw_iwm_tickers = load_tickers(UNIVERSES["iwm"].constituents_file)
    raw_qqq_tickers = load_tickers(UNIVERSES["qqq"].constituents_file)
    iwm_scan_tickers = raw_iwm_tickers

    if update_prices:
        from iwm_quality_accel_daily_scanner import load_or_rebuild_top200, selected_top200_tickers, update_price_files

        if full_price_update:
            iwm_update_tickers = sorted(set(raw_iwm_tickers + ["IWM"]))
            print("Updating full cached IWM and QQQ price files before scanning...", flush=True)
        else:
            top200_cache = load_or_rebuild_top200(refresh_top200=False, iwm_top_count=iwm_top_count)
            if {"eligible", "avg_dollar_volume", "ticker"}.issubset(top200_cache.columns):
                candidate_cache = top200_cache.copy()
                candidate_cache["eligible"] = candidate_cache["eligible"].astype(bool)
                candidate_cache["avg_dollar_volume"] = pd.to_numeric(candidate_cache["avg_dollar_volume"], errors="coerce")
                iwm_candidates = (
                    candidate_cache[candidate_cache["eligible"]]
                    .sort_values(["avg_dollar_volume", "ticker"], ascending=[False, True])
                    .head(iwm_daily_update_count)["ticker"]
                    .astype(str)
                    .str.upper()
                    .tolist()
                )
            else:
                iwm_candidates = selected_top200_tickers(top200_cache, iwm_top_count=iwm_daily_update_count)
            iwm_update_tickers = sorted(set(iwm_candidates + ["IWM"]))
            iwm_scan_tickers = iwm_candidates
            print("Updating IWM top-500 candidate cache and QQQ price files before scanning...", flush=True)

        iwm_updates = update_price_files("iwm", iwm_update_tickers, sleep_seconds=0.05)
        qqq_updates = update_price_files("qqq", sorted(set(raw_qqq_tickers + ["QQQ"])), sleep_seconds=0.05)
        update_status = pd.concat([iwm_updates, qqq_updates], ignore_index=True)
        status_counts = update_status["status"].astype(str).str.split(":", n=1).str[0].value_counts().to_dict()
        print(f"Price update status: {status_counts}", flush=True)
    else:
        print("Skipping price update; using existing cached files.", flush=True)

    all_symbols = sorted(set(iwm_scan_tickers + raw_qqq_tickers + ["IWM", "QQQ"]))
    print(f"Loading price files: {len(all_symbols)} symbols", flush=True)
    frames = {}
    for idx, ticker in enumerate(all_symbols, 1):
        frame, _source = load_price_frame(ticker, adjusted_prices=True)
        if not frame.empty:
            frames[ticker] = add_tight_indicators(frame)
        if idx % 50 == 0 or idx == len(all_symbols):
            print(f"  loaded {idx}/{len(all_symbols)} price files", flush=True)

    benchmark = frames["IWM"]
    as_of = pd.Timestamp(benchmark.index.max()).normalize()
    print(f"Scanner as-of date: {as_of.date()}", flush=True)

    tight_cfg = TightConfig(
        start_year=start_year,
        end_date=as_of.date().isoformat(),
        universe="iwm",
        iwm_top_count=iwm_top_count,
        top_values=(top5, top10),
        frequencies=("weekly", "monthly"),
        min_price=1.0,
        min_history_rows=260,
        adjusted_prices=True,
        output_prefix="live_stock_scanner",
    )
    iwm_top200, _subset = select_iwm_top_dollar_volume(raw_iwm_tickers, frames, tight_cfg)
    latest_cutoff = as_of - pd.Timedelta(days=7)
    iwm_eligible = [
        ticker
        for ticker in iwm_top200
        if ticker in frames and len(frames[ticker]) >= 260 and pd.Timestamp(frames[ticker].index.max()) >= latest_cutoff
    ]
    qqq_eligible = [
        ticker
        for ticker in raw_qqq_tickers
        if ticker in frames and len(frames[ticker]) >= 260 and pd.Timestamp(frames[ticker].index.max()) >= latest_cutoff
    ]
    print(f"IWM eligible: {len(iwm_eligible)} | QQQ eligible: {len(qqq_eligible)}", flush=True)

    scanner_cfg = ScannerConfig(
        start_year=start_year,
        end_date=as_of.date().isoformat(),
        top_values=(top5, top10),
        frequencies=("weekly", "monthly"),
        min_price=1.0,
        min_history_rows=260,
    )
    iwm_features = {ticker: completed_feature_frame(frames[ticker]["return_close"]) for ticker in iwm_eligible}
    qqq_features = {ticker: completed_feature_frame(frames[ticker]["return_close"]) for ticker in qqq_eligible}
    schedules = build_schedules(pd.to_numeric(benchmark["return_close"], errors="coerce").dropna(), scanner_cfg)
    print("Built acceleration feature frames.", flush=True)

    trading_dates = pd.DatetimeIndex(
        benchmark.loc[(benchmark.index >= pd.Timestamp(start_year, 1, 1)) & (benchmark.index <= as_of)].index
    ).sort_values().unique()

    def offset_month_schedule(n_months: int, offset: int) -> list[pd.Timestamp]:
        frame = pd.DataFrame({"date": trading_dates})
        frame["month"] = frame["date"].dt.to_period("M")
        first_by_month = frame.groupby("month", sort=True)["date"].first().reset_index()
        selected = [pd.Timestamp(item) for item in first_by_month.iloc[offset::n_months]["date"].tolist()]
        if not selected or selected[0] > trading_dates[0]:
            selected = [pd.Timestamp(trading_dates[0])] + selected
        if selected[-1] != pd.Timestamp(trading_dates[-1]):
            selected.append(pd.Timestamp(trading_dates[-1]))
        return sorted(pd.DatetimeIndex(selected).unique().to_list())

    def last_rebalance(schedule: list[pd.Timestamp]) -> pd.Timestamp:
        return max(pd.Timestamp(item) for item in schedule if pd.Timestamp(item) <= as_of)

    def raw_scan(scan_date: pd.Timestamp, top: int, tickers: list[str], features: dict[str, pd.DataFrame]) -> list[str]:
        ranked = rank_acceleration_candidates(scan_date, tickers, features, scanner_cfg)
        ranked = enrich_ranked_with_tight_features(ranked, frames, scan_date)
        if ranked.empty:
            return []
        positive = ranked[ranked["positive_accel_filter"].astype(bool)].copy()
        return positive.head(top)["ticker"].astype(str).tolist()

    financials = {}
    cashflows = {}
    print("Loading IWM fundamentals for quality scanner...", flush=True)
    for idx, ticker in enumerate(iwm_eligible, 1):
        financials[ticker] = load_financials(ticker)
        cashflows[ticker] = load_cashflows(ticker)
        if idx % 50 == 0 or idx == len(iwm_eligible):
            print(f"  loaded fundamentals {idx}/{len(iwm_eligible)}", flush=True)

    def quality_scan(scan_date: pd.Timestamp, top: int) -> list[str]:
        ranked = rank_acceleration_candidates(scan_date, iwm_eligible, iwm_features, scanner_cfg)
        ranked = enrich_ranked_with_tight_features(ranked, frames, scan_date)
        if ranked.empty:
            return []
        positive = ranked[ranked["positive_accel_filter"].astype(bool)].copy()
        prices = {ticker: frames[ticker]["return_close"].dropna() for ticker in iwm_eligible if ticker in frames}
        router_cfg = RouterConfig(
            start_year=start_year,
            end_date=scan_date.date().isoformat(),
            top=top,
            rule40_min=0.0,
            min_price=1.0,
            output_prefix="live_stock_scanner",
        )
        quality_candidates = quality_candidate_frame(
            "iwm",
            scan_date,
            {"iwm": iwm_eligible},
            prices,
            financials,
            cashflows,
            router_cfg,
        )
        quality_ranked = rank_quality_candidates_by_mode(quality_candidates, 0.0, "balanced_growth_margin")
        if quality_ranked.empty:
            return []
        eligible = positive.merge(quality_ranked[["ticker"]], on="ticker", how="inner")
        return eligible.head(top)["ticker"].astype(str).tolist()

    power_cfg = PowerTrendConfig(
        start=f"{start_year}-01-01",
        end=as_of.date().isoformat(),
        initial_capital=10_000.0,
        adjusted_prices=True,
        output_prefix="live_stock_scanner",
        include_same_day_diagnostic=False,
    )
    market, _sources = build_market_frame(power_cfg)
    market = add_power_trend_features(market)
    market.index = pd.to_datetime(market.index).normalize()
    power = market[["power_trend_on_completed"]].copy()
    power["power_trend_on_signal"] = power["power_trend_on_completed"].shift(1).fillna(False).astype(bool)
    power_on = bool(power.loc[:as_of]["power_trend_on_signal"].iloc[-1])
    power_label = "POWER TREND ON" if power_on else "POWER TREND OFF"
    print(f"{power_label}", flush=True)

    monthly_date = last_rebalance(schedules["monthly"])
    weekly_date = last_rebalance(schedules["weekly"])
    two_month_date = last_rebalance(offset_month_schedule(2, 0))
    quarterly_offset1_date = last_rebalance(offset_month_schedule(3, 1))
    active_raw_date = weekly_date if power_on else monthly_date
    active_raw5_quarterly_date = weekly_date if power_on else quarterly_offset1_date

    qqq_date = monthly_date

    live_meta = {"isLive": True, "asOf": as_of.date().isoformat(), "powertrend": power_label, "powertrendOn": power_on}
    print("Building live scanner payload...", flush=True)
    return [
        {
            **live_meta,
            "id": "core",
            "label": "Core: IWM Quality 2-Month",
            "role": "Best core candidate",
            "stats": {"CAGR": "64.15%", "Max DD": "-25.91%", "Avg DD": "-6.60%", "Loss Years": "0"},
            "date": two_month_date.date().isoformat(),
            "top": quality_scan(two_month_date, top10),
            "method": [
                "IWM top200 by latest cached dollar volume.",
                "Top10 acceleration after balanced growth/margin > 0.",
                "Quality means sales growth > 0 and EBITDA margin > 0.",
                "QQQ200 half exposure: full above QQQ 200-day SMA, half below.",
                "Rebalance every two months.",
            ],
            "note": "Live tickers. Current best investable-looking system.",
        },
        {
            **live_meta,
            "id": "monthly-core",
            "label": "Prior Core: IWM Quality Monthly",
            "role": "Benchmark",
            "stats": {"CAGR": "45.38%", "Max DD": "-26.05%", "Avg DD": "-7.28%", "Loss Years": "0"},
            "date": monthly_date.date().isoformat(),
            "top": quality_scan(monthly_date, top10),
            "method": ["Same quality filter as core.", "QQQ200 half exposure.", "Monthly rebalance."],
            "note": "Live tickers. Useful benchmark.",
        },
        {
            **live_meta,
            "id": "raw10",
            "label": "Aggressive: Raw PowerTrend Top10",
            "role": "Aggressive sleeve",
            "stats": {"CAGR": "131.35%", "Max DD": "-38.97%", "Avg DD": "-11.83%", "Loss Years": "0"},
            "date": active_raw_date.date().isoformat(),
            "top": raw_scan(active_raw_date, top10, iwm_eligible, iwm_features),
            "watchDate": weekly_date.date().isoformat(),
            "watch": raw_scan(weekly_date, top10, iwm_eligible, iwm_features),
            "method": ["IWM top200.", "Top10 raw acceleration only.", "PowerTrend ON: weekly basket.", "PowerTrend OFF: monthly basket."],
            "note": "Live tickers. Huge upside, still high drawdown.",
        },
        {
            **live_meta,
            "id": "raw5",
            "label": "Rocket: Raw PowerTrend Top5",
            "role": "Competition-style",
            "stats": {"CAGR": "160.83%", "Max DD": "-58.67%", "Avg DD": "-19.87%", "Loss Years": "1"},
            "date": active_raw_date.date().isoformat(),
            "top": raw_scan(active_raw_date, top5, iwm_eligible, iwm_features),
            "watchDate": weekly_date.date().isoformat(),
            "watch": raw_scan(weekly_date, top5, iwm_eligible, iwm_features),
            "method": ["IWM top200.", "Top5 raw acceleration only.", "PowerTrend ON: weekly basket.", "PowerTrend OFF: monthly basket."],
            "note": "Live tickers. Very high return and very high pain.",
        },
        {
            **live_meta,
            "id": "raw5-quarterly",
            "label": "191-197% Test: Raw Top5 PowerTrend / Quarterly",
            "role": "Highest-return raw hybrid",
            "stats": {"CAGR": "197.06%", "Max DD": "-56.67%", "Avg DD": "-14.71%", "Loss Years": "0"},
            "date": active_raw5_quarterly_date.date().isoformat(),
            "top": raw_scan(active_raw5_quarterly_date, top5, iwm_eligible, iwm_features),
            "watchDate": weekly_date.date().isoformat(),
            "watch": raw_scan(weekly_date, top5, iwm_eligible, iwm_features),
            "method": ["IWM top200.", "Top5 raw acceleration only.", "PowerTrend ON: weekly basket.", "PowerTrend OFF: quarterly offset1 basket."],
            "note": "Live tickers for the ~191-197% raw hybrid test. Highest-return cadence, but very high drawdown.",
        },
        {
            **live_meta,
            "id": "qqq",
            "label": "QQQ Pure Acceleration",
            "role": "Large-cap growth sleeve",
            "stats": {"CAGR": "31.62%", "Max DD": "-48.23%", "Avg DD": "n/a", "Loss Years": "2"},
            "date": qqq_date.date().isoformat(),
            "top": raw_scan(qqq_date, top10, qqq_eligible, qqq_features),
            "method": ["Nasdaq-100 / QQQ current constituents.", "Top10 raw acceleration.", "Monthly rebalance."],
            "note": "Live tickers. Clean QQQ signal.",
        },
    ]


def system_payload(update_prices: bool = True, full_price_update: bool = False) -> list[dict]:
    try:
        return live_system_payload(update_prices=update_prices, full_price_update=full_price_update)
    except Exception as exc:
        print(f"Live scan failed, opening saved dashboard instead: {exc}")
        payload = saved_system_payload()
        for item in payload:
            item["isLive"] = False
            item["asOf"] = "saved reports"
            item["powertrend"] = "POWER TREND UNKNOWN"
            item["powertrendOn"] = False
        return payload


def render_html(systems: list[dict]) -> str:
    data = json.dumps(systems)
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Stock System Scanner</title>
  <style>
    body {{ margin: 0; font-family: Segoe UI, Arial, sans-serif; background: #111; color: #eee; }}
    .wrap {{ max-width: 1120px; margin: 0 auto; padding: 28px; }}
    h1 {{ margin: 0 0 6px; }}
    .sub {{ color: #aaa; margin-bottom: 22px; }}
    select {{ background: #252525; color: #fff; border: 1px solid #555; border-radius: 6px; padding: 8px 10px; min-width: 360px; }}
    .row {{ display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }}
    .pill {{ border: 1px solid #555; border-radius: 999px; padding: 5px 10px; color: #ddd; }}
    .stats {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin: 22px 0; }}
    .stat {{ background: #1d1d1d; border: 1px solid #333; border-radius: 8px; padding: 14px; }}
    .stat b {{ display: block; font-size: 26px; margin-bottom: 4px; }}
    .grid {{ display: grid; grid-template-columns: 0.9fr 1.5fr; gap: 18px; align-items: start; }}
    .card {{ background: #1b1b1b; border: 1px solid #333; border-radius: 8px; padding: 16px; }}
    table {{ border-collapse: collapse; width: 100%; overflow: hidden; border-radius: 8px; }}
    th, td {{ border-bottom: 1px solid #333; padding: 10px; text-align: left; }}
    th {{ background: #242424; }}
    tr:nth-child(even) td {{ background: #181818; }}
    .top3 {{ color: #61d394; font-weight: 700; }}
    .muted {{ color: #aaa; }}
    .note {{ color: #ddd; border-left: 3px solid #777; padding-left: 12px; }}
    .power {{ display: inline-block; border-radius: 999px; padding: 7px 12px; font-weight: 700; margin: 0 0 18px; }}
    .power-on {{ background: #12351f; color: #61d394; border: 1px solid #2d7a46; }}
    .power-off {{ background: #3a1717; color: #ff8a8a; border: 1px solid #8a3333; }}
    .live {{ color: #aaa; margin-left: 10px; }}
    @media (max-width: 800px) {{ .grid, .stats {{ grid-template-columns: 1fr; }} }}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Stock System Scanner</h1>
    <div class="sub">Double-click launcher dashboard. Pick a system, see top 10, top 3 highlighted, and basic method notes.</div>
    <div><span id="powertrend" class="power"></span><span id="liveMeta" class="live"></span></div>

    <div class="row">
      <strong>Scanner</strong>
      <select id="system"></select>
      <span class="pill" id="role"></span>
    </div>

    <div class="stats" id="stats"></div>

    <div class="grid">
      <div>
        <div class="card">
          <h3>How It Works</h3>
          <ul id="method"></ul>
          <p class="note" id="note"></p>
          <p class="muted">Saved rebalance date: <span id="date"></span></p>
        </div>
      </div>
      <div>
        <h2>Top Names</h2>
        <table>
          <thead><tr><th>Rank</th><th>Ticker</th><th>Use</th></tr></thead>
          <tbody id="top"></tbody>
        </table>
        <div id="watchBlock" style="display:none; margin-top:22px;">
          <h2>Weekly Basket If PowerTrend ON</h2>
          <p class="muted">Saved weekly date: <span id="watchDate"></span></p>
          <table>
            <thead><tr><th>Rank</th><th>Ticker</th><th>Use</th></tr></thead>
            <tbody id="watch"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
  <script>
    const systems = {data};
    const select = document.getElementById("system");
    for (const s of systems) {{
      const option = document.createElement("option");
      option.value = s.id;
      option.textContent = s.label;
      select.appendChild(option);
    }}

    function rows(tickers) {{
      return tickers.map((ticker, i) => `
        <tr>
          <td class="${{i < 3 ? 'top3' : ''}}">${{i + 1}}</td>
          <td class="${{i < 3 ? 'top3' : ''}}">${{ticker}}</td>
          <td>${{i < 3 ? 'Highest priority' : 'Portfolio name'}}</td>
        </tr>
      `).join("");
    }}

    function render() {{
      const s = systems.find(x => x.id === select.value) || systems[0];
      const power = document.getElementById("powertrend");
      power.textContent = s.powertrend || "POWER TREND UNKNOWN";
      power.className = "power " + (s.powertrendOn ? "power-on" : "power-off");
      document.getElementById("liveMeta").textContent = (s.isLive ? "Live scan" : "Saved report fallback") + " · as of " + (s.asOf || "n/a");
      document.getElementById("role").textContent = s.role;
      document.getElementById("date").textContent = s.date;
      document.getElementById("note").textContent = s.note;
      document.getElementById("method").innerHTML = s.method.map(x => `<li>${{x}}</li>`).join("");
      document.getElementById("stats").innerHTML = Object.entries(s.stats).map(([k,v]) => `
        <div class="stat"><b>${{v}}</b><span class="muted">${{k}}</span></div>
      `).join("");
      document.getElementById("top").innerHTML = rows(s.top || []);
      if (s.watch && s.watch.length) {{
        document.getElementById("watchBlock").style.display = "block";
        document.getElementById("watchDate").textContent = s.watchDate || "n/a";
        document.getElementById("watch").innerHTML = rows(s.watch);
      }} else {{
        document.getElementById("watchBlock").style.display = "none";
      }}
    }}
    select.addEventListener("change", render);
    render();
  </script>
</body>
</html>
"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the local stock scanner dashboard.")
    parser.add_argument("--no-open", action="store_true", help="Refresh the HTML dashboard without opening a browser.")
    parser.add_argument("--skip-price-update", action="store_true", help="Use existing cached prices instead of updating from FMP first.")
    parser.add_argument("--full-price-update", action="store_true", help="Update the full cached IWM universe instead of only the daily scanner set.")
    args = parser.parse_args()

    print("Preparing scanner dashboard...", flush=True)
    systems = system_payload(update_prices=not args.skip_price_update, full_price_update=args.full_price_update)
    OUT.write_text(render_html(systems), encoding="utf-8")
    JSON_OUT.write_text(
        json.dumps(
            {
                "connected": True,
                "generatedAt": datetime.now().isoformat(timespec="seconds"),
                "systems": systems,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    if not args.no_open:
        webbrowser.open(OUT.resolve().as_uri())
        print(f"Opened {OUT}", flush=True)
    else:
        print(f"Saved {OUT}", flush=True)

    try:
        from upload_scanner_json import upload_scanner_json

        upload_scanner_json(JSON_OUT)
    except RuntimeError as exc:
        print(f"Cloud upload skipped: {exc}", flush=True)
    except Exception as exc:
        print(f"Cloud upload failed: {exc}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Failed to open scanner: {exc}")
        input("Press Enter to close...")
        sys.exit(1)
