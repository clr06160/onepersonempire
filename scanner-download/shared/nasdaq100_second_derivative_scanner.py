from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from quality_regime_router_runner import (
    PROJECT_ROOT,
    REPORTS_DIR,
    UNIVERSES,
    cache_price_file_index,
    load_price_series,
    load_tickers,
    max_drawdown_pct,
)


UNIVERSE = "qqq"
BENCHMARK = "QQQ"
FEATURE_WINDOWS = (10, 20, 50)
SCORE_DEFINITION = "z(acceleration_20)+0.5*z(roc_20)+0.25*z(acceleration_10)"
FEATURE_DEFINITION = "roc_n=close/close.shift(n)-1; acceleration_n=roc_n-roc_n.shift(n)"


@dataclass(frozen=True)
class ScannerConfig:
    start_year: int = 2010
    end_date: str | None = None
    top_values: tuple[int, ...] = (5, 10)
    frequencies: tuple[str, ...] = ("weekly", "monthly", "semiannual")
    min_price: float = 1.0
    min_history_rows: int = 120
    output_prefix: str = "nasdaq100_second_derivative_scanner"


def cagr(total_return: float, start_date: Any, end_date: Any) -> float:
    years = max((pd.Timestamp(end_date) - pd.Timestamp(start_date)).days / 365.25, 1 / 365.25)
    return float((1 + total_return) ** (1 / years) - 1)


def parse_csv_ints(value: str) -> tuple[int, ...]:
    parsed = tuple(int(part.strip()) for part in value.split(",") if part.strip())
    if not parsed or any(item <= 0 for item in parsed):
        raise argparse.ArgumentTypeError("Provide positive comma-separated integers.")
    return parsed


def parse_csv_strings(value: str) -> tuple[str, ...]:
    parsed = tuple(part.strip().lower() for part in value.split(",") if part.strip())
    allowed = {"weekly", "monthly", "semiannual"}
    unsupported = sorted(set(parsed) - allowed)
    if unsupported:
        raise argparse.ArgumentTypeError(f"Unsupported frequencies: {unsupported}. Allowed: {sorted(allowed)}")
    if not parsed:
        raise argparse.ArgumentTypeError("Provide at least one frequency.")
    return parsed


def completed_feature_frame(series: pd.Series) -> pd.DataFrame:
    close = pd.to_numeric(series, errors="coerce").dropna().astype("float64")
    frame = pd.DataFrame({"close": close})
    for window in FEATURE_WINDOWS:
        roc = close / close.shift(window) - 1
        frame[f"roc_{window}"] = roc
        frame[f"acceleration_{window}"] = roc - roc.shift(window)
    return frame


def features_as_of(feature_frame: pd.DataFrame, as_of: pd.Timestamp) -> dict[str, Any] | None:
    if feature_frame.empty:
        return None
    history = feature_frame.loc[:as_of].dropna(subset=["close"])
    if history.empty:
        return None
    row = history.iloc[-1]
    out: dict[str, Any] = {"feature_date": pd.Timestamp(history.index[-1])}
    for column in [
        "close",
        "roc_10",
        "roc_20",
        "roc_50",
        "acceleration_10",
        "acceleration_20",
        "acceleration_50",
    ]:
        value = row.get(column)
        out[column] = None if pd.isna(value) else float(value)
    return out


def zscore(frame: pd.DataFrame, column: str) -> pd.Series:
    values = pd.to_numeric(frame[column], errors="coerce")
    std = values.std(ddof=0)
    if pd.isna(std) or float(std) == 0:
        return pd.Series(0.0, index=frame.index)
    return (values - values.mean()) / std


def rank_acceleration_candidates(
    as_of: pd.Timestamp,
    tickers: list[str],
    feature_frames: dict[str, pd.DataFrame],
    cfg: ScannerConfig,
) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    stale_cutoff = as_of - pd.Timedelta(days=7)
    for ticker in tickers:
        values = features_as_of(feature_frames.get(ticker, pd.DataFrame()), as_of)
        if values is None:
            continue
        feature_date = pd.Timestamp(values["feature_date"])
        row = {"ticker": ticker, **values}
        row["feature_date"] = feature_date.date().isoformat()
        row["fresh_price"] = feature_date >= stale_cutoff
        rows.append(row)

    frame = pd.DataFrame(rows)
    if frame.empty:
        return frame

    required = ["roc_20", "acceleration_20", "acceleration_10", "close"]
    for column in required + ["roc_10", "roc_50", "acceleration_50"]:
        if column in frame.columns:
            frame[column] = pd.to_numeric(frame[column], errors="coerce")

    clean = frame.dropna(subset=required).copy()
    clean = clean[(clean["close"] >= cfg.min_price) & clean["fresh_price"].astype(bool)]
    if clean.empty:
        return clean

    for column in ["acceleration_20", "roc_20", "acceleration_10"]:
        clean[f"{column}_z"] = zscore(clean, column)

    clean["accel_score"] = (
        clean["acceleration_20_z"].fillna(0.0)
        + 0.5 * clean["roc_20_z"].fillna(0.0)
        + 0.25 * clean["acceleration_10_z"].fillna(0.0)
    )
    clean["positive_accel_filter"] = (clean["acceleration_20"] > 0) & (clean["roc_20"] > 0)
    clean = clean.sort_values(
        ["accel_score", "roc_20", "acceleration_20", "ticker"],
        ascending=[False, False, False, True],
    ).reset_index(drop=True)
    clean["accel_rank"] = np.arange(1, len(clean) + 1)
    return clean


def first_trading_dates_by_period(trading_dates: pd.DatetimeIndex, frequency: str) -> list[pd.Timestamp]:
    frame = pd.DataFrame({"date": trading_dates})
    if frequency == "weekly":
        key = frame["date"].dt.strftime("%G-%V")
    elif frequency == "monthly":
        key = frame["date"].dt.to_period("M").astype(str)
    elif frequency == "semiannual":
        half = np.where(frame["date"].dt.month <= 6, "H1", "H2")
        key = frame["date"].dt.year.astype(str) + "-" + pd.Series(half, index=frame.index)
    else:
        raise ValueError(f"Unsupported frequency: {frequency}")
    starts = frame.groupby(key, sort=True)["date"].first().tolist()
    return [pd.Timestamp(item) for item in starts]


def build_schedules(benchmark: pd.Series, cfg: ScannerConfig) -> dict[str, list[pd.Timestamp]]:
    end = pd.Timestamp(cfg.end_date).normalize() if cfg.end_date else pd.Timestamp(benchmark.index.max()).normalize()
    trading_dates = pd.DatetimeIndex(benchmark.dropna().index).sort_values().unique()
    trading_dates = trading_dates[(trading_dates >= pd.Timestamp(cfg.start_year, 1, 1)) & (trading_dates <= end)]
    schedules: dict[str, list[pd.Timestamp]] = {}
    for frequency in cfg.frequencies:
        starts = first_trading_dates_by_period(trading_dates, frequency)
        if len(trading_dates) and (not starts or starts[-1] != trading_dates[-1]):
            starts.append(pd.Timestamp(trading_dates[-1]))
        schedules[frequency] = sorted(pd.DatetimeIndex(starts).unique().to_list())
    return schedules


def aligned_returns(prices: dict[str, pd.Series], trading_dates: pd.DatetimeIndex) -> pd.DataFrame:
    columns = {}
    for ticker, series in prices.items():
        aligned = pd.to_numeric(series, errors="coerce").reindex(trading_dates).ffill()
        columns[ticker] = aligned.pct_change(fill_method=None).fillna(0.0)
    return pd.DataFrame(columns, index=trading_dates).fillna(0.0)


def variant_name(top: int, frequency: str) -> str:
    return f"nasdaq100_accel_top{top}_{frequency}"


def simulate_variant(
    frequency: str,
    top: int,
    schedule: list[pd.Timestamp],
    tickers: list[str],
    feature_frames: dict[str, pd.DataFrame],
    returns: pd.DataFrame,
    benchmark_returns: pd.Series,
    cfg: ScannerConfig,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    variant = variant_name(top, frequency)
    rebalance_dates = set(pd.Timestamp(item) for item in schedule[:-1])
    all_dates = [pd.Timestamp(item) for item in returns.index if schedule and schedule[0] <= item <= schedule[-1]]
    holdings: list[str] = []
    holding_weights: dict[str, float] = {}
    last_rebalance: pd.Timestamp | None = None
    last_candidates = 0
    last_positive = 0
    periods: list[dict[str, Any]] = []
    trades: list[dict[str, Any]] = []
    snapshots: list[dict[str, Any]] = []

    for current_date in all_dates:
        day_returns = returns.loc[current_date] if current_date in returns.index else pd.Series(dtype="float64")
        if holdings:
            strategy_return = float(sum(float(day_returns.get(ticker, 0.0)) * holding_weights[ticker] for ticker in holdings))
            gross_exposure = 1.0
            invested = True
        else:
            strategy_return = 0.0
            gross_exposure = 0.0
            invested = False

        periods.append(
            {
                "date": current_date.date().isoformat(),
                "year": int(current_date.year),
                "variant": variant,
                "timing": frequency,
                "top": top,
                "selected_universe": "nasdaq100_current_qqq_constituents",
                "benchmark": BENCHMARK,
                "strategy_return": strategy_return,
                "benchmark_return": float(benchmark_returns.loc[current_date]) if current_date in benchmark_returns.index else 0.0,
                "invested": invested,
                "positions": int(len(holdings)),
                "selected_positions": int(len(holdings)),
                "clean_tradable_candidates": int(last_candidates),
                "positive_accel_candidates": int(last_positive),
                "gross_exposure": gross_exposure,
                "rebalance_date": last_rebalance.date().isoformat() if last_rebalance is not None else None,
                "decision_reason": "prior_completed_rebalance_holdings" if last_rebalance is not None else "initial_cash_before_first_rebalance",
                "rank_metric": SCORE_DEFINITION,
                "feature_definition": FEATURE_DEFINITION,
                "margin_allowed": False,
                "short_allowed": False,
                "leveraged_etfs_allowed": False,
            }
        )

        if current_date in rebalance_dates:
            ranked = rank_acceleration_candidates(current_date, tickers, feature_frames, cfg)
            eligible = ranked[ranked["positive_accel_filter"].astype(bool)].copy() if not ranked.empty else pd.DataFrame()
            selected = eligible.head(top).copy()
            holdings = selected["ticker"].astype(str).tolist() if not selected.empty else []
            weight = 1.0 / len(holdings) if holdings else 0.0
            holding_weights = {ticker: weight for ticker in holdings}
            last_rebalance = current_date
            last_candidates = int(len(ranked))
            last_positive = int(len(eligible))

            selected_tickers = set(holdings)
            for _, row in ranked.iterrows():
                snapshots.append(
                    {
                        "rebalance_date": current_date.date().isoformat(),
                        "timing": frequency,
                        "top": top,
                        "variant": variant,
                        "ticker": row["ticker"],
                        "selected": str(row["ticker"]) in selected_tickers,
                        "accel_rank": int(row["accel_rank"]),
                        "accel_score": row["accel_score"],
                        "roc_10": row["roc_10"],
                        "roc_20": row["roc_20"],
                        "roc_50": row.get("roc_50"),
                        "acceleration_10": row["acceleration_10"],
                        "acceleration_20": row["acceleration_20"],
                        "acceleration_50": row.get("acceleration_50"),
                        "positive_accel_filter": bool(row["positive_accel_filter"]),
                        "feature_date": row["feature_date"],
                    }
                )
            for rank, row in selected.reset_index(drop=True).iterrows():
                trades.append(
                    {
                        "variant": variant,
                        "timing": frequency,
                        "top": top,
                        "rebalance_date": current_date.date().isoformat(),
                        "ticker": row["ticker"],
                        "rank": int(rank + 1),
                        "weight": weight,
                        "accel_score": row["accel_score"],
                        "roc_20": row["roc_20"],
                        "acceleration_20": row["acceleration_20"],
                        "acceleration_10": row["acceleration_10"],
                        "feature_date": row["feature_date"],
                        "selected_count": int(len(holdings)),
                    }
                )

    return periods, trades, snapshots


def build_benchmark_periods(
    trading_dates: pd.DatetimeIndex,
    benchmark_returns: pd.Series,
    cfg: ScannerConfig,
) -> pd.DataFrame:
    end = pd.Timestamp(cfg.end_date).normalize() if cfg.end_date else pd.Timestamp(trading_dates.max()).normalize()
    dates = trading_dates[(trading_dates >= pd.Timestamp(cfg.start_year, 1, 1)) & (trading_dates <= end)]
    rows = []
    for current_date in dates:
        rows.append(
            {
                "date": current_date.date().isoformat(),
                "year": int(current_date.year),
                "variant": "qqq_buy_hold",
                "timing": "benchmark",
                "top": 1,
                "selected_universe": BENCHMARK,
                "benchmark": BENCHMARK,
                "strategy_return": float(benchmark_returns.loc[current_date]),
                "benchmark_return": float(benchmark_returns.loc[current_date]),
                "invested": True,
                "positions": 1,
                "selected_positions": 1,
                "clean_tradable_candidates": 1,
                "positive_accel_candidates": 1,
                "gross_exposure": 1.0,
                "rebalance_date": None,
                "decision_reason": "buy_hold_benchmark",
                "rank_metric": "buy_hold",
                "feature_definition": "QQQ close-to-close buy and hold",
                "margin_allowed": False,
                "short_allowed": False,
                "leveraged_etfs_allowed": False,
            }
        )
    if rows:
        rows[0]["strategy_return"] = 0.0
        rows[0]["benchmark_return"] = 0.0
    return pd.DataFrame(rows)


def add_equity_drawdown(periods: pd.DataFrame) -> pd.DataFrame:
    if periods.empty:
        return periods
    out = periods.copy()
    out["equity"] = np.nan
    out["drawdown_pct"] = np.nan
    for variant, group in out.sort_values("date").groupby("variant"):
        returns = pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)
        equity = (1 + returns).cumprod()
        drawdown = equity / equity.cummax() - 1
        out.loc[group.index, "equity"] = equity.to_numpy()
        out.loc[group.index, "drawdown_pct"] = drawdown.to_numpy() * 100
    return out


def build_yearly(periods: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for (variant, timing, top, year), group in periods.groupby(["variant", "timing", "top", "year"], sort=True):
        group = group.sort_values("date")
        returns = pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)
        benchmark = pd.to_numeric(group["benchmark_return"], errors="coerce").fillna(0.0)
        equity = (1 + returns).cumprod()
        bench_equity = (1 + benchmark).cumprod()
        rows.append(
            {
                "variant": variant,
                "timing": timing,
                "top": int(top),
                "year": int(year),
                "periods": int(len(group)),
                "annual_return_pct": round(((1 + returns).prod() - 1) * 100, 2),
                "benchmark_return_pct": round(((1 + benchmark).prod() - 1) * 100, 2),
                "excess_return_pct": round((((1 + returns).prod() - 1) - ((1 + benchmark).prod() - 1)) * 100, 2),
                "max_drawdown_pct": round(max_drawdown_pct(equity), 2),
                "benchmark_max_drawdown_pct": round(max_drawdown_pct(bench_equity), 2),
                "exposure_pct": round(float(group["invested"].astype(bool).mean() * 100), 2),
                "avg_positions": round(float(pd.to_numeric(group["positions"], errors="coerce").mean()), 2),
                "margin_allowed": False,
                "short_allowed": False,
                "leveraged_etfs_allowed": False,
            }
        )
    return pd.DataFrame(rows).sort_values(["variant", "year"])


def build_monthly(periods: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    work = periods.copy()
    work["month"] = pd.to_datetime(work["date"]).dt.to_period("M").astype(str)
    for (variant, timing, top, month), group in work.groupby(["variant", "timing", "top", "month"], sort=True):
        group = group.sort_values("date")
        returns = pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)
        benchmark = pd.to_numeric(group["benchmark_return"], errors="coerce").fillna(0.0)
        strategy_return = (1 + returns).prod() - 1
        benchmark_return = (1 + benchmark).prod() - 1
        rows.append(
            {
                "variant": variant,
                "timing": timing,
                "top": int(top),
                "month": month,
                "strategy_return_pct": round(strategy_return * 100, 2),
                "benchmark_return_pct": round(benchmark_return * 100, 2),
                "excess_return_pct": round((strategy_return - benchmark_return) * 100, 2),
                "exposure_pct": round(float(group["invested"].astype(bool).mean() * 100), 2),
                "avg_positions": round(float(pd.to_numeric(group["positions"], errors="coerce").mean()), 2),
                "days": int(len(group)),
            }
        )
    return pd.DataFrame(rows).sort_values(["variant", "month"])


def build_summary(periods: pd.DataFrame, yearly: pd.DataFrame, monthly: pd.DataFrame, cfg: ScannerConfig) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for (variant, timing, top), group in periods.groupby(["variant", "timing", "top"], sort=True):
        group = group.sort_values("date")
        returns = pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)
        benchmark = pd.to_numeric(group["benchmark_return"], errors="coerce").fillna(0.0)
        total_return = float((1 + returns).prod() - 1)
        benchmark_total = float((1 + benchmark).prod() - 1)
        variant_years = yearly[yearly["variant"].astype(str).eq(str(variant))]
        variant_months = monthly[monthly["variant"].astype(str).eq(str(variant))]
        rows.append(
            {
                "variant": variant,
                "timing": timing,
                "top": int(top),
                "start_date": group["date"].iloc[0],
                "end_date": group["date"].iloc[-1],
                "years": round(max((pd.Timestamp(group["date"].iloc[-1]) - pd.Timestamp(group["date"].iloc[0])).days / 365.25, 1e-9), 2),
                "final_equity": round(float((1 + returns).cumprod().iloc[-1]), 6),
                "total_return_pct": round(total_return * 100, 2),
                "annualized_return_pct": round(cagr(total_return, group["date"].iloc[0], group["date"].iloc[-1]) * 100, 2),
                "max_drawdown_pct": round(float(group["drawdown_pct"].min()), 2),
                "benchmark_total_return_pct": round(benchmark_total * 100, 2),
                "benchmark_annualized_return_pct": round(cagr(benchmark_total, group["date"].iloc[0], group["date"].iloc[-1]) * 100, 2),
                "excess_total_return_pct": round((total_return - benchmark_total) * 100, 2),
                "exposure_pct": round(float(group["invested"].astype(bool).mean() * 100), 2),
                "avg_positions": round(float(pd.to_numeric(group["positions"], errors="coerce").mean()), 2),
                "win_months": int((pd.to_numeric(variant_months["strategy_return_pct"], errors="coerce") > 0).sum()),
                "loss_months": int((pd.to_numeric(variant_months["strategy_return_pct"], errors="coerce") < 0).sum()),
                "win_years": int((pd.to_numeric(variant_years["annual_return_pct"], errors="coerce") > 0).sum()),
                "loss_years": int((pd.to_numeric(variant_years["annual_return_pct"], errors="coerce") < 0).sum()),
                "worst_month_pct": round(float(pd.to_numeric(variant_months["strategy_return_pct"], errors="coerce").min()), 2),
                "margin_allowed": False,
                "short_allowed": False,
                "leveraged_etfs_allowed": False,
                "rank_metric": SCORE_DEFINITION if variant != "qqq_buy_hold" else "buy_hold",
            }
        )
    return pd.DataFrame(rows).sort_values(["annualized_return_pct", "max_drawdown_pct"], ascending=[False, False])


def build_coverage(
    tickers: list[str],
    prices: dict[str, pd.Series],
    feature_frames: dict[str, pd.DataFrame],
    cfg: ScannerConfig,
    benchmark: pd.Series,
) -> pd.DataFrame:
    rows = []
    end = pd.Timestamp(cfg.end_date).normalize() if cfg.end_date else pd.Timestamp(benchmark.index.max()).normalize()
    latest_cutoff = end - pd.Timedelta(days=7)
    for ticker in tickers:
        series = prices.get(ticker, pd.Series(dtype="float64"))
        features = feature_frames.get(ticker, pd.DataFrame())
        first = pd.Timestamp(series.index.min()).date().isoformat() if not series.empty else None
        last_ts = pd.Timestamp(series.index.max()).normalize() if not series.empty else None
        rows.append(
            {
                "ticker": ticker,
                "has_price": not series.empty,
                "price_rows": int(len(series)),
                "first_price_date": first,
                "last_price_date": last_ts.date().isoformat() if last_ts is not None else None,
                "latest_within_7d_of_end": bool(last_ts is not None and last_ts >= latest_cutoff),
                "has_min_history": bool(len(series) >= cfg.min_history_rows),
                "has_feature_history": bool(not features.empty and features["acceleration_20"].notna().any()),
                "cache_files_seen": ";".join(str(path.relative_to(PROJECT_ROOT)) for path in cache_price_file_index().get(ticker, [])),
            }
        )
    return pd.DataFrame(rows)


def build_diagnostics(periods: pd.DataFrame, snapshots: pd.DataFrame, coverage: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    rows.append(
        {
            "diagnostic": "universe_coverage",
            "variant": "all",
            "value": int(len(coverage)),
            "detail": "Nasdaq-100 constituent rows loaded from local file.",
        }
    )
    for column in ["has_price", "has_min_history", "latest_within_7d_of_end", "has_feature_history"]:
        rows.append(
            {
                "diagnostic": f"coverage_{column}",
                "variant": "all",
                "value": int(coverage[column].astype(bool).sum()) if column in coverage.columns else 0,
                "detail": f"Count of constituents where {column} is true.",
            }
        )
    if not periods.empty:
        for variant, group in periods.groupby("variant"):
            rows.append(
                {
                    "diagnostic": "average_positive_accel_candidates",
                    "variant": variant,
                    "value": round(float(pd.to_numeric(group["positive_accel_candidates"], errors="coerce").mean()), 2),
                    "detail": "Average positive acceleration/ROC candidates carried in the daily ledger.",
                }
            )
    if not snapshots.empty:
        for (variant, timing, top), group in snapshots.groupby(["variant", "timing", "top"]):
            by_date = group.groupby("rebalance_date")
            rows.append(
                {
                    "diagnostic": "rebalance_snapshot_counts",
                    "variant": variant,
                    "timing": timing,
                    "top": int(top),
                    "value": round(float(by_date["ticker"].count().mean()), 2),
                    "detail": "Average clean candidates per rebalance snapshot.",
                }
            )
    return pd.DataFrame(rows)


def build_math_checks(periods: pd.DataFrame, yearly: pd.DataFrame, monthly: pd.DataFrame, summary: pd.DataFrame) -> pd.DataFrame:
    checks: list[dict[str, Any]] = []

    def add(check: str, expected: float | str, actual: float | str, detail: str, tolerance: float = 0.05) -> None:
        if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
            status = "pass" if abs(float(expected) - float(actual)) <= tolerance else "fail"
            difference: float | str = round(float(actual) - float(expected), 6)
        else:
            status = "pass" if expected == actual else "fail"
            difference = ""
        checks.append(
            {
                "check": check,
                "status": status,
                "expected": expected,
                "actual": actual,
                "difference": difference,
                "detail": detail,
            }
        )

    if periods.empty or yearly.empty or monthly.empty or summary.empty:
        return pd.DataFrame([{"check": "outputs_present", "status": "fail", "detail": "One or more output frames were empty."}])

    for _, row in yearly.iterrows():
        group = periods[
            periods["variant"].astype(str).eq(str(row["variant"]))
            & periods["timing"].astype(str).eq(str(row["timing"]))
            & periods["year"].astype(int).eq(int(row["year"]))
        ]
        expected = round(((1 + pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)).prod() - 1) * 100, 2)
        add(f"{row['variant']}_{row['year']}_annual_return_pct", expected, float(row["annual_return_pct"]), "Recomputed yearly return from daily ledger.")

    for _, row in monthly.iterrows():
        dates = pd.to_datetime(periods["date"])
        group = periods[
            periods["variant"].astype(str).eq(str(row["variant"]))
            & periods["timing"].astype(str).eq(str(row["timing"]))
            & dates.dt.to_period("M").astype(str).eq(str(row["month"]))
        ]
        expected = round(((1 + pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)).prod() - 1) * 100, 2)
        add(f"{row['variant']}_{row['month']}_monthly_return_pct", expected, float(row["strategy_return_pct"]), "Recomputed monthly return from daily ledger.")

    for _, row in summary.iterrows():
        group = periods[periods["variant"].astype(str).eq(str(row["variant"])) & periods["timing"].astype(str).eq(str(row["timing"]))]
        expected = round(((1 + pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)).prod() - 1) * 100, 2)
        add(f"{row['variant']}_total_return_pct", expected, float(row["total_return_pct"]), "Recomputed summary return from daily ledger.")

    no_margin = bool((pd.to_numeric(periods["gross_exposure"], errors="coerce").fillna(0.0) <= 1.0000001).all())
    add("gross_exposure_never_above_one", "pass", "pass" if no_margin else "fail", "No leverage or margin.")
    no_same_day = bool(
        periods[periods["variant"].ne("qqq_buy_hold")]
        .groupby(["variant", "timing"])["strategy_return"]
        .first()
        .fillna(0.0)
        .eq(0.0)
        .all()
    )
    add("first_signal_day_has_no_return", "pass", "pass" if no_same_day else "fail", "Initial rebalance close does not earn same-day strategy return.")
    return pd.DataFrame(checks)


def write_markdown_report(
    outputs: dict[str, Path],
    summary: pd.DataFrame,
    yearly: pd.DataFrame,
    monthly: pd.DataFrame,
    diagnostics: pd.DataFrame,
    checks: pd.DataFrame,
    cfg: ScannerConfig,
) -> None:
    failures = checks[checks["status"] != "pass"] if not checks.empty else checks
    display_summary = summary[
        [
            "variant",
            "total_return_pct",
            "annualized_return_pct",
            "max_drawdown_pct",
            "exposure_pct",
            "win_months",
            "loss_months",
            "worst_month_pct",
        ]
    ].copy()
    worst_months = monthly[monthly["variant"].ne("qqq_buy_hold")].sort_values("strategy_return_pct").head(12)
    recent_primary = monthly[monthly["variant"].isin(["nasdaq100_accel_top5_weekly", "nasdaq100_accel_top10_weekly", "qqq_buy_hold"])]
    recent_primary = recent_primary.sort_values(["month", "variant"]).tail(36)

    lines = [
        "# Nasdaq-100 Second-Derivative Momentum Scanner",
        "",
        f"Generated: {date.today().isoformat()}",
        "",
        "## Method",
        "",
        "- Cache-only run using local FMP price caches; no yfinance, margin, shorting, leveraged ETFs, fees, slippage, or taxes.",
        "- Universe is the current local Nasdaq-100/QQQ constituent file, with survivorship-bias caveat.",
        f"- Price features use completed closes only: {FEATURE_DEFINITION}.",
        f"- Ranking score: {SCORE_DEFINITION}, computed cross-sectionally across clean current Nasdaq-100 candidates at each rebalance.",
        "- Trade filter requires positive acceleration_20 and positive ROC_20; selected names are equal weighted after the rebalance close and first earn returns on the next close-to-close interval.",
        f"- Tested top counts: {', '.join(str(item) for item in cfg.top_values)}. Rebalance frequencies: {', '.join(cfg.frequencies)}.",
        "",
        "## Outputs",
        "",
    ]
    for name, path in outputs.items():
        if name != "report":
            lines.append(f"- {name}: `{path.relative_to(PROJECT_ROOT)}`")

    lines.extend(["", "## Summary", ""])
    lines.append(display_summary.to_markdown(index=False) if not display_summary.empty else "No summary rows.")
    lines.extend(["", "## Worst Scanner Months", ""])
    if not worst_months.empty:
        lines.append(
            worst_months[
                ["variant", "month", "strategy_return_pct", "benchmark_return_pct", "excess_return_pct", "exposure_pct", "avg_positions"]
            ].to_markdown(index=False)
        )
    else:
        lines.append("No scanner monthly rows.")
    lines.extend(["", "## Recent Weekly Monthly Returns", ""])
    lines.append(
        recent_primary[["variant", "month", "strategy_return_pct", "benchmark_return_pct", "excess_return_pct"]].to_markdown(index=False)
        if not recent_primary.empty
        else "No recent monthly rows."
    )
    lines.extend(["", "## 2022 Drawdown Year", ""])
    focus_2022 = yearly[yearly["year"].eq(2022)].copy()
    lines.append(
        focus_2022[["variant", "annual_return_pct", "benchmark_return_pct", "excess_return_pct", "max_drawdown_pct", "exposure_pct"]].to_markdown(index=False)
        if not focus_2022.empty
        else "No 2022 yearly rows."
    )
    lines.extend(["", "## Diagnostics", ""])
    lines.append(diagnostics.head(80).to_markdown(index=False) if not diagnostics.empty else "No diagnostics.")
    lines.extend(["", "## Math Check", ""])
    lines.append("Internal math checks passed." if failures.empty else failures.to_markdown(index=False))
    lines.extend(
        [
            "",
            "## Caveats",
            "",
            "- Current constituent file creates survivorship bias and can overstate historical results for newer winners.",
            "- This is a pure price acceleration scanner; it intentionally drops the previous quality/fundamental filter.",
            "- Signals are close-based and assume next close-to-close execution with no transaction costs.",
            "",
        ]
    )
    outputs["report"].write_text("\n".join(lines), encoding="utf-8")


def run_backtest(cfg: ScannerConfig) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    tickers = load_tickers(UNIVERSES[UNIVERSE].constituents_file)
    all_symbols = sorted(set(tickers + [BENCHMARK]))
    raw_prices = {ticker: load_price_series(ticker) for ticker in all_symbols}
    benchmark = raw_prices[BENCHMARK].dropna()
    if benchmark.empty:
        raise RuntimeError("No local QQQ benchmark prices found.")

    coverage_prices = {ticker: raw_prices.get(ticker, pd.Series(dtype="float64")).dropna() for ticker in tickers}
    feature_frames = {ticker: completed_feature_frame(series) for ticker, series in coverage_prices.items() if len(series) >= cfg.min_history_rows}
    coverage = build_coverage(tickers, coverage_prices, feature_frames, cfg, benchmark)
    eligible_tickers = coverage[
        coverage["has_price"].astype(bool)
        & coverage["has_min_history"].astype(bool)
        & coverage["latest_within_7d_of_end"].astype(bool)
        & coverage["has_feature_history"].astype(bool)
    ]["ticker"].astype(str).tolist()

    schedules = build_schedules(benchmark, cfg)
    global_start = min(schedule[0] for schedule in schedules.values() if schedule)
    global_end = max(schedule[-1] for schedule in schedules.values() if schedule)
    trading_dates = pd.DatetimeIndex(benchmark.loc[(benchmark.index >= global_start) & (benchmark.index <= global_end)].index).sort_values().unique()
    returns = aligned_returns({ticker: raw_prices[ticker] for ticker in eligible_tickers}, trading_dates)
    benchmark_returns = benchmark.reindex(trading_dates).ffill().pct_change(fill_method=None).fillna(0.0)

    period_rows: list[dict[str, Any]] = []
    trade_rows: list[dict[str, Any]] = []
    snapshot_rows: list[dict[str, Any]] = []
    for frequency, schedule in schedules.items():
        if len(schedule) < 2:
            continue
        for top in cfg.top_values:
            periods, trades, snapshots = simulate_variant(
                frequency=frequency,
                top=top,
                schedule=schedule,
                tickers=eligible_tickers,
                feature_frames=feature_frames,
                returns=returns,
                benchmark_returns=benchmark_returns,
                cfg=cfg,
            )
            period_rows.extend(periods)
            trade_rows.extend(trades)
            snapshot_rows.extend(snapshots)

    periods = pd.DataFrame(period_rows)
    benchmark_periods = build_benchmark_periods(trading_dates, benchmark_returns, cfg)
    periods = pd.concat([periods, benchmark_periods], ignore_index=True)
    periods = add_equity_drawdown(periods)
    trades = pd.DataFrame(trade_rows)
    snapshots = pd.DataFrame(snapshot_rows)
    yearly = build_yearly(periods)
    monthly = build_monthly(periods)
    summary = build_summary(periods, yearly, monthly, cfg)
    diagnostics = build_diagnostics(periods, snapshots, coverage)
    checks = build_math_checks(periods, yearly, monthly, summary)
    return summary, yearly, monthly, periods, trades, snapshots, coverage, diagnostics, checks


def write_outputs(
    summary: pd.DataFrame,
    yearly: pd.DataFrame,
    monthly: pd.DataFrame,
    periods: pd.DataFrame,
    trades: pd.DataFrame,
    snapshots: pd.DataFrame,
    coverage: pd.DataFrame,
    diagnostics: pd.DataFrame,
    checks: pd.DataFrame,
    cfg: ScannerConfig,
) -> dict[str, Path]:
    REPORTS_DIR.mkdir(exist_ok=True)
    base = f"{cfg.output_prefix}_{date.today().isoformat()}"
    outputs = {
        "summary": REPORTS_DIR / f"{base}_summary.csv",
        "yearly": REPORTS_DIR / f"{base}_yearly.csv",
        "monthly": REPORTS_DIR / f"{base}_monthly.csv",
        "periods": REPORTS_DIR / f"{base}_periods.csv",
        "trades": REPORTS_DIR / f"{base}_trades.csv",
        "scanner_snapshots": REPORTS_DIR / f"{base}_scanner_snapshots.csv",
        "coverage": REPORTS_DIR / f"{base}_coverage.csv",
        "diagnostics": REPORTS_DIR / f"{base}_diagnostics.csv",
        "math_checks": REPORTS_DIR / f"{base}_math_checks.csv",
        "report": REPORTS_DIR / f"{base}_report.md",
    }
    summary.to_csv(outputs["summary"], index=False)
    yearly.to_csv(outputs["yearly"], index=False)
    monthly.to_csv(outputs["monthly"], index=False)
    periods.to_csv(outputs["periods"], index=False)
    trades.to_csv(outputs["trades"], index=False)
    snapshots.to_csv(outputs["scanner_snapshots"], index=False)
    coverage.to_csv(outputs["coverage"], index=False)
    diagnostics.to_csv(outputs["diagnostics"], index=False)
    checks.to_csv(outputs["math_checks"], index=False)
    write_markdown_report(outputs, summary, yearly, monthly, diagnostics, checks, cfg)
    return outputs


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Cache-only Nasdaq-100 second-derivative acceleration momentum scanner.")
    parser.add_argument("--start-year", type=int, default=2010)
    parser.add_argument("--end-date", help="Optional inclusive end date, e.g. 2026-06-10.")
    parser.add_argument("--top-values", type=parse_csv_ints, default=(5, 10), help="Comma-separated top counts, default 5,10.")
    parser.add_argument(
        "--frequencies",
        type=parse_csv_strings,
        default=("weekly", "monthly", "semiannual"),
        help="Comma-separated rebalance frequencies: weekly,monthly,semiannual.",
    )
    parser.add_argument("--min-price", type=float, default=1.0)
    parser.add_argument("--min-history-rows", type=int, default=120)
    parser.add_argument("--output-prefix", default="nasdaq100_second_derivative_scanner")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    cfg = ScannerConfig(
        start_year=args.start_year,
        end_date=args.end_date,
        top_values=args.top_values,
        frequencies=args.frequencies,
        min_price=args.min_price,
        min_history_rows=args.min_history_rows,
        output_prefix=args.output_prefix,
    )
    summary, yearly, monthly, periods, trades, snapshots, coverage, diagnostics, checks = run_backtest(cfg)
    outputs = write_outputs(summary, yearly, monthly, periods, trades, snapshots, coverage, diagnostics, checks, cfg)
    for name, path in outputs.items():
        print(f"{name}: {path}")
    print()
    print(summary.to_string(index=False) if not summary.empty else "No summary generated.")
    failures = checks[checks["status"] != "pass"] if not checks.empty else checks
    print(f"\nInternal math checks: {len(checks)} run, {len(failures)} failures")
    if not monthly.empty:
        print("\nRecent monthly returns (weekly top5/top10 and QQQ):")
        recent = monthly[monthly["variant"].isin(["nasdaq100_accel_top5_weekly", "nasdaq100_accel_top10_weekly", "qqq_buy_hold"])]
        print(recent.sort_values(["month", "variant"]).tail(36).to_string(index=False))


if __name__ == "__main__":
    main()
