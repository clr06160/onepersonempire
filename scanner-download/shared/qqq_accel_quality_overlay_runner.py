from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import date
from typing import Any

import numpy as np
import pandas as pd

from nasdaq100_accel_momentum_risk_runner import load_price_frame, normalize_ohlcv_frame
from nasdaq100_second_derivative_scanner import BENCHMARK, ScannerConfig, build_schedules, completed_feature_frame, rank_acceleration_candidates
from quality_regime_router_runner import (
    PROJECT_ROOT,
    REPORTS_DIR,
    UNIVERSES,
    RouterConfig,
    load_cashflows,
    load_financials,
    load_tickers,
    max_drawdown_pct,
    quality_candidate_frame,
    rank_quality_candidates,
)
from tight_setup_acceleration_runner import (
    TightConfig,
    add_tight_indicators,
    coerce_bool,
    enrich_ranked_with_tight_features,
    row_as_of,
    select_iwm_top_dollar_volume,
    setup_mask,
)


QQQ_PRICE_DIR = PROJECT_ROOT / "data" / "cache" / "qqq" / "prices"


@dataclass(frozen=True)
class OverlayConfig:
    start_year: int = 2021
    end_date: str | None = None
    universe: str = "qqq"
    iwm_top_count: int = 200
    top_values: tuple[int, ...] = (5, 10)
    rule40_values: tuple[float, ...] = (0.0, 20.0, 40.0)
    quality_modes: tuple[str, ...] = ("rule40_net_income",)
    min_price: float = 1.0
    min_history_rows: int = 260
    adjusted_prices: bool = True
    output_prefix: str = f"qqq_accel_quality_overlay_{date.today().isoformat()}"


@dataclass(frozen=True)
class OverlayVariant:
    name: str
    setup_filter: str
    stop_rule: str = "none"
    quality_filter: bool = False
    rule40_min: float | None = None
    quality_mode: str = "rule40_net_income"
    rank_by: str = "accel"
    backfill: bool = False


def parse_csv_ints(value: str) -> tuple[int, ...]:
    parsed = tuple(int(part.strip()) for part in value.split(",") if part.strip())
    if not parsed or any(item <= 0 for item in parsed):
        raise argparse.ArgumentTypeError("Provide positive comma-separated integers.")
    return parsed


def cagr(total_return: float, start_date: Any, end_date: Any) -> float:
    years = max((pd.Timestamp(end_date) - pd.Timestamp(start_date)).days / 365.25, 1 / 365.25)
    return float((1 + total_return) ** (1 / years) - 1)


def load_qqq_price_frame(ticker: str, adjusted_prices: bool) -> pd.DataFrame:
    path = QQQ_PRICE_DIR / f"{ticker.upper()}.csv"
    if not path.exists():
        return pd.DataFrame()
    try:
        return normalize_ohlcv_frame(path, adjusted_prices)
    except Exception:
        return pd.DataFrame()


def variants(cfg: OverlayConfig) -> list[OverlayVariant]:
    base = [
        OverlayVariant("baseline_acceleration", "baseline"),
        OverlayVariant("trend_tight_vcp_stop5_or_low20", "trend_tight", stop_rule="stop5_or_low20"),
    ]
    quality: list[OverlayVariant] = []
    for quality_mode in cfg.quality_modes:
        for rule40_min in cfg.rule40_values:
            suffix = f"quality_{quality_mode}_gt{int(rule40_min)}"
            quality.append(
                OverlayVariant(
                    f"baseline_acceleration_{suffix}",
                    "baseline",
                    quality_filter=True,
                    rule40_min=rule40_min,
                    quality_mode=quality_mode,
                )
            )
            quality.append(
                OverlayVariant(
                    f"trend_tight_vcp_stop5_or_low20_{suffix}",
                    "trend_tight",
                    stop_rule="stop5_or_low20",
                    quality_filter=True,
                    rule40_min=rule40_min,
                    quality_mode=quality_mode,
                )
            )
    return base + quality


def rank_quality_candidates_by_mode(candidates: pd.DataFrame, threshold: float, quality_mode: str) -> pd.DataFrame:
    if candidates.empty:
        return pd.DataFrame()

    frame = candidates.copy()
    for col in [
        "rule40",
        "net_income_growth_pct",
        "sales_growth_pct",
        "revenue_growth_pct",
        "eps_growth_pct",
        "gross_margin_expansion_pct",
        "ebitda_margin_pct",
        "fcf_growth_pct",
    ]:
        if col in frame.columns:
            frame[col] = pd.to_numeric(frame[col], errors="coerce")

    mode = quality_mode.strip().lower()
    if mode == "rule40_net_income":
        frame = frame[frame["rule40"] > threshold].copy()
        if frame.empty:
            return pd.DataFrame()
        frame["rule40_rank"] = frame["rule40"].rank(ascending=False, method="min")
        frame["net_income_growth_rank"] = frame["net_income_growth_pct"].rank(ascending=False, method="min")
        frame["combined_quality_score"] = frame["rule40_rank"] + frame["net_income_growth_rank"]
        sort_cols = ["combined_quality_score", "net_income_growth_pct", "rule40"]
        ascending = [True, False, False]
    elif mode == "rule40_only":
        frame = frame[frame["rule40"] > threshold].copy()
        if frame.empty:
            return pd.DataFrame()
        frame["combined_quality_score"] = -frame["rule40"]
        sort_cols = ["rule40", "net_income_growth_pct"]
        ascending = [False, False]
    elif mode == "revenue_growth":
        frame = frame[frame["sales_growth_pct"] > threshold].copy()
        if frame.empty:
            return pd.DataFrame()
        frame["combined_quality_score"] = -frame["sales_growth_pct"]
        sort_cols = ["sales_growth_pct", "ebitda_margin_pct", "rule40"]
        ascending = [False, False, False]
    elif mode == "ebitda_margin":
        frame = frame[frame["ebitda_margin_pct"] > threshold].copy()
        if frame.empty:
            return pd.DataFrame()
        frame["combined_quality_score"] = -frame["ebitda_margin_pct"]
        sort_cols = ["ebitda_margin_pct", "sales_growth_pct", "rule40"]
        ascending = [False, False, False]
    elif mode == "fcf_growth":
        frame = frame[frame["fcf_growth_pct"] > threshold].copy()
        if frame.empty:
            return pd.DataFrame()
        frame["combined_quality_score"] = -frame["fcf_growth_pct"]
        sort_cols = ["fcf_growth_pct", "rule40", "sales_growth_pct"]
        ascending = [False, False, False]
    elif mode == "gross_margin_expansion":
        frame = frame[frame["gross_margin_expansion_pct"] > threshold].copy()
        if frame.empty:
            return pd.DataFrame()
        frame["combined_quality_score"] = -frame["gross_margin_expansion_pct"]
        sort_cols = ["gross_margin_expansion_pct", "rule40", "sales_growth_pct"]
        ascending = [False, False, False]
    elif mode == "balanced_growth_margin":
        frame = frame[(frame["sales_growth_pct"] > threshold) & (frame["ebitda_margin_pct"] > 0)].copy()
        if frame.empty:
            return pd.DataFrame()
        frame["sales_growth_rank"] = frame["sales_growth_pct"].rank(ascending=False, method="min")
        frame["ebitda_margin_rank"] = frame["ebitda_margin_pct"].rank(ascending=False, method="min")
        frame["combined_quality_score"] = frame["sales_growth_rank"] + frame["ebitda_margin_rank"]
        sort_cols = ["combined_quality_score", "sales_growth_pct", "ebitda_margin_pct"]
        ascending = [True, False, False]
    else:
        raise ValueError(f"Unsupported quality mode: {quality_mode}")

    return frame.sort_values(sort_cols, ascending=ascending).reset_index(drop=True)


def quality_passers(
    as_of: pd.Timestamp,
    universe: str,
    tickers: list[str],
    prices: dict[str, pd.Series],
    financials: dict[str, list[dict[str, Any]]],
    cashflows: dict[str, list[dict[str, Any]]],
    cfg: OverlayConfig,
) -> dict[tuple[str, float], pd.DataFrame]:
    router_cfg = RouterConfig(
        start_year=cfg.start_year,
        end_date=cfg.end_date,
        top=max(cfg.top_values),
        rule40_min=min(cfg.rule40_values),
        min_price=cfg.min_price,
        output_prefix=cfg.output_prefix,
    )
    candidates = quality_candidate_frame(universe, as_of, {universe: tickers}, prices, financials, cashflows, router_cfg)
    out: dict[tuple[str, float], pd.DataFrame] = {}
    for quality_mode in cfg.quality_modes:
        for rule40_min in cfg.rule40_values:
            ranked = rank_quality_candidates_by_mode(candidates, float(rule40_min), quality_mode)
            if not ranked.empty:
                ranked = ranked.copy()
                ranked["quality_rank"] = np.arange(1, len(ranked) + 1)
                ranked["quality_mode"] = quality_mode
                ranked["quality_threshold"] = float(rule40_min)
            out[(quality_mode, float(rule40_min))] = ranked
    return out


def simulate_variant(
    top: int,
    variant: OverlayVariant,
    universe_label: str,
    schedule: list[pd.Timestamp],
    tickers: list[str],
    feature_frames: dict[str, pd.DataFrame],
    frames: dict[str, pd.DataFrame],
    returns: pd.DataFrame,
    benchmark_returns: pd.Series,
    scanner_cfg: ScannerConfig,
    quality_by_date: dict[pd.Timestamp, dict[tuple[str, float], pd.DataFrame]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    variant_name = f"{universe_label}_accel_top{top}_monthly__{variant.name}"
    rebalance_dates = set(pd.Timestamp(item) for item in schedule[:-1])
    all_dates = [pd.Timestamp(item) for item in returns.index if schedule and schedule[0] <= item <= schedule[-1]]
    holdings: list[str] = []
    weights: dict[str, float] = {}
    stop_levels: dict[str, float] = {}
    last_rebalance: pd.Timestamp | None = None
    last_clean = 0
    last_positive = 0
    last_tight = 0
    last_quality = 0
    last_eligible = 0
    last_selected = ""
    periods: list[dict[str, Any]] = []
    trades: list[dict[str, Any]] = []
    rebalances: list[dict[str, Any]] = []

    for current_date in all_dates:
        day_returns = returns.loc[current_date] if current_date in returns.index else pd.Series(dtype="float64")
        exit_reasons: list[str] = []
        strategy_return = float(sum(float(day_returns.get(ticker, 0.0)) * weights.get(ticker, 0.0) for ticker in holdings))
        gross_exposure = float(sum(weights.get(ticker, 0.0) for ticker in holdings))

        if variant.stop_rule == "stop5_or_low20":
            for ticker in list(holdings):
                signal = row_as_of(frames.get(ticker, pd.DataFrame()), current_date)
                if signal is None:
                    continue
                close = float(signal["close"])
                stop_level = float(stop_levels.get(ticker, np.nan))
                if not pd.isna(stop_level) and close < stop_level:
                    holdings.remove(ticker)
                    weights.pop(ticker, None)
                    stop_levels.pop(ticker, None)
                    exit_reasons.append(f"{ticker}:stop5_or_low20")

        periods.append(
            {
                "date": current_date.date().isoformat(),
                "year": int(current_date.year),
                "variant": variant_name,
                "timing": "monthly",
                "top": top,
                "setup_filter": variant.setup_filter,
                "stop_rule": variant.stop_rule,
                "quality_filter": variant.quality_filter,
                "quality_mode": variant.quality_mode,
                "rule40_min": variant.rule40_min,
                "strategy_return": strategy_return,
                "benchmark_return": float(benchmark_returns.loc[current_date]) if current_date in benchmark_returns.index else 0.0,
                "invested": bool(holdings),
                "positions": int(len(holdings)),
                "gross_exposure": gross_exposure,
                "cash_weight": 1.0 - gross_exposure,
                "rebalance_date": last_rebalance.date().isoformat() if last_rebalance is not None else None,
                "selected_tickers": ",".join(holdings),
                "raw_selected_tickers": last_selected,
                "clean_tradable_candidates": last_clean,
                "positive_accel_candidates": last_positive,
                "tight_eligible_candidates": last_tight,
                "quality_pass_candidates": last_quality,
                "final_eligible_candidates": last_eligible,
                "exit_reasons_after_prior_close": ";".join(exit_reasons),
                "margin_allowed": False,
                "short_allowed": False,
                "leveraged_etfs_allowed": False,
            }
        )

        if current_date not in rebalance_dates:
            continue

        ranked = rank_acceleration_candidates(current_date, tickers, feature_frames, scanner_cfg)
        ranked = enrich_ranked_with_tight_features(ranked, frames, current_date)
        positive = ranked[coerce_bool(ranked["positive_accel_filter"])].copy() if not ranked.empty else pd.DataFrame()
        tight = positive[setup_mask(positive, variant.setup_filter)].copy() if not positive.empty else pd.DataFrame()
        eligible = tight
        quality = quality_by_date.get(current_date, {}).get((variant.quality_mode, float(variant.rule40_min or 0.0)), pd.DataFrame())
        if variant.quality_filter:
            quality_cols = [
                "ticker",
                "quality_rank",
                "rule40",
                "net_income_growth_pct",
                "combined_score_rule40_net_income",
                "combined_quality_score",
                "sales_growth_pct",
                "revenue_growth_pct",
                "eps_growth_pct",
                "gross_margin_expansion_pct",
                "fcf_growth_pct",
                "ebitda_margin_pct",
            ]
            if eligible.empty or quality.empty:
                eligible = eligible.iloc[0:0].copy()
            else:
                eligible = eligible.merge(quality[[col for col in quality_cols if col in quality.columns]], on="ticker", how="inner")
                if variant.rank_by == "quality" and "combined_score_rule40_net_income" in eligible.columns:
                    eligible = eligible.sort_values("combined_score_rule40_net_income", ascending=True)

        selected = eligible.head(top).copy()
        if variant.backfill and len(selected) < top and not tight.empty:
            already = set(selected["ticker"].astype(str)) if not selected.empty else set()
            extra = tight[~tight["ticker"].astype(str).isin(already)].head(top - len(selected))
            selected = pd.concat([selected, extra], ignore_index=True) if not selected.empty else extra.copy()
        holdings = selected["ticker"].astype(str).tolist() if not selected.empty else []
        weight = 1.0 / len(holdings) if holdings else 0.0
        weights = {ticker: weight for ticker in holdings}
        stop_levels = {}
        for ticker in holdings:
            signal = row_as_of(frames.get(ticker, pd.DataFrame()), current_date)
            if signal is None:
                continue
            close = float(signal["close"])
            low20 = float(signal.get("low20", np.nan))
            stop_levels[ticker] = max(close * 0.95, low20) if not pd.isna(low20) else close * 0.95

        last_rebalance = current_date
        last_clean = int(len(ranked))
        last_positive = int(len(positive))
        last_tight = int(len(tight))
        last_quality = int(len(quality))
        last_eligible = int(len(eligible))
        last_selected = ",".join(holdings)
        rebalances.append(
            {
                "variant": variant_name,
                "rebalance_date": current_date.date().isoformat(),
                "top": top,
                "setup_filter": variant.setup_filter,
                "stop_rule": variant.stop_rule,
                "quality_filter": variant.quality_filter,
                "quality_mode": variant.quality_mode,
                "rule40_min": variant.rule40_min,
                "clean_tradable_candidates": last_clean,
                "positive_accel_candidates": last_positive,
                "tight_eligible_candidates": last_tight,
                "quality_pass_candidates": last_quality,
                "final_eligible_candidates": last_eligible,
                "selected_positions": len(holdings),
                "false_no_trade": bool(last_positive > 0 and not holdings),
                "selected_tickers": last_selected,
            }
        )
        for rank_idx, row in selected.reset_index(drop=True).iterrows():
            trades.append(
                {
                    "variant": variant_name,
                    "event": "entry",
                    "date": current_date.date().isoformat(),
                    "ticker": row["ticker"],
                    "rank": int(rank_idx + 1),
                    "weight": weight,
                    "accel_score": row.get("accel_score"),
                    "rule40": row.get("rule40"),
                    "net_income_growth_pct": row.get("net_income_growth_pct"),
                    "sales_growth_pct": row.get("sales_growth_pct"),
                    "ebitda_margin_pct": row.get("ebitda_margin_pct"),
                    "fcf_growth_pct": row.get("fcf_growth_pct"),
                    "gross_margin_expansion_pct": row.get("gross_margin_expansion_pct"),
                    "quality_rank": row.get("quality_rank"),
                    "stop_level": round(float(stop_levels.get(str(row["ticker"]), np.nan)), 6),
                }
            )
    return periods, trades, rebalances


def add_equity_drawdown(periods: pd.DataFrame) -> pd.DataFrame:
    out = periods.copy()
    out["equity"] = np.nan
    out["drawdown_pct"] = np.nan
    for variant, group in out.sort_values("date").groupby("variant", sort=False):
        returns = pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0).clip(lower=-1.0)
        equity = (1 + returns).cumprod()
        drawdown = equity / equity.cummax() - 1
        out.loc[group.index, "equity"] = equity.to_numpy()
        out.loc[group.index, "drawdown_pct"] = drawdown.to_numpy() * 100
    return out


def build_monthly(periods: pd.DataFrame) -> pd.DataFrame:
    work = periods.copy()
    work["month"] = pd.to_datetime(work["date"]).dt.to_period("M").astype(str)
    rows = []
    for (variant, month), group in work.groupby(["variant", "month"], sort=True):
        returns = pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)
        rows.append(
            {
                "variant": variant,
                "month": month,
                "year": int(month[:4]),
                "strategy_return_pct": round(((1 + returns).prod() - 1) * 100, 2),
                "max_drawdown_pct": round(max_drawdown_pct((1 + returns).cumprod()), 2),
                "exposure_pct": round(float(group["invested"].astype(bool).mean() * 100), 2),
                "avg_positions": round(float(pd.to_numeric(group["positions"], errors="coerce").mean()), 2),
            }
        )
    return pd.DataFrame(rows).sort_values(["variant", "month"])


def build_yearly(periods: pd.DataFrame, monthly: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for (variant, year), group in periods.groupby(["variant", "year"], sort=True):
        returns = pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)
        months = monthly[monthly["variant"].eq(variant) & monthly["year"].eq(int(year))]
        rows.append(
            {
                "variant": variant,
                "year": int(year),
                "annual_return_pct": round(((1 + returns).prod() - 1) * 100, 2),
                "max_drawdown_pct": round(max_drawdown_pct((1 + returns).cumprod()), 2),
                "worst_month_pct": round(float(pd.to_numeric(months["strategy_return_pct"], errors="coerce").min()), 2) if not months.empty else np.nan,
                "exposure_pct": round(float(group["invested"].astype(bool).mean() * 100), 2),
                "avg_positions": round(float(pd.to_numeric(group["positions"], errors="coerce").mean()), 2),
            }
        )
    return pd.DataFrame(rows).sort_values(["variant", "year"])


def build_summary(periods: pd.DataFrame, yearly: pd.DataFrame, monthly: pd.DataFrame, rebalances: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for variant, group in periods.groupby("variant", sort=True):
        group = group.sort_values("date")
        returns = pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)
        total = float((1 + returns).prod() - 1)
        variant_years = yearly[yearly["variant"].eq(variant)]
        variant_months = monthly[monthly["variant"].eq(variant)]
        rb = rebalances[rebalances["variant"].eq(variant)] if not rebalances.empty else pd.DataFrame()
        rows.append(
            {
                "variant": variant,
                "top": int(group["top"].iloc[0]),
                "setup_filter": group["setup_filter"].iloc[0],
                "stop_rule": group["stop_rule"].iloc[0],
                "quality_filter": bool(group["quality_filter"].iloc[0]),
                "quality_mode": group["quality_mode"].iloc[0],
                "start_date": group["date"].iloc[0],
                "end_date": group["date"].iloc[-1],
                "total_return_pct": round(total * 100, 2),
                "cagr_pct": round(cagr(total, group["date"].iloc[0], group["date"].iloc[-1]) * 100, 2),
                "max_drawdown_pct": round(float(group["drawdown_pct"].min()), 2),
                "worst_month_pct": round(float(pd.to_numeric(variant_months["strategy_return_pct"], errors="coerce").min()), 2),
                "worst_year": int(variant_years.sort_values("annual_return_pct").iloc[0]["year"]) if not variant_years.empty else np.nan,
                "worst_year_return_pct": round(float(pd.to_numeric(variant_years["annual_return_pct"], errors="coerce").min()), 2),
                "loss_years": int(pd.to_numeric(variant_years["annual_return_pct"], errors="coerce").lt(0).sum()),
                "exposure_pct": round(float(group["invested"].astype(bool).mean() * 100), 2),
                "avg_positions": round(float(pd.to_numeric(group["positions"], errors="coerce").mean()), 2),
                "avg_positive_accel_candidates": round(float(pd.to_numeric(rb.get("positive_accel_candidates"), errors="coerce").mean()), 2) if not rb.empty else np.nan,
                "avg_tight_eligible_names": round(float(pd.to_numeric(rb.get("tight_eligible_candidates"), errors="coerce").mean()), 2) if not rb.empty else np.nan,
                "avg_quality_pass_candidates": round(float(pd.to_numeric(rb.get("quality_pass_candidates"), errors="coerce").mean()), 2) if not rb.empty else np.nan,
                "avg_final_eligible_candidates": round(float(pd.to_numeric(rb.get("final_eligible_candidates"), errors="coerce").mean()), 2) if not rb.empty else np.nan,
                "false_no_trade_rebalances": int(rb["false_no_trade"].astype(bool).sum()) if not rb.empty else 0,
                "rebalance_count": int(len(rb)),
            }
        )
    return pd.DataFrame(rows).sort_values(["top", "quality_filter", "cagr_pct"], ascending=[True, True, False])


def build_math_checks(periods: pd.DataFrame, yearly: pd.DataFrame, monthly: pd.DataFrame, summary: pd.DataFrame) -> pd.DataFrame:
    checks: list[dict[str, Any]] = []
    checks.append(
        {
            "source": "constraints",
            "check": "no_margin_or_short",
            "status": "pass" if pd.to_numeric(periods["gross_exposure"], errors="coerce").fillna(0.0).le(1.0000001).all() else "fail",
            "detail": "Gross exposure never exceeds 1x.",
        }
    )
    checks.append(
        {
            "source": "signals",
            "check": "first_signal_day_has_no_return",
            "status": "pass" if periods.groupby("variant")["strategy_return"].first().fillna(0.0).eq(0.0).all() else "fail",
            "detail": "Initial rebalance close does not earn same-day strategy return.",
        }
    )
    return pd.DataFrame(checks)


def write_report(outputs: dict[str, Any], summary: pd.DataFrame, checks: pd.DataFrame, cfg: OverlayConfig) -> None:
    universe = cfg.universe.lower().strip()
    universe_note = f"IWM top {cfg.iwm_top_count} cached stocks by recent dollar volume" if universe == "iwm" else "current local Nasdaq-100/QQQ constituents"
    lines = [
        f"# {universe.upper()} Acceleration Quality Overlay",
        "",
        f"Generated: {pd.Timestamp.now().isoformat(timespec='seconds')}",
        "",
        "## Method",
        "",
        f"- Universe: {universe_note}.",
        "- Window: five-year-style test from configured start year to latest cached QQQ date.",
        "- Baseline acceleration is compared with the same acceleration after point-in-time quality overlays.",
        f"- Quality thresholds tested: {', '.join('>' + str(value).rstrip('0').rstrip('.') for value in cfg.rule40_values)}.",
        f"- Quality modes: {', '.join(cfg.quality_modes)}.",
        "- Financial statements use filing dates at or before the rebalance date; missing filing dates use the existing conservative lag.",
        "- No margin, shorting, leveraged ETFs, fees, slippage, financing, or taxes.",
        "",
        "## Summary",
        "",
    ]
    show_cols = [
        "variant",
        "cagr_pct",
        "max_drawdown_pct",
        "loss_years",
        "worst_year",
        "worst_year_return_pct",
        "exposure_pct",
        "avg_positions",
        "quality_mode",
        "avg_quality_pass_candidates",
        "avg_final_eligible_candidates",
    ]
    display = summary[[col for col in show_cols if col in summary.columns]]
    lines.append(display.to_markdown(index=False))
    lines.extend(["", "## Math Checks", ""])
    failures = checks[checks["status"].ne("pass")] if not checks.empty else checks
    lines.append("Internal math checks passed." if failures.empty else failures.to_markdown(index=False))
    lines.extend(["", "## Caveats", ""])
    lines.append("- Current constituent files have survivorship bias.")
    if universe == "iwm":
        lines.append("- IWM top-count membership is selected using latest cached dollar volume, so this is not a fully point-in-time historical IWM universe.")
    lines.append("- Five years is a short test window; this is a fast diagnostic, not final validation.")
    lines.append("- Quality coverage can vary by ticker and rebalance date, so low candidate counts may mean the overlay is too restrictive.")
    outputs["report"].write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_backtest(cfg: OverlayConfig) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    universe = cfg.universe.lower().strip()
    if universe not in {"qqq", "iwm"}:
        raise ValueError("Unsupported universe. Use 'qqq' or 'iwm'.")
    benchmark_symbol = "IWM" if universe == "iwm" else BENCHMARK
    universe_label = f"iwm_top{cfg.iwm_top_count}" if universe == "iwm" else "qqq"

    print(f"Loading {universe_label.upper()} prices...", flush=True)
    raw_tickers = load_tickers(UNIVERSES[universe].constituents_file)
    all_symbols = sorted(set(raw_tickers + [benchmark_symbol]))
    frames: dict[str, pd.DataFrame] = {}
    warmup_start = pd.Timestamp(cfg.start_year - 2, 1, 1)
    for idx, ticker in enumerate(all_symbols, 1):
        if universe == "qqq":
            frame = load_qqq_price_frame(ticker, cfg.adjusted_prices)
        else:
            frame, _source = load_price_frame(ticker, cfg.adjusted_prices)
        if not frame.empty:
            frame = frame.loc[frame.index >= warmup_start].copy()
            frames[ticker] = add_tight_indicators(frame)
        if idx % 25 == 0 or idx == len(all_symbols):
            print(f"  loaded {idx}/{len(all_symbols)} price files", flush=True)

    if universe == "iwm":
        tight_cfg = TightConfig(
            start_year=cfg.start_year,
            end_date=cfg.end_date,
            universe=universe,
            iwm_top_count=max(1, int(cfg.iwm_top_count)),
            top_values=cfg.top_values,
            frequencies=("monthly",),
            min_price=cfg.min_price,
            min_history_rows=cfg.min_history_rows,
            adjusted_prices=cfg.adjusted_prices,
            output_prefix=cfg.output_prefix,
        )
        selected, subset = select_iwm_top_dollar_volume(raw_tickers, frames, tight_cfg)
        if not subset.empty:
            REPORTS_DIR.mkdir(exist_ok=True)
            subset.to_csv(REPORTS_DIR / f"{cfg.output_prefix}_iwm_top{cfg.iwm_top_count}_subset.csv", index=False)
        tickers_source = selected
    else:
        tickers_source = raw_tickers

    benchmark = frames.get(benchmark_symbol, pd.DataFrame())
    if benchmark.empty:
        raise RuntimeError(f"No local {benchmark_symbol} benchmark OHLCV prices found.")
    end = pd.Timestamp(cfg.end_date).normalize() if cfg.end_date else pd.Timestamp(benchmark.index.max()).normalize()
    latest_cutoff = end - pd.Timedelta(days=7)
    tickers = [
        ticker
        for ticker in tickers_source
        if ticker in frames and len(frames[ticker]) >= cfg.min_history_rows and pd.Timestamp(frames[ticker].index.max()) >= latest_cutoff
    ]
    scanner_cfg = ScannerConfig(
        start_year=cfg.start_year,
        end_date=cfg.end_date,
        top_values=cfg.top_values,
        frequencies=("monthly",),
        min_price=cfg.min_price,
        min_history_rows=cfg.min_history_rows,
    )
    feature_frames = {ticker: completed_feature_frame(frames[ticker]["return_close"]) for ticker in tickers}
    schedules = build_schedules(pd.to_numeric(benchmark["return_close"], errors="coerce").dropna(), scanner_cfg)
    schedule = schedules["monthly"]
    trading_dates = pd.DatetimeIndex(benchmark.loc[(benchmark.index >= schedule[0]) & (benchmark.index <= schedule[-1])].index).sort_values().unique()
    returns = pd.DataFrame(
        {
            ticker: pd.to_numeric(frames[ticker]["return_close"], errors="coerce").reindex(trading_dates).ffill().pct_change(fill_method=None).fillna(0.0)
            for ticker in tickers
        },
        index=trading_dates,
    ).fillna(0.0)
    benchmark_returns = benchmark["return_close"].reindex(trading_dates).ffill().pct_change(fill_method=None).fillna(0.0)

    print(f"Loading fundamentals for {len(tickers)} {universe_label.upper()} tickers...", flush=True)
    prices = {ticker: frames[ticker]["return_close"].dropna() for ticker in tickers}
    financials = {ticker: load_financials(ticker) for ticker in tickers}
    cashflows = {ticker: load_cashflows(ticker) for ticker in tickers}
    quality_by_date: dict[pd.Timestamp, dict[tuple[str, float], pd.DataFrame]] = {}
    print(f"Building quality passers for {len(schedule[:-1])} monthly rebalances...", flush=True)
    for idx, rebalance in enumerate(schedule[:-1], 1):
        date_key = pd.Timestamp(rebalance)
        quality_by_date[date_key] = quality_passers(date_key, universe, tickers, prices, financials, cashflows, cfg)
        if idx % 12 == 0 or idx == len(schedule[:-1]):
            counts = {f"{mode}_gt{int(threshold)}": len(value) for (mode, threshold), value in quality_by_date[date_key].items()}
            print(f"  {idx}/{len(schedule[:-1])} {date_key.date()} quality counts {counts}", flush=True)

    period_rows: list[dict[str, Any]] = []
    trade_rows: list[dict[str, Any]] = []
    rebalance_rows: list[dict[str, Any]] = []
    for top in cfg.top_values:
        for variant in variants(cfg):
            print(f"Simulating top{top} {variant.name}...", flush=True)
            periods, trades, rebalances = simulate_variant(
                top,
                variant,
                universe_label,
                schedule,
                tickers,
                feature_frames,
                frames,
                returns,
                benchmark_returns,
                scanner_cfg,
                quality_by_date,
            )
            period_rows.extend(periods)
            trade_rows.extend(trades)
            rebalance_rows.extend(rebalances)

    periods = add_equity_drawdown(pd.DataFrame(period_rows))
    trades = pd.DataFrame(trade_rows)
    rebalances = pd.DataFrame(rebalance_rows)
    monthly = build_monthly(periods)
    yearly = build_yearly(periods, monthly)
    summary = build_summary(periods, yearly, monthly, rebalances)
    checks = build_math_checks(periods, yearly, monthly, summary)
    return summary, yearly, monthly, periods, trades, rebalances, checks


def write_outputs(
    summary: pd.DataFrame,
    yearly: pd.DataFrame,
    monthly: pd.DataFrame,
    periods: pd.DataFrame,
    trades: pd.DataFrame,
    rebalances: pd.DataFrame,
    checks: pd.DataFrame,
    cfg: OverlayConfig,
) -> dict[str, Any]:
    REPORTS_DIR.mkdir(exist_ok=True)
    base = cfg.output_prefix
    outputs = {
        "summary": REPORTS_DIR / f"{base}_summary.csv",
        "yearly": REPORTS_DIR / f"{base}_yearly.csv",
        "monthly": REPORTS_DIR / f"{base}_monthly.csv",
        "periods": REPORTS_DIR / f"{base}_periods.csv",
        "trades": REPORTS_DIR / f"{base}_trades.csv",
        "rebalances": REPORTS_DIR / f"{base}_rebalances.csv",
        "math_checks": REPORTS_DIR / f"{base}_math_checks.csv",
        "report": REPORTS_DIR / f"{base}_report.md",
    }
    summary.to_csv(outputs["summary"], index=False)
    yearly.to_csv(outputs["yearly"], index=False)
    monthly.to_csv(outputs["monthly"], index=False)
    periods.to_csv(outputs["periods"], index=False)
    trades.to_csv(outputs["trades"], index=False)
    rebalances.to_csv(outputs["rebalances"], index=False)
    checks.to_csv(outputs["math_checks"], index=False)
    write_report(outputs, summary, checks, cfg)
    return outputs


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Acceleration quality overlay backtest.")
    parser.add_argument("--start-year", type=int, default=2021)
    parser.add_argument("--end-date")
    parser.add_argument("--universe", choices=("qqq", "iwm"), default="qqq")
    parser.add_argument("--iwm-top-count", type=int, default=200)
    parser.add_argument("--top-values", type=parse_csv_ints, default=(5, 10))
    parser.add_argument("--rule40-values", default="0,20,40", help="Comma-separated Rule of 40 thresholds to test.")
    parser.add_argument(
        "--quality-modes",
        default="rule40_net_income",
        help=(
            "Comma-separated quality modes: rule40_net_income, rule40_only, revenue_growth, "
            "ebitda_margin, fcf_growth, gross_margin_expansion, balanced_growth_margin, or all."
        ),
    )
    parser.add_argument("--min-price", type=float, default=1.0)
    parser.add_argument("--output-prefix", default=f"qqq_accel_quality_overlay_{date.today().isoformat()}")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    quality_modes = tuple(part.strip().lower() for part in args.quality_modes.split(",") if part.strip())
    if "all" in quality_modes:
        quality_modes = (
            "rule40_net_income",
            "rule40_only",
            "revenue_growth",
            "ebitda_margin",
            "fcf_growth",
            "gross_margin_expansion",
            "balanced_growth_margin",
        )
    cfg = OverlayConfig(
        start_year=args.start_year,
        end_date=args.end_date,
        universe=args.universe,
        iwm_top_count=max(1, int(args.iwm_top_count)),
        top_values=args.top_values,
        rule40_values=tuple(float(part.strip()) for part in args.rule40_values.split(",") if part.strip()),
        quality_modes=quality_modes,
        min_price=args.min_price,
        output_prefix=args.output_prefix,
    )
    summary, yearly, monthly, periods, trades, rebalances, checks = run_backtest(cfg)
    outputs = write_outputs(summary, yearly, monthly, periods, trades, rebalances, checks, cfg)
    for name, path in outputs.items():
        print(f"{name}: {path}")
    print()
    print(summary.to_string(index=False))
    failures = checks[checks["status"].ne("pass")] if not checks.empty else checks
    print(f"\nInternal math checks: {len(checks)} run, {len(failures)} failures")


if __name__ == "__main__":
    main()
