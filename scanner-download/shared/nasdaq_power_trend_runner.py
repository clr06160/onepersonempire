from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from price_cache import read_ticker_prices


PROJECT_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = PROJECT_ROOT / "reports"
DEFAULT_INITIAL_CAPITAL = 10_000.0
DEFAULT_SEARCH_UNIVERSES = ("qqq", "soxlgood", "sp500", "iwm")
LEVERAGED_ASSETS = {"TQQQ", "SOXL"}
RESEARCH_LABEL = (
    "Research-only Nasdaq/QQQ Power Trend approximation as a leveraged ETF permission gate; "
    "leveraged ETF results are high-risk and path-dependent."
)
RULE_NAME = "approx_qqq_power_trend_ema21_sma50_low_support"
RULE_DESCRIPTION = (
    "Approximation only: no exact Mike Webster/IBD Power Trend definition was found in local code or docs. "
    "Completed-day Power Trend is ON when QQQ close is above its 21-day EMA and 50-day SMA, "
    "the 21-day EMA is above its value 5 trading days earlier, the 50-day SMA is above its value "
    "10 trading days earlier, the 10-day SMA is above the 21-day EMA, and QQQ lows are at or above "
    "the 21-day EMA on at least 8 of the last 10 sessions."
)


@dataclass(frozen=True)
class RunConfig:
    start: str | None
    end: str | None
    initial_capital: float
    adjusted_prices: bool
    output_prefix: str
    include_same_day_diagnostic: bool


class DataUnavailable(RuntimeError):
    pass


def parse_bool(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "y"}:
        return True
    if normalized in {"0", "false", "no", "n"}:
        return False
    raise argparse.ArgumentTypeError(f"Expected true/false, got {value!r}")


def parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    return pd.Timestamp(value).date()


def price_column(adjusted_prices: bool) -> str:
    return "adjClose" if adjusted_prices else "close"


def adjusted_ohlc_frame(frame: pd.DataFrame, adjusted_prices: bool) -> pd.DataFrame:
    out = frame.copy()
    if adjusted_prices and {"adjClose", "close"}.issubset(out.columns):
        ratio = (out["adjClose"] / out["close"]).replace([np.inf, -np.inf], np.nan)
        for col in ("open", "high", "low", "close"):
            if col in out.columns:
                out[col] = out[col] * ratio
    return out


def load_cached_frame(ticker: str, adjusted_prices: bool) -> tuple[pd.DataFrame, str]:
    searched: list[str] = []
    for universe in DEFAULT_SEARCH_UNIVERSES:
        searched.append(f"data/cache/{universe}/prices/{ticker}.csv")
        raw = read_ticker_prices(universe, ticker)
        if raw.empty:
            continue
        frame = adjusted_ohlc_frame(raw, adjusted_prices)
        close_col = "close" if adjusted_prices else price_column(adjusted_prices)
        if close_col not in frame.columns:
            continue
        frame = frame.copy()
        frame.index = pd.to_datetime(frame.index).tz_localize(None).normalize()
        frame = frame[~frame.index.duplicated(keep="last")].sort_index()
        return frame, f"price_cache/{universe}/{ticker}.csv"
    raise DataUnavailable(f"No usable local cache rows found for {ticker}. Searched: {', '.join(searched)}")


def close_series(frame: pd.DataFrame) -> pd.Series:
    if "close" not in frame.columns:
        raise DataUnavailable("Frame is missing adjusted close/close column.")
    return pd.to_numeric(frame["close"], errors="coerce")


def max_drawdown_pct(equity: pd.Series) -> float:
    values = pd.to_numeric(equity, errors="coerce").dropna()
    if values.empty:
        return 0.0
    values_with_start = pd.concat([pd.Series([1.0]), values.reset_index(drop=True)], ignore_index=True)
    peak = values_with_start.cummax()
    return float((values_with_start / peak - 1).min() * 100)


def cagr(total_return: float, start_date: Any, end_date: Any) -> float:
    start_ts = pd.Timestamp(start_date)
    end_ts = pd.Timestamp(end_date)
    years = max((end_ts - start_ts).days / 365.25, 1 / 365.25)
    return float((1 + total_return) ** (1 / years) - 1)


def build_market_frame(config: RunConfig) -> tuple[pd.DataFrame, dict[str, str]]:
    qqq_frame, qqq_source = load_cached_frame("QQQ", config.adjusted_prices)
    tqqq_frame, tqqq_source = load_cached_frame("TQQQ", config.adjusted_prices)
    soxl_frame, soxl_source = load_cached_frame("SOXL", config.adjusted_prices)

    required_qqq_columns = {"close", "low"}
    missing = sorted(required_qqq_columns - set(qqq_frame.columns))
    if missing:
        raise DataUnavailable(f"QQQ cache is missing required columns for the Power Trend rule: {missing}")

    frame = pd.DataFrame(
        {
            "qqq_close": close_series(qqq_frame),
            "qqq_low": pd.to_numeric(qqq_frame["low"], errors="coerce"),
            "tqqq_close": close_series(tqqq_frame),
            "soxl_close": close_series(soxl_frame),
        }
    ).sort_index()

    if config.end:
        frame = frame.loc[frame.index <= pd.Timestamp(config.end)].copy()
    else:
        frame = frame.loc[frame.index <= pd.Timestamp(date.today())].copy()
    if config.start:
        warmup_start = pd.Timestamp(config.start) - pd.Timedelta(days=365)
        frame = frame.loc[frame.index >= warmup_start].copy()

    if frame["qqq_close"].dropna().empty:
        raise DataUnavailable("No QQQ rows remain after date filtering.")

    sources = {"QQQ": qqq_source, "TQQQ": tqqq_source, "SOXL": soxl_source}
    return frame, sources


def add_power_trend_features(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    qqq = out["qqq_close"]
    low = out["qqq_low"]

    out["qqq_ema21"] = qqq.ewm(span=21, adjust=False, min_periods=21).mean()
    out["qqq_sma10"] = qqq.rolling(10).mean()
    out["qqq_sma50"] = qqq.rolling(50).mean()
    out["qqq_sma200"] = qqq.rolling(200).mean()
    out["qqq_above_sma200"] = qqq > out["qqq_sma200"]
    out["low_above_ema21"] = low >= out["qqq_ema21"]
    out["low_above_ema21_10d"] = out["low_above_ema21"].rolling(10).sum()

    conditions = [
        qqq > out["qqq_ema21"],
        qqq > out["qqq_sma50"],
        out["qqq_ema21"] > out["qqq_ema21"].shift(5),
        out["qqq_sma50"] > out["qqq_sma50"].shift(10),
        out["qqq_sma10"] > out["qqq_ema21"],
        out["low_above_ema21_10d"] >= 8,
    ]
    out["power_trend_on_completed"] = np.logical_and.reduce(conditions)
    warmup_missing = out[["qqq_ema21", "qqq_sma10", "qqq_sma50", "qqq_sma200", "low_above_ema21_10d"]].isna().any(axis=1)
    out.loc[warmup_missing, "power_trend_on_completed"] = False
    out["power_trend_state_completed"] = np.where(out["power_trend_on_completed"], "POWER_TREND_ON", "POWER_TREND_OFF")
    return out


def variant_asset(
    variant: str,
    power_on: pd.Series,
    qqq_above_sma200: pd.Series,
) -> pd.Series:
    index = power_on.index
    if variant == "qqq_buy_hold":
        return pd.Series("QQQ", index=index)
    if variant == "tqqq_buy_hold":
        return pd.Series("TQQQ", index=index)
    if variant == "soxl_buy_hold":
        return pd.Series("SOXL", index=index)
    if variant == "qqq_ma200_filter":
        return pd.Series(np.where(qqq_above_sma200, "QQQ", "CASH"), index=index)
    if variant == "tqqq_power_trend_on_qqq_off":
        return pd.Series(np.where(power_on, "TQQQ", "QQQ"), index=index)
    if variant == "tqqq_power_trend_on_qqq_ma200_off_cash":
        return pd.Series(np.select([power_on, qqq_above_sma200], ["TQQQ", "QQQ"], default="CASH"), index=index)
    if variant == "tqqq_power_trend_on_cash_off_diagnostic":
        return pd.Series(np.where(power_on, "TQQQ", "CASH"), index=index)
    if variant == "soxl_power_trend_on_qqq_off":
        return pd.Series(np.where(power_on, "SOXL", "QQQ"), index=index)
    if variant == "soxl_power_trend_on_qqq_ma200_off_cash":
        return pd.Series(np.select([power_on, qqq_above_sma200], ["SOXL", "QQQ"], default="CASH"), index=index)
    if variant == "soxl_power_trend_on_cash_off_diagnostic":
        return pd.Series(np.where(power_on, "SOXL", "CASH"), index=index)
    raise ValueError(f"Unsupported variant: {variant}")


def variant_rule_note(variant: str) -> str:
    notes = {
        "qqq_buy_hold": "Baseline: hold QQQ continuously.",
        "tqqq_buy_hold": "Diagnostic benchmark: hold TQQQ continuously; high-risk/path-dependent leveraged ETF exposure.",
        "soxl_buy_hold": "Diagnostic benchmark: hold SOXL continuously; high-risk/path-dependent leveraged ETF exposure.",
        "qqq_ma200_filter": "Simple risk filter: hold QQQ when prior completed QQQ close is above its 200-day SMA, otherwise cash.",
        "tqqq_power_trend_on_qqq_off": "Leverage gate: TQQQ when prior completed Power Trend is ON, otherwise QQQ.",
        "tqqq_power_trend_on_qqq_ma200_off_cash": "Leverage gate plus risk-off: TQQQ when Power Trend is ON; if OFF, QQQ above prior 200-day SMA, else cash.",
        "tqqq_power_trend_on_cash_off_diagnostic": "Diagnostic cash-off version: TQQQ when Power Trend is ON, otherwise cash.",
        "soxl_power_trend_on_qqq_off": "Leverage gate: SOXL when prior completed Power Trend is ON, otherwise QQQ.",
        "soxl_power_trend_on_qqq_ma200_off_cash": "Leverage gate plus risk-off: SOXL when Power Trend is ON; if OFF, QQQ above prior 200-day SMA, else cash.",
        "soxl_power_trend_on_cash_off_diagnostic": "Diagnostic cash-off version: SOXL when Power Trend is ON, otherwise cash.",
    }
    return notes[variant]


def build_variant_periods(base: pd.DataFrame, variant: str, timing: str, config: RunConfig) -> pd.DataFrame:
    out = base.copy()
    completed_asset = variant_asset(variant, out["power_trend_on_completed"], out["qqq_above_sma200"])

    if timing == "shifted_no_lookahead":
        out["held_asset"] = completed_asset.shift(1)
        out["signal_power_trend_state"] = out["power_trend_state_completed"].shift(1)
        out["signal_qqq_above_sma200"] = out["qqq_above_sma200"].shift(1)
        out["execution_note"] = "Prior completed close/indicator state determines today's close-to-close exposure."
    elif timing == "same_day_diagnostic_non_tradable":
        out["held_asset"] = completed_asset
        out["signal_power_trend_state"] = out["power_trend_state_completed"]
        out["signal_qqq_above_sma200"] = out["qqq_above_sma200"]
        out["execution_note"] = "Diagnostic only: same-day completed signal is applied to same-day return."
    else:
        raise ValueError(f"Unsupported timing: {timing}")

    out["held_asset"] = out["held_asset"].fillna("CASH")
    out["signal_power_trend_state"] = out["signal_power_trend_state"].fillna("WARMUP")
    out["signal_qqq_above_sma200"] = out["signal_qqq_above_sma200"].astype("boolean").fillna(False).astype(bool)

    for ticker in ("qqq", "tqqq", "soxl"):
        out[f"{ticker}_return"] = out[f"{ticker}_close"].pct_change(fill_method=None)
    out[["qqq_return", "tqqq_return", "soxl_return"]] = out[["qqq_return", "tqqq_return", "soxl_return"]].fillna(0.0)

    return_map = {
        "QQQ": out["qqq_return"],
        "TQQQ": out["tqqq_return"],
        "SOXL": out["soxl_return"],
        "CASH": pd.Series(0.0, index=out.index),
    }
    out["strategy_return"] = 0.0
    for asset, returns in return_map.items():
        out.loc[out["held_asset"].eq(asset), "strategy_return"] = returns

    if config.start:
        out = out.loc[out.index >= pd.Timestamp(config.start)].copy()
    first_valid = out.index[out["qqq_sma200"].notna()]
    if len(first_valid) == 0:
        raise DataUnavailable("Need at least 200 QQQ rows to compute the 200-day comparison filter.")
    out = out.loc[out.index >= first_valid[0]].copy()

    required_asset = {
        "QQQ": "qqq_close",
        "TQQQ": "tqqq_close",
        "SOXL": "soxl_close",
    }
    used_assets = {asset for asset in out["held_asset"].unique() if asset != "CASH"}
    for asset in used_assets:
        out = out.loc[out[required_asset[asset]].notna()].copy()

    if out.empty:
        return pd.DataFrame()

    first_idx = out.index[0]
    out.loc[first_idx, "strategy_return"] = 0.0
    out.loc[first_idx, ["qqq_return", "tqqq_return", "soxl_return"]] = 0.0
    if timing == "shifted_no_lookahead":
        out.loc[first_idx, "held_asset"] = "CASH"
        out.loc[first_idx, "strategy_return"] = 0.0

    out["variant"] = variant
    out["timing"] = timing
    out["rule_name"] = RULE_NAME
    out["invested"] = ~out["held_asset"].eq("CASH")
    out["leveraged_invested"] = out["held_asset"].isin(LEVERAGED_ASSETS)
    out["qqq_exposure"] = out["held_asset"].eq("QQQ")
    out["cash_weight"] = np.where(out["held_asset"].eq("CASH"), 1.0, 0.0)
    out["gross_exposure"] = np.where(out["held_asset"].eq("CASH"), 0.0, 1.0)
    out["equity"] = config.initial_capital * (1 + out["strategy_return"]).cumprod()
    out["benchmark_qqq_return"] = out["qqq_return"]
    out["benchmark_tqqq_return"] = out["tqqq_return"]
    out["benchmark_soxl_return"] = out["soxl_return"]
    out["drawdown_pct"] = (out["equity"] / out["equity"].cummax().clip(lower=config.initial_capital) - 1) * 100
    out["year"] = out.index.year
    out["date"] = out.index.date

    columns = [
        "date",
        "year",
        "variant",
        "timing",
        "rule_name",
        "held_asset",
        "invested",
        "leveraged_invested",
        "qqq_exposure",
        "gross_exposure",
        "cash_weight",
        "signal_power_trend_state",
        "signal_qqq_above_sma200",
        "execution_note",
        "qqq_close",
        "tqqq_close",
        "soxl_close",
        "qqq_ema21",
        "qqq_sma10",
        "qqq_sma50",
        "qqq_sma200",
        "low_above_ema21_10d",
        "power_trend_on_completed",
        "qqq_above_sma200",
        "qqq_return",
        "tqqq_return",
        "soxl_return",
        "strategy_return",
        "benchmark_qqq_return",
        "benchmark_tqqq_return",
        "benchmark_soxl_return",
        "equity",
        "drawdown_pct",
    ]
    return out[columns].reset_index(drop=True)


def build_periods(base: pd.DataFrame, config: RunConfig) -> pd.DataFrame:
    variants = [
        "qqq_buy_hold",
        "tqqq_buy_hold",
        "soxl_buy_hold",
        "qqq_ma200_filter",
        "tqqq_power_trend_on_qqq_off",
        "tqqq_power_trend_on_qqq_ma200_off_cash",
        "tqqq_power_trend_on_cash_off_diagnostic",
        "soxl_power_trend_on_qqq_off",
        "soxl_power_trend_on_qqq_ma200_off_cash",
        "soxl_power_trend_on_cash_off_diagnostic",
    ]
    timings = ["shifted_no_lookahead"]
    if config.include_same_day_diagnostic:
        timings.append("same_day_diagnostic_non_tradable")

    frames = [build_variant_periods(base, variant, timing, config) for variant in variants for timing in timings]
    frames = [frame for frame in frames if not frame.empty]
    if not frames:
        raise DataUnavailable("No variant rows were produced.")
    return pd.concat(frames, ignore_index=True)


def build_yearly(periods: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    for (variant, timing, year), group in periods.groupby(["variant", "timing", "year"], sort=True):
        strategy_return = (1 + group["strategy_return"]).prod() - 1
        equity = (1 + group["strategy_return"]).cumprod()
        qqq_return = (1 + group["benchmark_qqq_return"]).prod() - 1
        tqqq_return = (1 + group["benchmark_tqqq_return"]).prod() - 1
        soxl_return = (1 + group["benchmark_soxl_return"]).prod() - 1
        rows.append(
            {
                "variant": variant,
                "timing": timing,
                "year": int(year),
                "periods": int(len(group)),
                "annual_return_pct": round(strategy_return * 100, 2),
                "benchmark_qqq_return_pct": round(qqq_return * 100, 2),
                "benchmark_tqqq_return_pct": round(tqqq_return * 100, 2),
                "benchmark_soxl_return_pct": round(soxl_return * 100, 2),
                "max_drawdown_pct": round(max_drawdown_pct(equity), 2),
                "exposure_pct": round(float(group["invested"].mean() * 100), 2),
                "leveraged_exposure_pct": round(float(group["leveraged_invested"].mean() * 100), 2),
                "qqq_exposure_pct": round(float(group["qqq_exposure"].mean() * 100), 2),
                "power_trend_on_executed_pct": round(float(group["signal_power_trend_state"].eq("POWER_TREND_ON").mean() * 100), 2),
                "cash_allowed": True,
                "margin_allowed": False,
                "short_allowed": False,
                "leveraged_etfs_allowed_when_power_trend_on": bool(group["leveraged_invested"].any()),
            }
        )
    return pd.DataFrame(rows)


def build_summary(periods: pd.DataFrame, yearly: pd.DataFrame, config: RunConfig, math_status: str) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    for (variant, timing), group in periods.groupby(["variant", "timing"], sort=True):
        total_return = (1 + group["strategy_return"]).prod() - 1
        qqq_total = (1 + group["benchmark_qqq_return"]).prod() - 1
        tqqq_total = (1 + group["benchmark_tqqq_return"]).prod() - 1
        soxl_total = (1 + group["benchmark_soxl_return"]).prod() - 1
        yearly_group = yearly[yearly["variant"].eq(variant) & yearly["timing"].eq(timing)]
        rows.append(
            {
                "variant": variant,
                "timing": timing,
                "research_only": True,
                "rule_name": RULE_NAME,
                "rule_note": variant_rule_note(variant),
                "start_date": str(group["date"].iloc[0]),
                "end_date": str(group["date"].iloc[-1]),
                "rows": int(len(group)),
                "initial_capital": config.initial_capital,
                "price_column": "adjusted_ohlc_from_adjClose" if config.adjusted_prices else "close",
                "adjusted_prices": bool(config.adjusted_prices),
                "final_equity": round(float(group["equity"].iloc[-1]), 2),
                "total_return_pct": round(total_return * 100, 2),
                "cagr_pct": round(cagr(total_return, group["date"].iloc[0], group["date"].iloc[-1]) * 100, 2),
                "max_drawdown_pct": round(float(group["drawdown_pct"].min()), 2),
                "exposure_pct": round(float(group["invested"].mean() * 100), 2),
                "leveraged_exposure_pct": round(float(group["leveraged_invested"].mean() * 100), 2),
                "qqq_exposure_pct": round(float(group["qqq_exposure"].mean() * 100), 2),
                "cash_pct": round(float(group["held_asset"].eq("CASH").mean() * 100), 2),
                "power_trend_on_executed_pct": round(float(group["signal_power_trend_state"].eq("POWER_TREND_ON").mean() * 100), 2),
                "win_years": int((yearly_group["annual_return_pct"] > 0).sum()),
                "loss_years": int((yearly_group["annual_return_pct"] <= 0).sum()),
                "benchmark_qqq_total_return_pct": round(qqq_total * 100, 2),
                "benchmark_qqq_cagr_pct": round(cagr(qqq_total, group["date"].iloc[0], group["date"].iloc[-1]) * 100, 2),
                "benchmark_tqqq_total_return_pct": round(tqqq_total * 100, 2),
                "benchmark_tqqq_cagr_pct": round(cagr(tqqq_total, group["date"].iloc[0], group["date"].iloc[-1]) * 100, 2),
                "benchmark_soxl_total_return_pct": round(soxl_total * 100, 2),
                "benchmark_soxl_cagr_pct": round(cagr(soxl_total, group["date"].iloc[0], group["date"].iloc[-1]) * 100, 2),
                "cash_allowed": True,
                "margin_allowed": False,
                "short_allowed": False,
                "leveraged_etf_high_risk_path_dependent": bool(group["held_asset"].isin(LEVERAGED_ASSETS).any()),
                "math_check_status": math_status,
            }
        )
    return pd.DataFrame(rows)


def build_math_checks(periods: pd.DataFrame, yearly: pd.DataFrame, summary: pd.DataFrame) -> pd.DataFrame:
    checks: list[dict[str, object]] = []

    def add_check(source: str, check: str, expected: float | str, actual: float | str, detail: str, tolerance: float = 0.05) -> None:
        if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
            difference: float | str = round(float(actual) - float(expected), 6)
            status = "pass" if abs(float(expected) - float(actual)) <= tolerance else "fail"
        else:
            difference = ""
            status = "pass" if expected == actual else "fail"
        checks.append(
            {
                "source": source,
                "check": check,
                "status": status,
                "expected": expected,
                "actual": actual,
                "difference": difference,
                "detail": detail,
            }
        )

    for _, row in yearly.iterrows():
        group = periods[
            periods["variant"].eq(row["variant"])
            & periods["timing"].eq(row["timing"])
            & periods["year"].eq(row["year"])
        ]
        label = f"{row['variant']}_{row['timing']}_{int(row['year'])}"
        add_check(
            "yearly",
            f"{label}_annual_return_pct",
            round(((1 + group["strategy_return"]).prod() - 1) * 100, 2),
            float(row["annual_return_pct"]),
            "Recomputed yearly return from daily strategy returns.",
        )
        add_check(
            "yearly",
            f"{label}_exposure_pct",
            round(float(group["invested"].mean() * 100), 2),
            float(row["exposure_pct"]),
            "Recomputed yearly exposure from daily invested flag.",
        )

    for _, row in summary.iterrows():
        group = periods[periods["variant"].eq(row["variant"]) & periods["timing"].eq(row["timing"])]
        label = f"{row['variant']}_{row['timing']}"
        add_check(
            "summary",
            f"{label}_total_return_pct",
            round(((1 + group["strategy_return"]).prod() - 1) * 100, 2),
            float(row["total_return_pct"]),
            "Recomputed total return from daily strategy returns.",
        )
        add_check(
            "summary",
            f"{label}_max_drawdown_pct",
            round(float(group["drawdown_pct"].min()), 2),
            float(row["max_drawdown_pct"]),
            "Recomputed summary max drawdown from daily drawdown column.",
        )
        add_check(
            "summary",
            f"{label}_leveraged_exposure_pct",
            round(float(group["leveraged_invested"].mean() * 100), 2),
            float(row["leveraged_exposure_pct"]),
            "Recomputed leveraged exposure from held asset.",
        )

    return pd.DataFrame(checks)


def math_status(checks: pd.DataFrame) -> str:
    if checks.empty:
        return "internal_no_checks"
    failures = int((checks["status"] != "pass").sum())
    return "internal_pass" if failures == 0 else f"internal_fail_{failures}"


def best_off_state_summary(summary: pd.DataFrame) -> pd.DataFrame:
    primary = summary[summary["timing"].eq("shifted_no_lookahead")].copy()
    candidates = primary[
        primary["variant"].isin(
            [
                "tqqq_power_trend_on_qqq_off",
                "tqqq_power_trend_on_qqq_ma200_off_cash",
                "tqqq_power_trend_on_cash_off_diagnostic",
                "soxl_power_trend_on_qqq_off",
                "soxl_power_trend_on_qqq_ma200_off_cash",
                "soxl_power_trend_on_cash_off_diagnostic",
            ]
        )
    ].copy()
    if candidates.empty:
        return candidates
    return candidates.sort_values(["cagr_pct", "max_drawdown_pct"], ascending=[False, False])


def write_markdown_report(
    report_path: Path,
    periods_path: Path,
    yearly_path: Path,
    summary_path: Path,
    math_path: Path,
    periods: pd.DataFrame,
    yearly: pd.DataFrame,
    summary: pd.DataFrame,
    checks: pd.DataFrame,
    config: RunConfig,
    sources: dict[str, str],
) -> None:
    primary = summary[summary["timing"].eq("shifted_no_lookahead")].copy()
    best_off = best_off_state_summary(summary)
    best_row = best_off.iloc[0] if not best_off.empty else None
    pt_on = float(periods[periods["timing"].eq("shifted_no_lookahead")]["signal_power_trend_state"].eq("POWER_TREND_ON").mean() * 100)

    lines = [
        "# Nasdaq Power Trend Leverage Gate Backtest",
        "",
        f"Generated: {date.today().isoformat()}",
        "",
        RESEARCH_LABEL,
        "",
        "## Rule Used",
        "",
        f"- Name: `{RULE_NAME}`",
        f"- {RULE_DESCRIPTION}",
        "- Timing: `shifted_no_lookahead` applies the completed signal after the close to the next close-to-close return.",
        "- Power Trend OFF is primarily tested as no leveraged ETF permission, not automatically as all cash.",
        "- Cash return is modeled as 0%. No margin, no shorting, no SOXS/SQQQ, no fees, no slippage, no taxes.",
        "",
        "## Data",
        "",
    ]
    for ticker, source in sorted(sources.items()):
        lines.append(f"- {ticker}: `{source}`")
    lines.extend(
        [
            f"- Price handling: `{('adjusted OHLC from adjClose' if config.adjusted_prices else 'raw close')}`.",
            "",
            "## Outputs",
            "",
            f"- Periods: `{periods_path.relative_to(PROJECT_ROOT)}`",
            f"- Yearly: `{yearly_path.relative_to(PROJECT_ROOT)}`",
            f"- Summary: `{summary_path.relative_to(PROJECT_ROOT)}`",
            f"- Math checks: `{math_path.relative_to(PROJECT_ROOT)}`",
            f"- Report: `{report_path.relative_to(PROJECT_ROOT)}`",
            "",
            "## Primary Shifted Results",
            "",
            "| variant | total_return_pct | cagr_pct | max_drawdown_pct | exposure_pct | leveraged_exposure_pct | win_years |",
            "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
        ]
    )
    for _, row in primary.sort_values("cagr_pct", ascending=False).iterrows():
        lines.append(
            f"| {row['variant']} | {row['total_return_pct']:.2f} | {row['cagr_pct']:.2f} | "
            f"{row['max_drawdown_pct']:.2f} | {row['exposure_pct']:.2f} | "
            f"{row['leveraged_exposure_pct']:.2f} | {int(row['win_years'])} |"
        )

    lines.extend(["", "## Off-State Read", ""])
    if best_row is not None:
        lines.append(
            f"- Best shifted leverage-gate/off-state variant by CAGR: `{best_row['variant']}` "
            f"with {best_row['cagr_pct']:.2f}% CAGR, {best_row['max_drawdown_pct']:.2f}% max drawdown, "
            f"{best_row['leveraged_exposure_pct']:.2f}% leveraged exposure."
        )
    lines.extend(
        [
            f"- Executed Power Trend ON share across shifted rows: {pt_on:.2f}% (duplicated across variants, shown as a signal coverage check).",
            "- `*_cash_off_diagnostic` variants are included to compare against the older all-cash-off framing, but they are not the primary intended strategy.",
            "",
            "## Math Check",
            "",
            f"- Internal math status: `{math_status(checks)}`",
            f"- Checks run: {len(checks)}",
            f"- Failures: {0 if checks.empty else int((checks['status'] != 'pass').sum())}",
            "- The periods/yearly schema also includes generic math-checker columns (`variant`, `timing`, `strategy_return`, `invested`, `equity`).",
            "",
            "## Limitations",
            "",
            "- This is an approximate Power Trend rule, not a claimed exact Mike Webster/IBD implementation.",
            "- QQQ is used as the Nasdaq proxy because local cache contains ETF OHLC data; no Nasdaq Composite/index internals were used.",
            "- Leveraged ETF results are path-dependent and can degrade from volatility drag; they are research only.",
            "- Current cache availability determines date coverage; no yfinance or live data fallback is used.",
        ]
    )

    report_path.write_text("\n".join(lines), encoding="utf-8")


def run(config: RunConfig) -> tuple[Path, Path, Path, Path, Path, pd.DataFrame]:
    frame, sources = build_market_frame(config)
    base = add_power_trend_features(frame)
    periods = build_periods(base, config)
    yearly = build_yearly(periods)
    preliminary_summary = build_summary(periods, yearly, config, "internal_pending")
    checks = build_math_checks(periods, yearly, preliminary_summary)
    status = math_status(checks)
    summary = build_summary(periods, yearly, config, status)
    checks = build_math_checks(periods, yearly, summary)
    status = math_status(checks)
    summary = build_summary(periods, yearly, config, status)

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    periods_path = REPORTS_DIR / f"{config.output_prefix}_periods.csv"
    yearly_path = REPORTS_DIR / f"{config.output_prefix}_yearly.csv"
    summary_path = REPORTS_DIR / f"{config.output_prefix}_summary.csv"
    math_path = REPORTS_DIR / f"{config.output_prefix}_math_checks.csv"
    report_path = REPORTS_DIR / f"{config.output_prefix}_report.md"

    periods.to_csv(periods_path, index=False)
    yearly.to_csv(yearly_path, index=False)
    summary.to_csv(summary_path, index=False)
    checks.to_csv(math_path, index=False)
    write_markdown_report(report_path, periods_path, yearly_path, summary_path, math_path, periods, yearly, summary, checks, config, sources)
    return periods_path, yearly_path, summary_path, math_path, report_path, summary


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Cache-only Nasdaq/QQQ Power Trend leverage-gate research backtest.")
    parser.add_argument("--start", help="Inclusive start date, YYYY-MM-DD. Defaults to first valid local-cache date after warmup.")
    parser.add_argument("--end", help="Inclusive end date, YYYY-MM-DD. Defaults to today/local cache end.")
    parser.add_argument("--initial-capital", type=float, default=DEFAULT_INITIAL_CAPITAL)
    parser.add_argument("--adjusted-prices", type=parse_bool, default=True, help="Use FMP adjClose-adjusted OHLC when true.")
    parser.add_argument("--include-same-day-diagnostic", type=parse_bool, default=False)
    parser.add_argument("--output-prefix", default=f"nasdaq_power_trend_{date.today().isoformat()}")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    config = RunConfig(
        start=args.start,
        end=args.end,
        initial_capital=args.initial_capital,
        adjusted_prices=args.adjusted_prices,
        output_prefix=args.output_prefix,
        include_same_day_diagnostic=args.include_same_day_diagnostic,
    )
    try:
        periods_path, yearly_path, summary_path, math_path, report_path, summary = run(config)
    except DataUnavailable as exc:
        raise SystemExit(
            f"{exc}\n\n"
            "This runner uses only local FMP price_cache files and never uses yfinance. "
            "Populate QQQ/TQQQ/SOXL through price_cache.py if local rows are missing."
        ) from exc

    print(RESEARCH_LABEL)
    print(f"Periods written to {periods_path}")
    print(f"Yearly written to {yearly_path}")
    print(f"Summary written to {summary_path}")
    print(f"Math checks written to {math_path}")
    print(f"Markdown report written to {report_path}")
    shifted = summary[summary["timing"].eq("shifted_no_lookahead")]
    print(shifted.to_string(index=False))


if __name__ == "__main__":
    main()
