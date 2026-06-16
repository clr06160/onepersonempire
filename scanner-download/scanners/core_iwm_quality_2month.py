from __future__ import annotations

import argparse
import sys
import traceback
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

import numpy as np
import pandas as pd

from iwm_exposure_scaling_runner import build_qqq200_exposure
from nasdaq100_accel_momentum_risk_runner import load_price_frame
from nasdaq100_second_derivative_scanner import ScannerConfig, build_schedules, completed_feature_frame, rank_acceleration_candidates
from nasdaq_power_trend_runner import RunConfig as PowerTrendConfig
from nasdaq_power_trend_runner import add_power_trend_features, build_market_frame
from qqq_accel_quality_overlay_runner import OverlayConfig, quality_passers
from quality_regime_router_runner import PROJECT_ROOT, REPORTS_DIR, UNIVERSES, load_cashflows, load_financials, load_tickers, max_drawdown_pct
from tight_setup_acceleration_runner import TightConfig, add_tight_indicators, enrich_ranked_with_tight_features, select_iwm_top_dollar_volume


OUTPUT_PREFIX = f"iwm_powertrend_hybrid_quality_{date.today().isoformat()}"


@dataclass(frozen=True)
class RunConfig:
    start_year: int = 2021
    end_date: str | None = None
    iwm_top_count: int = 200
    top_values: tuple[int, ...] = (5, 10)
    quality_mode: str = "balanced_growth_margin"
    quality_threshold: float = 0.0
    off_cadences: tuple[str, ...] = ("monthly", "two_month", "quarterly")
    min_price: float = 1.0
    min_history_rows: int = 260
    adjusted_prices: bool = True
    output_prefix: str = OUTPUT_PREFIX


def parse_csv_ints(value: str) -> tuple[int, ...]:
    parsed = tuple(int(part.strip()) for part in value.split(",") if part.strip())
    if not parsed or any(item <= 0 for item in parsed):
        raise argparse.ArgumentTypeError("Provide positive comma-separated integers.")
    return parsed


def parse_csv_strings(value: str) -> tuple[str, ...]:
    parsed = tuple(part.strip().lower() for part in value.split(",") if part.strip())
    allowed = {"monthly", "two_month", "quarterly"}
    unsupported = sorted(set(parsed) - allowed)
    if unsupported:
        raise argparse.ArgumentTypeError(f"Unsupported cadences: {unsupported}. Allowed: {sorted(allowed)}")
    return parsed


def cagr(total_return: float, start_date: Any, end_date: Any) -> float:
    years = max((pd.Timestamp(end_date) - pd.Timestamp(start_date)).days / 365.25, 1 / 365.25)
    if total_return <= -1:
        return -1.0
    return float((1 + total_return) ** (1 / years) - 1)


def every_n_month_schedule(trading_dates: pd.DatetimeIndex, n_months: int) -> list[pd.Timestamp]:
    frame = pd.DataFrame({"date": pd.DatetimeIndex(trading_dates).sort_values()})
    frame["month"] = frame["date"].dt.to_period("M")
    first_by_month = frame.groupby("month", sort=True)["date"].first().reset_index()
    selected = [pd.Timestamp(item) for item in first_by_month.iloc[::n_months]["date"].tolist()]
    if selected and selected[-1] != pd.Timestamp(trading_dates[-1]):
        selected.append(pd.Timestamp(trading_dates[-1]))
    return selected


def summarize_periods(variant: str, periods: pd.DataFrame) -> dict[str, Any]:
    group = periods.sort_values("date").copy()
    returns = pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)
    equity = (1 + returns).cumprod()
    drawdown = equity / equity.cummax() - 1
    total = float(equity.iloc[-1] - 1)
    yearly = (
        pd.DataFrame({"date": pd.to_datetime(group["date"]), "ret": returns})
        .assign(year=lambda item: item["date"].dt.year)
        .groupby("year")["ret"]
        .apply(lambda item: (1 + item).prod() - 1)
    )
    active_frequency = group.get("active_frequency", pd.Series("", index=group.index)).astype(str)
    return {
        "variant": variant,
        "top": int(group["top"].iloc[0]) if "top" in group.columns else np.nan,
        "start_date": pd.Timestamp(group["date"].iloc[0]).date().isoformat(),
        "end_date": pd.Timestamp(group["date"].iloc[-1]).date().isoformat(),
        "total_return_pct": round(total * 100, 2),
        "cagr_pct": round(cagr(total, group["date"].iloc[0], group["date"].iloc[-1]) * 100, 2),
        "avg_drawdown_pct": round(float(drawdown.mean() * 100), 2),
        "median_drawdown_pct": round(float(drawdown.median() * 100), 2),
        "max_drawdown_pct": round(float(drawdown.min() * 100), 2),
        "worst_year": int(yearly.idxmin()) if not yearly.empty else np.nan,
        "worst_year_return_pct": round(float(yearly.min() * 100), 2) if not yearly.empty else np.nan,
        "loss_years": int(yearly.lt(0).sum()),
        "weekly_days_pct": round(float(active_frequency.eq("weekly").mean() * 100), 2),
        "avg_positions": round(float(pd.to_numeric(group.get("positions", pd.Series(np.nan, index=group.index)), errors="coerce").mean()), 2),
        "avg_qqq200_half_exposure_pct": round(float(pd.to_numeric(group.get("qqq200_half_exposure", pd.Series(np.nan, index=group.index)), errors="coerce").mean() * 100), 2),
        "days_below_10pct": round(float(drawdown.le(-0.10).mean() * 100), 2),
        "days_below_15pct": round(float(drawdown.le(-0.15).mean() * 100), 2),
        "days_below_20pct": round(float(drawdown.le(-0.20).mean() * 100), 2),
        "days_below_25pct": round(float(drawdown.le(-0.25).mean() * 100), 2),
        "days_below_30pct": round(float(drawdown.le(-0.30).mean() * 100), 2),
    }


def build_yearly(periods: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    work = periods.copy()
    work["year"] = pd.to_datetime(work["date"]).dt.year
    for (variant, year), group in work.groupby(["variant", "year"], sort=True):
        returns = pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)
        equity = (1 + returns).cumprod()
        rows.append(
            {
                "variant": variant,
                "year": int(year),
                "annual_return_pct": round(float((1 + returns).prod() - 1) * 100, 2),
                "max_drawdown_pct": round(max_drawdown_pct(equity), 2),
                "weekly_days_pct": round(float(group["active_frequency"].astype(str).eq("weekly").mean() * 100), 2),
                "avg_positions": round(float(pd.to_numeric(group["positions"], errors="coerce").mean()), 2),
            }
        )
    return pd.DataFrame(rows).sort_values(["variant", "year"])


def simulate_quality_accel_stream(
    top: int,
    frequency: str,
    schedule: list[pd.Timestamp],
    trading_dates: pd.DatetimeIndex,
    tickers: list[str],
    frames: dict[str, pd.DataFrame],
    feature_frames: dict[str, pd.DataFrame],
    returns: pd.DataFrame,
    scanner_cfg: ScannerConfig,
    quality_by_date: dict[pd.Timestamp, pd.DataFrame],
    qqq200_half_exposure: pd.Series,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    rebalance_dates = set(pd.Timestamp(item) for item in schedule[:-1])
    holdings: list[str] = []
    weights: dict[str, float] = {}
    last_rebalance: pd.Timestamp | None = None
    period_rows: list[dict[str, Any]] = []
    rebalance_rows: list[dict[str, Any]] = []

    for current_date in trading_dates:
        day_returns = returns.loc[current_date] if current_date in returns.index else pd.Series(dtype="float64")
        raw_return = float(sum(float(day_returns.get(ticker, 0.0)) * weights.get(ticker, 0.0) for ticker in holdings))
        exposure = float(qqq200_half_exposure.get(current_date, 1.0))
        period_rows.append(
            {
                "date": current_date,
                "top": top,
                "frequency": frequency,
                "strategy_return": raw_return * exposure,
                "raw_return": raw_return,
                "qqq200_half_exposure": exposure,
                "positions": len(holdings),
                "rebalance_date": last_rebalance,
                "selected_tickers": ",".join(holdings),
            }
        )

        # Rebalance after today's return is recorded. The new basket earns from
        # the next completed close-to-close period, avoiding same-day lookahead.
        if current_date not in rebalance_dates:
            continue

        ranked = rank_acceleration_candidates(current_date, tickers, feature_frames, scanner_cfg)
        ranked = enrich_ranked_with_tight_features(ranked, frames, current_date)
        positive = ranked[ranked["positive_accel_filter"].astype(bool)].copy() if not ranked.empty else pd.DataFrame()
        quality = quality_by_date.get(pd.Timestamp(current_date), pd.DataFrame())
        quality_cols = ["ticker", "quality_rank", "sales_growth_pct", "ebitda_margin_pct", "rule40", "combined_quality_score"]
        if positive.empty or quality.empty:
            eligible = positive.iloc[0:0].copy()
        else:
            eligible = positive.merge(quality[[col for col in quality_cols if col in quality.columns]], on="ticker", how="inner")

        selected = eligible.head(top).copy()
        holdings = selected["ticker"].astype(str).tolist() if not selected.empty else []
        weight = 1.0 / len(holdings) if holdings else 0.0
        weights = {ticker: weight for ticker in holdings}
        last_rebalance = current_date
        rebalance_rows.append(
            {
                "date": current_date,
                "top": top,
                "frequency": frequency,
                "positive_candidates": len(positive),
                "quality_candidates": len(quality),
                "eligible_candidates": len(eligible),
                "selected_positions": len(holdings),
                "selected_tickers": ",".join(holdings),
            }
        )

    return pd.DataFrame(period_rows), pd.DataFrame(rebalance_rows)


def run_backtest(cfg: RunConfig) -> dict[str, Any]:
    REPORTS_DIR.mkdir(exist_ok=True)
    raw_tickers = load_tickers(UNIVERSES["iwm"].constituents_file)
    all_symbols = sorted(set(raw_tickers + ["IWM", "QQQ"]))

    frames: dict[str, pd.DataFrame] = {}
    for idx, ticker in enumerate(all_symbols, 1):
        frame, _source = load_price_frame(ticker, cfg.adjusted_prices)
        if not frame.empty:
            frames[ticker] = add_tight_indicators(frame)
        if idx % 250 == 0 or idx == len(all_symbols):
            print(f"Loaded prices {idx}/{len(all_symbols)}", flush=True)

    benchmark = frames.get("IWM", pd.DataFrame())
    if benchmark.empty:
        raise RuntimeError("IWM benchmark prices are required.")
    end = pd.Timestamp(cfg.end_date).normalize() if cfg.end_date else pd.Timestamp(benchmark.index.max()).normalize()

    tight_cfg = TightConfig(
        start_year=cfg.start_year,
        end_date=end.date().isoformat(),
        universe="iwm",
        iwm_top_count=cfg.iwm_top_count,
        top_values=cfg.top_values,
        frequencies=("weekly", "monthly"),
        min_price=cfg.min_price,
        min_history_rows=cfg.min_history_rows,
        adjusted_prices=cfg.adjusted_prices,
        output_prefix=cfg.output_prefix,
    )
    selected_tickers, subset = select_iwm_top_dollar_volume(raw_tickers, frames, tight_cfg)
    subset.to_csv(REPORTS_DIR / f"{cfg.output_prefix}_iwm_top{cfg.iwm_top_count}_subset.csv", index=False)

    latest_cutoff = end - pd.Timedelta(days=7)
    tickers = [
        ticker
        for ticker in selected_tickers
        if ticker in frames and len(frames[ticker]) >= cfg.min_history_rows and pd.Timestamp(frames[ticker].index.max()) >= latest_cutoff
    ]
    print(f"Eligible IWM top{cfg.iwm_top_count} tickers: {len(tickers)}", flush=True)

    scanner_cfg = ScannerConfig(
        start_year=cfg.start_year,
        end_date=end.date().isoformat(),
        top_values=cfg.top_values,
        frequencies=("weekly", "monthly"),
        min_price=cfg.min_price,
        min_history_rows=cfg.min_history_rows,
    )
    feature_frames = {ticker: completed_feature_frame(frames[ticker]["return_close"]) for ticker in tickers}
    schedules = build_schedules(pd.to_numeric(benchmark["return_close"], errors="coerce").dropna(), scanner_cfg)
    global_start = min(schedule[0] for schedule in schedules.values() if schedule)
    global_end = max(schedule[-1] for schedule in schedules.values() if schedule)
    trading_dates = pd.DatetimeIndex(benchmark.loc[(benchmark.index >= global_start) & (benchmark.index <= global_end)].index).sort_values().unique()
    returns = pd.DataFrame(
        {
            ticker: pd.to_numeric(frames[ticker]["return_close"], errors="coerce")
            .reindex(trading_dates)
            .ffill()
            .pct_change(fill_method=None)
            .fillna(0.0)
            for ticker in tickers
        },
        index=trading_dates,
    ).fillna(0.0)

    qqq200_half = build_qqq200_exposure({"QQQ": frames["QQQ"]}, trading_dates, mode="half")

    prices = {ticker: frames[ticker]["return_close"].dropna() for ticker in tickers}
    financials: dict[str, list[dict[str, Any]]] = {}
    cashflows: dict[str, list[dict[str, Any]]] = {}
    for idx, ticker in enumerate(tickers, 1):
        financials[ticker] = load_financials(ticker)
        cashflows[ticker] = load_cashflows(ticker)
        if idx % 50 == 0 or idx == len(tickers):
            print(f"Loaded fundamentals {idx}/{len(tickers)}", flush=True)

    all_rebalance_dates = sorted(set(schedules["weekly"][:-1]).union(set(schedules["monthly"][:-1])))
    for cadence in cfg.off_cadences:
        if cadence == "two_month":
            all_rebalance_dates = sorted(set(all_rebalance_dates).union(set(every_n_month_schedule(trading_dates, 2)[:-1])))
        elif cadence == "quarterly":
            all_rebalance_dates = sorted(set(all_rebalance_dates).union(set(every_n_month_schedule(trading_dates, 3)[:-1])))

    quality_cfg = OverlayConfig(
        start_year=cfg.start_year,
        end_date=end.date().isoformat(),
        universe="iwm",
        iwm_top_count=cfg.iwm_top_count,
        top_values=cfg.top_values,
        rule40_values=(cfg.quality_threshold,),
        quality_modes=(cfg.quality_mode,),
        min_price=cfg.min_price,
        min_history_rows=cfg.min_history_rows,
        adjusted_prices=cfg.adjusted_prices,
        output_prefix=cfg.output_prefix,
    )
    quality_by_date: dict[pd.Timestamp, pd.DataFrame] = {}
    for idx, rebalance_date in enumerate(all_rebalance_dates, 1):
        qdict = quality_passers(pd.Timestamp(rebalance_date), "iwm", tickers, prices, financials, cashflows, quality_cfg)
        quality_by_date[pd.Timestamp(rebalance_date)] = qdict.get((cfg.quality_mode, float(cfg.quality_threshold)), pd.DataFrame())
        if idx % 25 == 0 or idx == len(all_rebalance_dates):
            print(f"Built quality passers {idx}/{len(all_rebalance_dates)}", flush=True)

    power_cfg = PowerTrendConfig(
        start=f"{cfg.start_year}-01-01",
        end=end.date().isoformat(),
        initial_capital=10_000.0,
        adjusted_prices=cfg.adjusted_prices,
        output_prefix=cfg.output_prefix,
        include_same_day_diagnostic=False,
    )
    market, _sources = build_market_frame(power_cfg)
    market = add_power_trend_features(market)
    market.index = pd.to_datetime(market.index).normalize()
    power = market[["power_trend_on_completed", "power_trend_state_completed"]].copy()
    power["power_trend_on_signal"] = power["power_trend_on_completed"].shift(1).fillna(False).astype(bool)
    power["power_trend_state_signal"] = np.where(power["power_trend_on_signal"], "POWER_TREND_ON", "POWER_TREND_OFF")
    power = power.reset_index().rename(columns={"index": "date"})

    period_chunks: list[pd.DataFrame] = []
    rebalance_chunks: list[pd.DataFrame] = []
    summary_rows: list[dict[str, Any]] = []

    off_schedules: dict[str, list[pd.Timestamp]] = {"monthly": schedules["monthly"]}
    if "two_month" in cfg.off_cadences:
        off_schedules["two_month"] = every_n_month_schedule(trading_dates, 2)
    if "quarterly" in cfg.off_cadences:
        off_schedules["quarterly"] = every_n_month_schedule(trading_dates, 3)

    for top in cfg.top_values:
        print(f"Simulating exact weekly quality stream top{top}...", flush=True)
        weekly_stream, weekly_rebalances = simulate_quality_accel_stream(
            top, "weekly", schedules["weekly"], trading_dates, tickers, frames, feature_frames, returns, scanner_cfg, quality_by_date, qqq200_half
        )
        weekly_stream["variant"] = f"top{top}_weekly_quality_qqq200_half_only"
        weekly_stream["active_frequency"] = "weekly"
        weekly_rebalances["variant"] = weekly_stream["variant"].iloc[0]
        period_chunks.append(weekly_stream)
        rebalance_chunks.append(weekly_rebalances)
        summary_rows.append(summarize_periods(weekly_stream["variant"].iloc[0], weekly_stream))

        for off_name, off_schedule in off_schedules.items():
            print(f"Simulating off cadence {off_name} quality stream top{top}...", flush=True)
            off_stream, off_rebalances = simulate_quality_accel_stream(
                top, off_name, off_schedule, trading_dates, tickers, frames, feature_frames, returns, scanner_cfg, quality_by_date, qqq200_half
            )
            off_variant = f"top{top}_{off_name}_quality_qqq200_half_only"
            off_stream["variant"] = off_variant
            off_stream["active_frequency"] = off_name
            off_rebalances["variant"] = off_variant
            period_chunks.append(off_stream)
            rebalance_chunks.append(off_rebalances)
            summary_rows.append(summarize_periods(off_variant, off_stream))

            hybrid = (
                off_stream[["date", "strategy_return", "positions", "qqq200_half_exposure"]]
                .rename(columns={"strategy_return": "off_return", "positions": "off_positions"})
                .merge(
                    weekly_stream[["date", "strategy_return", "positions"]].rename(
                        columns={"strategy_return": "weekly_return", "positions": "weekly_positions"}
                    ),
                    on="date",
                    how="inner",
                )
                .merge(power[["date", "power_trend_on_signal", "power_trend_state_signal"]], on="date", how="left")
                .sort_values("date")
                .reset_index(drop=True)
            )
            hybrid["power_trend_on_signal"] = hybrid["power_trend_on_signal"].fillna(False).astype(bool)
            hybrid["active_frequency"] = np.where(hybrid["power_trend_on_signal"], "weekly", off_name)
            hybrid["strategy_return"] = np.where(hybrid["power_trend_on_signal"], hybrid["weekly_return"], hybrid["off_return"])
            hybrid["positions"] = np.where(hybrid["power_trend_on_signal"], hybrid["weekly_positions"], hybrid["off_positions"])
            hybrid["top"] = top
            hybrid["frequency"] = f"weekly_else_{off_name}"
            hybrid["variant"] = f"top{top}_powertrend_weekly_else_{off_name}_quality_qqq200_half"
            period_chunks.append(hybrid)
            summary_rows.append(summarize_periods(hybrid["variant"].iloc[0], hybrid))

    periods = pd.concat(period_chunks, ignore_index=True)
    rebalances = pd.concat(rebalance_chunks, ignore_index=True) if rebalance_chunks else pd.DataFrame()
    summary = pd.DataFrame(summary_rows).sort_values(["top", "cagr_pct", "max_drawdown_pct"], ascending=[True, False, False])
    yearly = build_yearly(periods)

    outputs = {
        "summary": REPORTS_DIR / f"{cfg.output_prefix}_summary.csv",
        "yearly": REPORTS_DIR / f"{cfg.output_prefix}_yearly.csv",
        "periods": REPORTS_DIR / f"{cfg.output_prefix}_periods.csv",
        "rebalances": REPORTS_DIR / f"{cfg.output_prefix}_rebalances.csv",
        "report": REPORTS_DIR / f"{cfg.output_prefix}_report.md",
    }
    summary.to_csv(outputs["summary"], index=False)
    yearly.to_csv(outputs["yearly"], index=False)
    periods.to_csv(outputs["periods"], index=False)
    rebalances.to_csv(outputs["rebalances"], index=False)

    lines = [
        "# IWM PowerTrend Hybrid Quality Backtest",
        "",
        f"Generated: {datetime.now().isoformat(timespec='seconds')}",
        "",
        "## Method",
        "",
        f"- Universe: IWM top {cfg.iwm_top_count} by latest cached dollar volume.",
        f"- Selection: top acceleration names after `{cfg.quality_mode} > {cfg.quality_threshold}` quality filter.",
        "- Exposure: QQQ200 half overlay uses prior completed QQQ close vs SMA200.",
        "- Hybrid timing: prior completed Nasdaq Power Trend ON uses weekly stream; OFF uses monthly, two-month, or quarterly stream.",
        "- No same-day signal lookahead: daily return is recorded before rebalance selection is applied.",
        "",
        "## Summary",
        "",
        summary.to_markdown(index=False),
        "",
        "## Outputs",
        "",
    ]
    for name, path in outputs.items():
        lines.append(f"- {name}: `{path.relative_to(PROJECT_ROOT)}`")
    outputs["report"].write_text("\n".join(lines) + "\n", encoding="utf-8")
    return outputs


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Exact IWM quality acceleration PowerTrend weekly/off-cadence hybrid test.")
    parser.add_argument("--start-year", type=int, default=2021)
    parser.add_argument("--end-date")
    parser.add_argument("--iwm-top-count", type=int, default=200)
    parser.add_argument("--top-values", type=parse_csv_ints, default=(5, 10))
    parser.add_argument("--quality-mode", default="balanced_growth_margin")
    parser.add_argument("--quality-threshold", type=float, default=0.0)
    parser.add_argument("--off-cadences", type=parse_csv_strings, default=("monthly", "two_month", "quarterly"))
    parser.add_argument("--min-price", type=float, default=1.0)
    parser.add_argument("--min-history-rows", type=int, default=260)
    parser.add_argument("--output-prefix", default=OUTPUT_PREFIX)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    cfg = RunConfig(
        start_year=args.start_year,
        end_date=args.end_date,
        iwm_top_count=args.iwm_top_count,
        top_values=args.top_values,
        quality_mode=args.quality_mode,
        quality_threshold=args.quality_threshold,
        off_cadences=args.off_cadences,
        min_price=args.min_price,
        min_history_rows=args.min_history_rows,
        output_prefix=args.output_prefix,
    )
    try:
        outputs = run_backtest(cfg)
    except Exception:
        print(traceback.format_exc())
        sys.exit(1)
    for name, path in outputs.items():
        print(f"{name}: {path}")
    print()
    print(pd.read_csv(outputs["summary"]).to_string(index=False))


if __name__ == "__main__":
    main()
