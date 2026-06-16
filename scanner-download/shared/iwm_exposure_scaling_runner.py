from __future__ import annotations

import argparse
import sys
import traceback
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

import numpy as np
import pandas as pd

from crash_speed_overlay_runner import build_broad_features, build_hold_mask, build_signal_specs
from nasdaq100_accel_momentum_risk_runner import load_price_frame
from nasdaq100_second_derivative_scanner import (
    FEATURE_DEFINITION,
    SCORE_DEFINITION,
    ScannerConfig,
    build_schedules,
    completed_feature_frame,
    rank_acceleration_candidates,
)
from quality_regime_router_runner import PROJECT_ROOT, REPORTS_DIR, UNIVERSES, load_tickers, max_drawdown_pct
from tight_setup_acceleration_runner import (
    TightConfig,
    add_tight_indicators,
    coerce_bool,
    enrich_ranked_with_tight_features,
    select_iwm_top_dollar_volume,
    setup_mask,
)


OUTPUT_PREFIX = f"iwm_exposure_scaling_{date.today().isoformat()}"


@dataclass(frozen=True)
class RunConfig:
    start_year: int = 2010
    end_date: str | None = None
    iwm_top_count: int = 200
    top_values: tuple[int, ...] = (5, 10)
    setup_filters: tuple[str, ...] = ("baseline", "trend_tight")
    min_price: float = 1.0
    min_history_rows: int = 260
    adjusted_prices: bool = True
    output_prefix: str = OUTPUT_PREFIX


@dataclass(frozen=True)
class OverlaySpec:
    name: str
    qqq200_mode: str = "none"  # none, cash, half
    capit3_cash_days: int = 0
    equity_scale: str = "none"  # none, dd_5_10_15_cash, dd_5_10_15_tiny


def parse_csv_ints(value: str) -> tuple[int, ...]:
    parsed = tuple(int(part.strip()) for part in value.split(",") if part.strip())
    if not parsed or any(item <= 0 for item in parsed):
        raise argparse.ArgumentTypeError("Provide positive comma-separated integers.")
    return parsed


def parse_csv_strings(value: str) -> tuple[str, ...]:
    parsed = tuple(part.strip().lower() for part in value.split(",") if part.strip())
    allowed = {"baseline", "tight", "trend_tight", "strict_trend_tight"}
    unsupported = sorted(set(parsed) - allowed)
    if unsupported:
        raise argparse.ArgumentTypeError(f"Unsupported setup filters: {unsupported}. Allowed: {sorted(allowed)}")
    if not parsed:
        raise argparse.ArgumentTypeError("Provide at least one setup filter.")
    return parsed


def cagr(total_return: float, start_date: Any, end_date: Any) -> float:
    years = max((pd.Timestamp(end_date) - pd.Timestamp(start_date)).days / 365.25, 1 / 365.25)
    if total_return <= -1:
        return -1.0
    return float((1 + total_return) ** (1 / years) - 1)


def overlay_specs() -> list[OverlaySpec]:
    return [
        OverlaySpec("base_x1"),
        OverlaySpec("equity_dd_scale_cash", equity_scale="dd_5_10_15_cash"),
        OverlaySpec("equity_dd_scale_tiny", equity_scale="dd_5_10_15_tiny"),
        OverlaySpec("qqq200_cash", qqq200_mode="cash"),
        OverlaySpec("qqq200_half", qqq200_mode="half"),
        OverlaySpec("capit3_cash10", capit3_cash_days=10),
        OverlaySpec("qqq200_capit3_cash10", qqq200_mode="cash", capit3_cash_days=10),
        OverlaySpec("equity_dd_scale_cash_qqq200_capit3", qqq200_mode="cash", capit3_cash_days=10, equity_scale="dd_5_10_15_cash"),
        OverlaySpec("equity_dd_scale_tiny_qqq200_capit3", qqq200_mode="cash", capit3_cash_days=10, equity_scale="dd_5_10_15_tiny"),
    ]


def load_iwm_top200_universe(cfg: RunConfig) -> tuple[list[str], dict[str, pd.DataFrame], dict[str, str], pd.DataFrame]:
    raw_tickers = load_tickers(UNIVERSES["iwm"].constituents_file)
    all_symbols = sorted(set(raw_tickers + ["IWM", "QQQ", "SPY"]))
    frames: dict[str, pd.DataFrame] = {}
    sources: dict[str, str] = {}
    for ticker in all_symbols:
        frame, source = load_price_frame(ticker, cfg.adjusted_prices)
        if not frame.empty:
            frames[ticker] = add_tight_indicators(frame)
            sources[ticker] = source

    tight_cfg = TightConfig(
        start_year=cfg.start_year,
        end_date=cfg.end_date,
        universe="iwm",
        iwm_top_count=cfg.iwm_top_count,
        min_price=cfg.min_price,
        min_history_rows=cfg.min_history_rows,
        adjusted_prices=cfg.adjusted_prices,
        output_prefix=cfg.output_prefix,
    )
    selected, subset = select_iwm_top_dollar_volume(raw_tickers, frames, tight_cfg)
    return selected, frames, sources, subset


def build_qqq200_exposure(frames: dict[str, pd.DataFrame], dates: pd.DatetimeIndex, mode: str) -> pd.Series:
    if mode == "none":
        return pd.Series(1.0, index=dates)
    qqq = frames.get("QQQ", pd.DataFrame())
    if qqq.empty:
        raise RuntimeError("QQQ prices are required for QQQ200 overlays.")
    close = pd.to_numeric(qqq["close"], errors="coerce")
    sma200 = close.rolling(200).mean()
    # Prior completed market state controls today's exposure.
    above = (close > sma200).reindex(dates).ffill().shift(1).fillna(False)
    if mode == "cash":
        return above.astype(float)
    if mode == "half":
        return above.where(above, 0.5).astype(float)
    raise ValueError(f"Unsupported qqq200 mode: {mode}")


def build_capit3_exposure(dates: pd.DatetimeIndex, hold_days: int) -> pd.Series:
    if hold_days <= 0:
        return pd.Series(1.0, index=dates)
    broad, _coverage = build_broad_features(dates)
    signal_spec = next(spec for spec in build_signal_specs() if spec.name == "capitulation_score_ge3")
    signal = coerce_bool(signal_spec.signal_func(broad))
    active = build_hold_mask(signal, hold_days).reindex(dates).fillna(False)
    return (~active.astype(bool)).astype(float)


def equity_scale_from_prior_drawdown(prior_drawdown: float, mode: str) -> float:
    if mode == "none":
        return 1.0
    if prior_drawdown <= -0.15:
        return 0.0 if mode == "dd_5_10_15_cash" else 0.10
    if prior_drawdown <= -0.10:
        return 0.25
    if prior_drawdown <= -0.05:
        return 0.50
    return 1.0


def variant_id(top: int, setup_filter: str, spec: OverlaySpec) -> str:
    return f"iwm_top200_accel_top{top}_monthly__{setup_filter}__{spec.name}"


def simulate_variant(
    top: int,
    setup_filter: str,
    spec: OverlaySpec,
    schedule: list[pd.Timestamp],
    tickers: list[str],
    feature_frames: dict[str, pd.DataFrame],
    frames: dict[str, pd.DataFrame],
    returns: pd.DataFrame,
    benchmark_returns: pd.Series,
    scanner_cfg: ScannerConfig,
    qqq200_exposure: pd.Series,
    capit3_exposure: pd.Series,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    variant = variant_id(top, setup_filter, spec)
    rebalance_dates = set(pd.Timestamp(item) for item in schedule[:-1])
    all_dates = [pd.Timestamp(item) for item in returns.index if schedule and schedule[0] <= item <= schedule[-1]]
    holdings: list[str] = []
    weights: dict[str, float] = {}
    last_rebalance: pd.Timestamp | None = None
    last_clean = 0
    last_positive = 0
    last_eligible = 0
    last_selected = ""
    periods: list[dict[str, Any]] = []
    trades: list[dict[str, Any]] = []
    rebalance_rows: list[dict[str, Any]] = []
    equity = 1.0
    peak = 1.0
    prior_drawdown = 0.0

    for current_date in all_dates:
        day_returns = returns.loc[current_date] if current_date in returns.index else pd.Series(dtype="float64")
        raw_return = float(sum(float(day_returns.get(ticker, 0.0)) * weights.get(ticker, 0.0) for ticker in holdings))
        dd_exposure = equity_scale_from_prior_drawdown(prior_drawdown, spec.equity_scale)
        market_exposure = float(qqq200_exposure.get(current_date, 1.0)) * float(capit3_exposure.get(current_date, 1.0))
        exposure = min(dd_exposure, market_exposure)
        strategy_return = raw_return * exposure
        equity *= 1.0 + strategy_return
        peak = max(peak, equity)
        current_drawdown = equity / peak - 1.0
        periods.append(
            {
                "date": current_date.date().isoformat(),
                "year": int(current_date.year),
                "variant": variant,
                "top": top,
                "setup_filter": setup_filter,
                "overlay": spec.name,
                "strategy_return": strategy_return,
                "raw_rotation_return": raw_return,
                "benchmark_return": float(benchmark_returns.get(current_date, 0.0)),
                "equity_exposure": dd_exposure,
                "qqq200_exposure": float(qqq200_exposure.get(current_date, 1.0)),
                "capit3_exposure": float(capit3_exposure.get(current_date, 1.0)),
                "gross_exposure": exposure,
                "positions": int(len(holdings)) if exposure > 0 else 0,
                "raw_positions": int(len(holdings)),
                "portfolio_drawdown_signal_pct": prior_drawdown * 100,
                "drawdown_pct": current_drawdown * 100,
                "rebalance_date": last_rebalance.date().isoformat() if last_rebalance is not None else None,
                "selected_tickers": ",".join(holdings),
                "clean_tradable_candidates": last_clean,
                "positive_accel_candidates": last_positive,
                "eligible_candidates": last_eligible,
                "rank_metric": SCORE_DEFINITION,
                "feature_definition": FEATURE_DEFINITION,
                "margin_allowed": False,
                "short_allowed": False,
                "leveraged_etfs_allowed": False,
            }
        )
        # Tomorrow's exposure can react to today's completed equity state.
        prior_drawdown = current_drawdown

        if current_date not in rebalance_dates:
            continue
        ranked = rank_acceleration_candidates(current_date, tickers, feature_frames, scanner_cfg)
        ranked = enrich_ranked_with_tight_features(ranked, frames, current_date)
        positive = ranked[coerce_bool(ranked["positive_accel_filter"])].copy() if not ranked.empty else pd.DataFrame()
        eligible = positive[setup_mask(positive, setup_filter)].copy() if not positive.empty else pd.DataFrame()
        selected = eligible.head(top).copy()
        holdings = selected["ticker"].astype(str).tolist() if not selected.empty else []
        weight = 1.0 / len(holdings) if holdings else 0.0
        weights = {ticker: weight for ticker in holdings}
        last_rebalance = current_date
        last_clean = int(len(ranked))
        last_positive = int(len(positive))
        last_eligible = int(len(eligible))
        last_selected = ",".join(holdings)
        rebalance_rows.append(
            {
                "variant": variant,
                "rebalance_date": current_date.date().isoformat(),
                "top": top,
                "setup_filter": setup_filter,
                "overlay": spec.name,
                "clean_tradable_candidates": last_clean,
                "positive_accel_candidates": last_positive,
                "eligible_candidates": last_eligible,
                "selected_positions": len(holdings),
                "false_no_trade": bool(last_positive > 0 and not holdings),
                "selected_tickers": last_selected,
            }
        )
        for rank_idx, row in selected.reset_index(drop=True).iterrows():
            trades.append(
                {
                    "variant": variant,
                    "event": "rebalance_entry",
                    "date": current_date.date().isoformat(),
                    "ticker": row["ticker"],
                    "rank": int(rank_idx + 1),
                    "weight": round(weight, 6),
                    "accel_score": row.get("accel_score"),
                    "setup_filter": setup_filter,
                    "overlay": spec.name,
                }
            )

    return periods, trades, rebalance_rows


def build_yearly(periods: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for (variant, year), group in periods.sort_values("date").groupby(["variant", "year"], sort=False):
        returns = pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)
        equity = (1 + returns).cumprod()
        rows.append(
            {
                "variant": variant,
                "year": int(year),
                "annual_return_pct": round(float(equity.iloc[-1] - 1) * 100, 2),
                "max_drawdown_pct": round(max_drawdown_pct(equity), 2),
                "exposure_pct": round(float(pd.to_numeric(group["gross_exposure"], errors="coerce").mean() * 100), 2),
                "avg_positions": round(float(pd.to_numeric(group["positions"], errors="coerce").mean()), 2),
            }
        )
    return pd.DataFrame(rows)


def build_summary(periods: pd.DataFrame, yearly: pd.DataFrame, rebalances: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for variant, group in periods.sort_values("date").groupby("variant", sort=False):
        returns = pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)
        equity = (1 + returns).cumprod()
        total = float(equity.iloc[-1] - 1)
        variant_years = yearly[yearly["variant"].eq(variant)]
        rb = rebalances[rebalances["variant"].eq(variant)] if not rebalances.empty else pd.DataFrame()
        rows.append(
            {
                "variant": variant,
                "top": int(group["top"].iloc[0]),
                "setup_filter": group["setup_filter"].iloc[0],
                "overlay": group["overlay"].iloc[0],
                "start_date": group["date"].iloc[0],
                "end_date": group["date"].iloc[-1],
                "total_return_pct": round(total * 100, 2),
                "cagr_pct": round(cagr(total, group["date"].iloc[0], group["date"].iloc[-1]) * 100, 2),
                "max_drawdown_pct": round(max_drawdown_pct(equity), 2),
                "worst_year": int(variant_years.sort_values("annual_return_pct").iloc[0]["year"]) if not variant_years.empty else np.nan,
                "worst_year_return_pct": round(float(pd.to_numeric(variant_years["annual_return_pct"], errors="coerce").min()), 2),
                "loss_years": int(pd.to_numeric(variant_years["annual_return_pct"], errors="coerce").lt(0).sum()),
                "exposure_pct": round(float(pd.to_numeric(group["gross_exposure"], errors="coerce").mean() * 100), 2),
                "avg_positions": round(float(pd.to_numeric(group["positions"], errors="coerce").mean()), 2),
                "avg_positive_accel_candidates": round(float(pd.to_numeric(rb.get("positive_accel_candidates"), errors="coerce").mean()), 2)
                if not rb.empty
                else np.nan,
                "avg_eligible_candidates": round(float(pd.to_numeric(rb.get("eligible_candidates"), errors="coerce").mean()), 2)
                if not rb.empty
                else np.nan,
                "false_no_trade_rebalances": int(rb["false_no_trade"].astype(bool).sum()) if not rb.empty else 0,
                "rebalance_count": int(len(rb)),
                "margin_allowed": False,
                "short_allowed": False,
                "leveraged_etfs_allowed": False,
            }
        )
    return pd.DataFrame(rows).sort_values(["setup_filter", "top", "cagr_pct"], ascending=[True, True, False])


def write_report(prefix: str, summary: pd.DataFrame, outputs: dict[str, Any], cfg: RunConfig) -> None:
    lines = [
        "# IWM Exposure Scaling Backtest",
        "",
        f"Generated: {datetime.now().isoformat(timespec='seconds')}",
        "",
        "## Method",
        "",
        f"- Universe: IWM top {cfg.iwm_top_count} cached stocks by latest 63-day dollar volume.",
        "- Selection: monthly acceleration rank, no individual stock stops.",
        "- Exposure overlays use prior completed equity/market state before today's return.",
        "- Equity drawdown scaling: 0 to -5% = 100%, -5% to -10% = 50%, -10% to -15% = 25%, below -15% = cash or 10% tiny exposure.",
        "- QQQ200 overlay uses prior completed QQQ close vs SMA200.",
        "- Capitulation overlay uses existing shifted capitulation_score_ge3 and 10 trading-day cash hold.",
        "",
        "## Outputs",
        "",
    ]
    for name, path in outputs.items():
        lines.append(f"- {name}: `{path.relative_to(PROJECT_ROOT)}`")
    lines.extend(["", "## Best Rows", ""])
    show = summary.sort_values(["cagr_pct", "max_drawdown_pct"], ascending=[False, False]).head(20)
    lines.append(show.to_markdown(index=False))
    lines.extend(["", "## Caveats", ""])
    lines.append("- IWM top-200 membership is selected from the latest cache, not point-in-time historical Russell membership.")
    lines.append("- This tests portfolio-level exposure control, not realistic intraday stop fills.")
    (REPORTS_DIR / f"{prefix}_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_backtest(cfg: RunConfig) -> dict[str, Any]:
    REPORTS_DIR.mkdir(exist_ok=True)
    tickers, frames, _sources, subset = load_iwm_top200_universe(cfg)
    benchmark = frames.get("IWM", pd.DataFrame())
    if benchmark.empty:
        raise RuntimeError("IWM benchmark prices are required.")
    end = pd.Timestamp(cfg.end_date).normalize() if cfg.end_date else pd.Timestamp(benchmark.index.max()).normalize()
    latest_cutoff = end - pd.Timedelta(days=7)
    coverage = []
    eligible_tickers = []
    for ticker in tickers:
        frame = frames.get(ticker, pd.DataFrame())
        is_eligible = len(frame) >= cfg.min_history_rows and not frame.empty and pd.Timestamp(frame.index.max()) >= latest_cutoff
        coverage.append(
            {
                "ticker": ticker,
                "eligible": is_eligible,
                "rows": int(len(frame)),
                "first_date": frame.index.min().date().isoformat() if not frame.empty else "",
                "last_date": frame.index.max().date().isoformat() if not frame.empty else "",
            }
        )
        if is_eligible:
            eligible_tickers.append(ticker)

    scanner_cfg = ScannerConfig(
        start_year=cfg.start_year,
        end_date=cfg.end_date,
        top_values=cfg.top_values,
        frequencies=("monthly",),
        min_price=cfg.min_price,
        min_history_rows=cfg.min_history_rows,
    )
    feature_frames = {
        ticker: completed_feature_frame(frames[ticker]["return_close"])
        for ticker in eligible_tickers
        if ticker in frames and len(frames[ticker]) >= cfg.min_history_rows
    }
    schedules = build_schedules(pd.to_numeric(benchmark["return_close"], errors="coerce").dropna(), scanner_cfg)
    schedule = schedules.get("monthly", [])
    if len(schedule) < 2:
        raise RuntimeError("Monthly schedule has fewer than two dates.")
    trading_dates = pd.DatetimeIndex(
        benchmark.loc[(benchmark.index >= schedule[0]) & (benchmark.index <= schedule[-1])].index
    ).sort_values().unique()
    returns = pd.DataFrame(
        {
            ticker: pd.to_numeric(frames[ticker]["return_close"], errors="coerce").reindex(trading_dates).ffill().pct_change(fill_method=None).fillna(0.0)
            for ticker in eligible_tickers
            if ticker in frames
        },
        index=trading_dates,
    ).fillna(0.0)
    benchmark_returns = benchmark["return_close"].reindex(trading_dates).ffill().pct_change(fill_method=None).fillna(0.0)

    qqq200_by_mode = {mode: build_qqq200_exposure(frames, trading_dates, mode) for mode in ("none", "cash", "half")}
    capit_by_days = {0: build_capit3_exposure(trading_dates, 0), 10: build_capit3_exposure(trading_dates, 10)}

    period_rows: list[dict[str, Any]] = []
    trade_rows: list[dict[str, Any]] = []
    rebalance_rows: list[dict[str, Any]] = []
    for top in cfg.top_values:
        for setup_filter in cfg.setup_filters:
            for spec in overlay_specs():
                periods, trades, rebalances = simulate_variant(
                    top=top,
                    setup_filter=setup_filter,
                    spec=spec,
                    schedule=schedule,
                    tickers=eligible_tickers,
                    feature_frames=feature_frames,
                    frames=frames,
                    returns=returns,
                    benchmark_returns=benchmark_returns,
                    scanner_cfg=scanner_cfg,
                    qqq200_exposure=qqq200_by_mode[spec.qqq200_mode],
                    capit3_exposure=capit_by_days[spec.capit3_cash_days],
                )
                period_rows.extend(periods)
                trade_rows.extend(trades)
                rebalance_rows.extend(rebalances)

    periods = pd.DataFrame(period_rows)
    yearly = build_yearly(periods)
    rebalances = pd.DataFrame(rebalance_rows)
    summary = build_summary(periods, yearly, rebalances)
    trades = pd.DataFrame(trade_rows)
    coverage_df = pd.DataFrame(coverage)
    prefix = cfg.output_prefix
    outputs = {
        "summary": REPORTS_DIR / f"{prefix}_summary.csv",
        "yearly": REPORTS_DIR / f"{prefix}_yearly.csv",
        "periods": REPORTS_DIR / f"{prefix}_periods.csv",
        "trades": REPORTS_DIR / f"{prefix}_trades.csv",
        "rebalances": REPORTS_DIR / f"{prefix}_rebalances.csv",
        "coverage": REPORTS_DIR / f"{prefix}_coverage.csv",
        "iwm_subset": REPORTS_DIR / f"{prefix}_iwm_top{cfg.iwm_top_count}_subset.csv",
        "report": REPORTS_DIR / f"{prefix}_report.md",
    }
    summary.to_csv(outputs["summary"], index=False)
    yearly.to_csv(outputs["yearly"], index=False)
    periods.to_csv(outputs["periods"], index=False)
    trades.to_csv(outputs["trades"], index=False)
    rebalances.to_csv(outputs["rebalances"], index=False)
    coverage_df.to_csv(outputs["coverage"], index=False)
    subset.to_csv(outputs["iwm_subset"], index=False)
    write_report(prefix, summary, outputs, cfg)
    return outputs


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="IWM top-200 acceleration portfolio exposure scaling tests.")
    parser.add_argument("--start-year", type=int, default=2010)
    parser.add_argument("--end-date")
    parser.add_argument("--iwm-top-count", type=int, default=200)
    parser.add_argument("--top-values", type=parse_csv_ints, default=(5, 10))
    parser.add_argument("--setup-filters", type=parse_csv_strings, default=("baseline", "trend_tight"))
    parser.add_argument("--min-price", type=float, default=1.0)
    parser.add_argument("--min-history-rows", type=int, default=260)
    parser.add_argument("--adjusted-prices", type=lambda value: value.strip().lower() not in {"0", "false", "no", "n"}, default=True)
    parser.add_argument("--output-prefix", default=OUTPUT_PREFIX)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    cfg = RunConfig(
        start_year=args.start_year,
        end_date=args.end_date,
        iwm_top_count=max(1, int(args.iwm_top_count)),
        top_values=args.top_values,
        setup_filters=args.setup_filters,
        min_price=args.min_price,
        min_history_rows=args.min_history_rows,
        adjusted_prices=bool(args.adjusted_prices),
        output_prefix=args.output_prefix,
    )
    try:
        outputs = run_backtest(cfg)
    except Exception:
        print(traceback.format_exc())
        sys.exit(1)
    for name, path in outputs.items():
        print(f"{name}: {path}")
    summary = pd.read_csv(outputs["summary"])
    print()
    print(summary.sort_values(["cagr_pct", "max_drawdown_pct"], ascending=[False, False]).to_string(index=False))


if __name__ == "__main__":
    main()
