from __future__ import annotations

import argparse
import sys
import traceback
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from fred_macro_filter_overlay_runner import build_macro_features, build_qqq_ma200_features, macro_bucket_count
from holy_qm_day4121_runner import passes_iwm_symbol_hygiene
from nasdaq100_accel_momentum_risk_runner import load_price_frame
from nasdaq100_second_derivative_scanner import (
    BENCHMARK,
    FEATURE_DEFINITION,
    SCORE_DEFINITION,
    ScannerConfig,
    build_schedules,
    completed_feature_frame,
    rank_acceleration_candidates,
)
from quality_regime_router_runner import PROJECT_ROOT, REPORTS_DIR, UNIVERSES, load_tickers, max_drawdown_pct


UNIVERSE = "qqq"
OUTPUT_PREFIX = f"tight_setup_acceleration_{date.today().isoformat()}"
FOCUS_YEARS = (2018, 2022, 2025, 2026)

# The command bridge treats any stderr output (including FutureWarnings) as a
# failure. Opt into pandas' future downcasting behavior so fillna/ffill/bfill
# never emit downcasting FutureWarnings anywhere in this run.
pd.set_option("future.no_silent_downcasting", True)


def coerce_bool(series: pd.Series) -> pd.Series:
    """NaN-safe boolean coercion that avoids fillna downcasting FutureWarnings."""
    return series.where(series.notna(), False).astype(bool)


@dataclass(frozen=True)
class TightConfig:
    start_year: int = 2010
    end_date: str | None = None
    universe: str = UNIVERSE
    iwm_top_count: int = 200
    theme: str = "none"
    theme_tickers_file: str | None = None
    stop_grid: str = "standard"
    top_values: tuple[int, ...] = (5, 10)
    frequencies: tuple[str, ...] = ("monthly", "weekly")
    min_price: float = 1.0
    min_history_rows: int = 260
    adjusted_prices: bool = True
    output_prefix: str = OUTPUT_PREFIX


@dataclass(frozen=True)
class VariantSpec:
    name: str
    setup_filter: str
    stop_rule: str = "none"
    macro_filter: str = "none"
    diagnostic: bool = False


def parse_csv_ints(value: str) -> tuple[int, ...]:
    parsed = tuple(int(part.strip()) for part in value.split(",") if part.strip())
    if not parsed or any(item <= 0 for item in parsed):
        raise argparse.ArgumentTypeError("Provide positive comma-separated integers.")
    return parsed


def parse_csv_strings(value: str) -> tuple[str, ...]:
    parsed = tuple(part.strip().lower() for part in value.split(",") if part.strip())
    allowed = {"weekly", "monthly"}
    unsupported = sorted(set(parsed) - allowed)
    if unsupported:
        raise argparse.ArgumentTypeError(f"Unsupported frequencies: {unsupported}. Allowed: {sorted(allowed)}")
    if not parsed:
        raise argparse.ArgumentTypeError("Provide at least one frequency.")
    return parsed


def parse_bool(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "y"}:
        return True
    if normalized in {"0", "false", "no", "n"}:
        return False
    raise argparse.ArgumentTypeError(f"Expected true/false, got {value!r}")


def cagr(total_return: float, start_date: Any, end_date: Any) -> float:
    years = max((pd.Timestamp(end_date) - pd.Timestamp(start_date)).days / 365.25, 1 / 365.25)
    if total_return <= -1:
        return -1.0
    return float((1 + total_return) ** (1 / years) - 1)


def rolling_percentile_last(values: pd.Series) -> float:
    clean = pd.to_numeric(values, errors="coerce").dropna()
    if clean.empty:
        return np.nan
    return float(clean.rank(pct=True).iloc[-1])


def add_tight_indicators(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    close = out["close"].astype(float)
    high = out["high"].astype(float)
    low = out["low"].astype(float)
    volume = out["volume"].astype(float)
    previous_close = close.shift(1)
    true_range = pd.concat([high - low, (high - previous_close).abs(), (low - previous_close).abs()], axis=1).max(axis=1)

    for window in (5, 10, 20, 50, 150, 200):
        out[f"sma{window}"] = close.rolling(window).mean()
    for window in (5, 10, 20):
        out[f"ema{window}"] = close.ewm(span=window, adjust=False, min_periods=window).mean()
    for window in (10, 20, 50, 100, 252):
        out[f"high{window}"] = high.rolling(window).max()
        out[f"low{window}"] = low.rolling(window).min()
    for window in (10, 20, 50, 100):
        out[f"range{window}_pct"] = out[f"high{window}"] / out[f"low{window}"] - 1

    out["atr20"] = true_range.rolling(20).mean()
    out["atr22"] = true_range.rolling(22).mean()
    out["atr20_pct"] = out["atr20"] / close
    out["atr20_pct_rank_252"] = out["atr20_pct"].rolling(252, min_periods=126).apply(rolling_percentile_last, raw=False)
    out["retvol20_pct"] = close.pct_change(fill_method=None).rolling(20).std()
    out["retvol20_pct_rank_252"] = out["retvol20_pct"].rolling(252, min_periods=126).apply(rolling_percentile_last, raw=False)
    out["avg_volume10"] = volume.rolling(10).mean()
    out["avg_volume20"] = volume.rolling(20).mean()
    out["avg_volume50"] = volume.rolling(50).mean()

    out["contraction_10v50"] = out["range10_pct"] <= out["range50_pct"] * 0.75
    out["contraction_20v100"] = out["range20_pct"] <= out["range100_pct"] * 0.80
    out["low_volatility"] = out[["atr20_pct_rank_252", "retvol20_pct_rank_252"]].min(axis=1) <= 0.65
    out["near_high"] = ((close / out["high100"] - 1).abs() <= 0.10) | ((close / out["high252"] - 1).abs() <= 0.15)
    out["not_extended"] = (close / out["sma50"] - 1) <= 0.15
    out["volume_contraction"] = (out["avg_volume10"] <= out["avg_volume50"] * 0.90) | (out["avg_volume20"] <= out["avg_volume50"] * 0.95)
    out["stop_distance20_pct"] = close / out["low20"] - 1
    out["sma20_distance_pct"] = close / out["sma20"] - 1
    out["tight_stop_proxy"] = (out["stop_distance20_pct"] <= 0.12) | (out["sma20_distance_pct"] <= 0.08)
    out["tight_vcp_filter"] = (
        (out["contraction_10v50"] | out["contraction_20v100"])
        & out["low_volatility"]
        & out["near_high"]
        & out["not_extended"]
        & out["tight_stop_proxy"]
    )
    out["strict_tight_vcp_filter"] = (
        out["contraction_10v50"]
        & (out["atr20_pct_rank_252"] <= 0.50)
        & out["near_high"]
        & ((close / out["sma50"] - 1) <= 0.10)
        & (out["stop_distance20_pct"] <= 0.08)
        & out["volume_contraction"]
    )
    out["trend_template_filter"] = (
        (close > out["sma50"])
        & (out["sma50"] > out["sma150"])
        & (out["sma150"] > out["sma200"])
        & (close > out["sma200"])
        & (out["sma50"] > out["sma50"].shift(20))
        & (out["sma200"] > out["sma200"].shift(20))
        & (close >= out["low252"] * 1.30)
        & (close >= out["high252"] * 0.75)
    )
    return out


def row_as_of(frame: pd.DataFrame, current_date: pd.Timestamp) -> pd.Series | None:
    history = frame.loc[:current_date]
    if history.empty:
        return None
    row = history.iloc[-1]
    return None if pd.isna(row.get("close")) else row


def feature_columns() -> list[str]:
    return [
        "atr20_pct",
        "atr20_pct_rank_252",
        "retvol20_pct_rank_252",
        "range10_pct",
        "range20_pct",
        "range50_pct",
        "range100_pct",
        "stop_distance20_pct",
        "sma20_distance_pct",
        "contraction_10v50",
        "contraction_20v100",
        "low_volatility",
        "near_high",
        "not_extended",
        "volume_contraction",
        "tight_stop_proxy",
        "tight_vcp_filter",
        "strict_tight_vcp_filter",
        "trend_template_filter",
    ]


def setup_mask(ranked: pd.DataFrame, setup_filter: str) -> pd.Series:
    if ranked.empty:
        return pd.Series(dtype="bool")
    if setup_filter == "baseline":
        return pd.Series(True, index=ranked.index)
    if setup_filter == "tight":
        return coerce_bool(ranked["tight_vcp_filter"])
    if setup_filter == "trend_tight":
        return coerce_bool(ranked["tight_vcp_filter"]) & coerce_bool(ranked["trend_template_filter"])
    if setup_filter == "strict_trend_tight":
        return coerce_bool(ranked["strict_tight_vcp_filter"]) & coerce_bool(ranked["trend_template_filter"])
    raise ValueError(f"Unsupported setup filter: {setup_filter}")


def variant_specs(stop_grid: str = "standard") -> list[VariantSpec]:
    specs = [
        VariantSpec("baseline_acceleration", "baseline"),
        VariantSpec("tight_vcp", "tight"),
        VariantSpec("trend_tight_vcp", "trend_tight"),
        VariantSpec("trend_tight_vcp_stop5_or_low20", "trend_tight", stop_rule="stop5_or_low20"),
        VariantSpec("trend_tight_vcp_stop5_or_low20_risk1pct", "trend_tight", stop_rule="stop5_or_low20_risk1pct"),
        VariantSpec("trend_tight_vcp_macro_score3_cash", "trend_tight", macro_filter="macro_score3_cash"),
        VariantSpec("strict_trend_tight_vcp_diagnostic", "strict_trend_tight", diagnostic=True),
    ]
    if stop_grid in {"extended", "oneil"}:
        extended_rules = [
            "oneil_8pct_20trail5_8wk",
            "minervini_8pct_breakeven8",
            "minervini_8pct_breakeven10",
        ]
        if stop_grid == "extended":
            extended_rules = [
                "fixed_5pct",
                "fixed_7pct",
                "fixed_8pct",
                "fixed_10pct",
                "low20_support",
                "atr2x_initial",
                "sma5_close",
                "sma10_close",
                "sma20_close",
                "ema5_close",
                "ema10_close",
                "ema20_close",
                "chandelier3atr22",
                "fixed_5pct_risk1pct",
                "fixed_8pct_risk1pct",
                "low20_support_risk1pct",
                "atr2x_initial_risk1pct",
                *extended_rules,
            ]
        existing = {spec.stop_rule for spec in specs}
        for rule in extended_rules:
            if rule in existing:
                continue
            specs.append(VariantSpec(f"trend_tight_vcp_{rule}", "trend_tight", stop_rule=rule))
    elif stop_grid != "standard":
        raise ValueError("Unsupported stop grid. Use 'standard', 'extended', or 'oneil'.")
    return specs


def base_stop_rule(stop_rule: str) -> str:
    return stop_rule[:-9] if stop_rule.endswith("_risk1pct") else stop_rule


def uses_risk_sizing(stop_rule: str) -> bool:
    return stop_rule.endswith("_risk1pct")


def initial_stop_level(stop_rule: str, signal: pd.Series) -> float:
    rule = base_stop_rule(stop_rule)
    close = float(signal["close"])
    low20 = float(signal.get("low20", np.nan))
    atr20 = float(signal.get("atr20", np.nan))
    if rule == "none":
        return np.nan
    if rule in {"stop5_or_low20", "fixed_5pct"}:
        fixed = close * 0.95
        return max(fixed, low20) if rule == "stop5_or_low20" and not pd.isna(low20) else fixed
    if rule == "fixed_7pct":
        return close * 0.93
    if rule == "fixed_8pct":
        return close * 0.92
    if rule == "fixed_10pct":
        return close * 0.90
    if rule == "low20_support":
        return low20 if not pd.isna(low20) else close * 0.95
    if rule == "atr2x_initial":
        return close - 2.0 * atr20 if not pd.isna(atr20) else close * 0.92
    if rule in {"oneil_8pct_20trail5_8wk", "minervini_8pct_breakeven8", "minervini_8pct_breakeven10"}:
        return close * 0.92
    if rule in {"sma5_close", "sma10_close", "sma20_close", "ema5_close", "ema10_close", "ema20_close", "chandelier3atr22"}:
        return np.nan
    raise ValueError(f"Unsupported stop rule: {stop_rule}")


def stop_exit_reason(stop_rule: str, signal: pd.Series, stop_level: float, highest_high: float) -> str | None:
    rule = base_stop_rule(stop_rule)
    if rule == "none":
        return None
    close = float(signal["close"])
    if rule in {
        "stop5_or_low20",
        "fixed_5pct",
        "fixed_7pct",
        "fixed_8pct",
        "fixed_10pct",
        "low20_support",
        "atr2x_initial",
        "oneil_8pct_20trail5_8wk",
        "minervini_8pct_breakeven8",
        "minervini_8pct_breakeven10",
    }:
        return rule if not pd.isna(stop_level) and close < float(stop_level) else None
    if rule in {"sma5_close", "sma10_close", "sma20_close", "ema5_close", "ema10_close", "ema20_close"}:
        ma_col = rule.replace("_close", "")
        ma_value = signal.get(ma_col, np.nan)
        return rule if not pd.isna(ma_value) and close < float(ma_value) else None
    if rule == "chandelier3atr22":
        atr22 = signal.get("atr22", np.nan)
        if pd.isna(atr22) or pd.isna(highest_high):
            return None
        chandelier = float(highest_high) - 3.0 * float(atr22)
        return rule if close < chandelier else None
    raise ValueError(f"Unsupported stop rule: {stop_rule}")


def enrich_ranked_with_tight_features(ranked: pd.DataFrame, frames: dict[str, pd.DataFrame], current_date: pd.Timestamp) -> pd.DataFrame:
    if ranked.empty:
        return ranked.copy()
    rows = []
    for _, row in ranked.iterrows():
        out = row.to_dict()
        signal = row_as_of(frames.get(str(row["ticker"]), pd.DataFrame()), current_date)
        if signal is None:
            for col in feature_columns():
                out[col] = np.nan
            out["tight_feature_date"] = None
            out["tight_feature_available"] = False
        else:
            for col in feature_columns():
                value = signal.get(col, np.nan)
                if isinstance(value, (bool, np.bool_)):
                    out[col] = bool(value)
                else:
                    out[col] = value
            out["tight_feature_date"] = pd.Timestamp(signal.name).date().isoformat()
            out["tight_feature_available"] = True
        rows.append(out)
    return pd.DataFrame(rows)


def macro_cash_signal(dates: pd.DatetimeIndex) -> pd.Series:
    macro_features, _coverage = build_macro_features(dates)
    macro_features = macro_features.join(build_qqq_ma200_features(dates), how="left")
    # macro_bucket_count's "weakness" bucket expects monthly-weakness columns that
    # are derived from a base strategy ledger, which this runner does not build.
    # Provide neutral (never-weak) defaults so only the pure macro buckets score.
    for column in ("qqq_month_return_weak_count_4m", "base_month_return_weak_count_4m"):
        if column not in macro_features.columns:
            macro_features[column] = 0.0
    score = macro_bucket_count(macro_features)
    qqq_below = coerce_bool(macro_features.get("qqq_below_ma200_signal", pd.Series(False, index=macro_features.index)))
    return (score >= 3) | ((score >= 2) & qqq_below)


def variant_name(top: int, frequency: str, spec: VariantSpec, universe_label: str = "nasdaq100") -> str:
    return f"{universe_label}_accel_top{top}_{frequency}__{spec.name}"


def simulate_variant(
    top: int,
    frequency: str,
    spec: VariantSpec,
    schedule: list[pd.Timestamp],
    tickers: list[str],
    feature_frames: dict[str, pd.DataFrame],
    frames: dict[str, pd.DataFrame],
    returns: pd.DataFrame,
    benchmark_returns: pd.Series,
    scanner_cfg: ScannerConfig,
    macro_signal: pd.Series,
    universe_label: str = "nasdaq100",
    selected_universe_label: str = "nasdaq100_current_qqq_constituents",
    benchmark_symbol: str = BENCHMARK,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    variant = variant_name(top, frequency, spec, universe_label)
    rebalance_dates = set(pd.Timestamp(item) for item in schedule[:-1])
    all_dates = [pd.Timestamp(item) for item in returns.index if schedule and schedule[0] <= item <= schedule[-1]]
    holdings: list[str] = []
    weights: dict[str, float] = {}
    stop_levels: dict[str, float] = {}
    highest_highs: dict[str, float] = {}
    entry_dates: dict[str, pd.Timestamp] = {}
    entry_prices: dict[str, float] = {}
    oneil_hold_until: dict[str, pd.Timestamp] = {}
    oneil_trailing_active: set[str] = set()
    breakeven_active: set[str] = set()
    last_rebalance: pd.Timestamp | None = None
    last_clean = 0
    last_positive = 0
    last_tight_eligible = 0
    last_selected = ""
    last_rebalance_reason = "initial_cash_before_first_rebalance"
    periods: list[dict[str, Any]] = []
    trades: list[dict[str, Any]] = []
    snapshots: list[dict[str, Any]] = []
    rebalance_rows: list[dict[str, Any]] = []

    for current_date in all_dates:
        day_returns = returns.loc[current_date] if current_date in returns.index else pd.Series(dtype="float64")
        exit_reasons: list[str] = []
        macro_blocked = bool(spec.macro_filter == "macro_score3_cash" and coerce_bool(macro_signal.reindex([current_date])).iloc[0])
        pre_stop_holdings = list(holdings)
        pre_stop_weights = dict(weights)
        invested_holdings = [] if macro_blocked else pre_stop_holdings
        strategy_return = float(
            sum(float(day_returns.get(ticker, 0.0)) * pre_stop_weights.get(ticker, 0.0) for ticker in invested_holdings)
        )
        gross_exposure = float(sum(pre_stop_weights.get(ticker, 0.0) for ticker in invested_holdings))

        if spec.stop_rule != "none":
            for ticker in list(holdings):
                signal = row_as_of(frames.get(ticker, pd.DataFrame()), current_date)
                if signal is None:
                    continue
                high = float(signal.get("high", np.nan))
                if not pd.isna(high):
                    highest_highs[ticker] = max(float(highest_highs.get(ticker, high)), high)
                stop_level = float(stop_levels.get(ticker, np.nan))
                rule = base_stop_rule(spec.stop_rule)
                entry_date = entry_dates.get(ticker)
                entry_price = float(entry_prices.get(ticker, np.nan))
                if rule == "oneil_8pct_20trail5_8wk" and entry_date is not None and pd.notna(entry_price):
                    reached_20 = not pd.isna(high) and high >= entry_price * 1.20
                    days_since_entry = (current_date - entry_date).days
                    if reached_20 and ticker not in oneil_hold_until and ticker not in oneil_trailing_active:
                        if days_since_entry <= 21:
                            oneil_hold_until[ticker] = entry_date + pd.Timedelta(days=56)
                        else:
                            oneil_trailing_active.add(ticker)
                    hold_until = oneil_hold_until.get(ticker)
                    if hold_until is not None and current_date <= hold_until:
                        continue
                    if hold_until is not None and current_date > hold_until:
                        oneil_trailing_active.add(ticker)
                    if ticker in oneil_trailing_active:
                        trail_stop = float(highest_highs.get(ticker, entry_price)) * 0.95
                        stop_levels[ticker] = trail_stop
                        stop_level = trail_stop
                elif rule in {"minervini_8pct_breakeven8", "minervini_8pct_breakeven10"} and pd.notna(entry_price):
                    trigger = 1.08 if rule == "minervini_8pct_breakeven8" else 1.10
                    if not pd.isna(high) and high >= entry_price * trigger:
                        breakeven_active.add(ticker)
                    if ticker in breakeven_active:
                        breakeven_stop = max(stop_level if pd.notna(stop_level) else -np.inf, entry_price)
                        stop_levels[ticker] = breakeven_stop
                        stop_level = breakeven_stop
                reason = stop_exit_reason(spec.stop_rule, signal, stop_level, float(highest_highs.get(ticker, np.nan)))
                if reason:
                    holdings.remove(ticker)
                    weights.pop(ticker, None)
                    stop_levels.pop(ticker, None)
                    highest_highs.pop(ticker, None)
                    entry_dates.pop(ticker, None)
                    entry_prices.pop(ticker, None)
                    oneil_hold_until.pop(ticker, None)
                    oneil_trailing_active.discard(ticker)
                    breakeven_active.discard(ticker)
                    exit_reasons.append(f"{ticker}:{reason}")
                    trades.append(
                        {
                            "variant": variant,
                            "event": "stop_exit",
                            "date": current_date.date().isoformat(),
                            "ticker": ticker,
                            "price": round(float(signal["close"]), 6),
                            "stop_level": round(stop_level, 6),
                            "exit_reason": reason,
                            "same_day_return_counted": True,
                        }
                    )

        periods.append(
            {
                "date": current_date.date().isoformat(),
                "year": int(current_date.year),
                "variant": variant,
                "timing": frequency,
                "top": top,
                "setup_filter": spec.setup_filter,
                "stop_rule": spec.stop_rule,
                "macro_filter": spec.macro_filter,
                "selected_universe": selected_universe_label,
                "benchmark": benchmark_symbol,
                "diagnostic_variant": spec.diagnostic,
                "strategy_return": strategy_return,
                "benchmark_return": float(benchmark_returns.loc[current_date]) if current_date in benchmark_returns.index else 0.0,
                "invested": bool(invested_holdings),
                "positions": int(len(invested_holdings)),
                "selected_positions": int(len(holdings)),
                "gross_exposure": gross_exposure,
                "cash_weight": 1.0 - gross_exposure,
                "macro_cash_signal": macro_blocked,
                "rebalance_date": last_rebalance.date().isoformat() if last_rebalance is not None else None,
                "selected_tickers": ",".join(invested_holdings),
                "raw_selected_tickers": last_selected,
                "clean_tradable_candidates": last_clean,
                "positive_accel_candidates": last_positive,
                "tight_eligible_candidates": last_tight_eligible,
                "decision_reason": last_rebalance_reason,
                "exit_reasons_after_prior_close": ";".join(exit_reasons),
                "rank_metric": SCORE_DEFINITION,
                "feature_definition": FEATURE_DEFINITION,
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
        eligible = positive[setup_mask(positive, spec.setup_filter)].copy() if not positive.empty else pd.DataFrame()
        locked_holdings: list[str] = []
        if base_stop_rule(spec.stop_rule) == "oneil_8pct_20trail5_8wk":
            locked_holdings = [
                ticker
                for ticker in holdings
                if ticker in oneil_hold_until and current_date <= oneil_hold_until[ticker]
            ]
        open_slots = max(top - len(locked_holdings), 0)
        if open_slots > 0 and not eligible.empty and "ticker" in eligible.columns:
            selected = eligible[~eligible["ticker"].astype(str).isin(locked_holdings)].head(open_slots).copy()
        else:
            selected = pd.DataFrame()
        new_holdings = selected["ticker"].astype(str).tolist() if not selected.empty else []
        holdings = locked_holdings + new_holdings
        weight = 1.0 / len(holdings) if holdings else 0.0
        weights = {ticker: weight for ticker in holdings}
        stop_levels = {ticker: stop_levels[ticker] for ticker in locked_holdings if ticker in stop_levels}
        highest_highs = {ticker: highest_highs[ticker] for ticker in locked_holdings if ticker in highest_highs}
        entry_dates = {ticker: entry_dates[ticker] for ticker in locked_holdings if ticker in entry_dates}
        entry_prices = {ticker: entry_prices[ticker] for ticker in locked_holdings if ticker in entry_prices}
        oneil_hold_until = {ticker: oneil_hold_until[ticker] for ticker in locked_holdings if ticker in oneil_hold_until}
        oneil_trailing_active = {ticker for ticker in oneil_trailing_active if ticker in locked_holdings}
        breakeven_active = {ticker for ticker in breakeven_active if ticker in locked_holdings}
        for ticker in new_holdings:
            signal = row_as_of(frames.get(ticker, pd.DataFrame()), current_date)
            if signal is None:
                continue
            stop_levels[ticker] = initial_stop_level(spec.stop_rule, signal)
            high = float(signal.get("high", np.nan))
            highest_highs[ticker] = high if not pd.isna(high) else float(signal["close"])
            entry_dates[ticker] = current_date
            entry_prices[ticker] = float(signal["close"])
        if uses_risk_sizing(spec.stop_rule):
            risk_weights: dict[str, float] = {}
            for ticker in holdings:
                signal = row_as_of(frames.get(ticker, pd.DataFrame()), current_date)
                if signal is None:
                    continue
                close = float(signal["close"])
                stop_level = float(stop_levels.get(ticker, np.nan))
                stop_risk = (close - stop_level) / close if close > 0 and not pd.isna(stop_level) else np.nan
                risk_weights[ticker] = min(weight, 0.01 / stop_risk) if pd.notna(stop_risk) and stop_risk > 0 else 0.0
            weights = risk_weights

        last_rebalance = current_date
        last_clean = int(len(ranked))
        last_positive = int(len(positive))
        last_tight_eligible = int(len(eligible))
        last_selected = ",".join(holdings)
        last_rebalance_reason = "selected_tight_setup_leaders" if holdings else "cash_no_eligible_tight_setups"
        rebalance_rows.append(
            {
                "variant": variant,
                "rebalance_date": current_date.date().isoformat(),
                "timing": frequency,
                "top": top,
                "setup_filter": spec.setup_filter,
                "clean_tradable_candidates": last_clean,
                "positive_accel_candidates": last_positive,
                "tight_eligible_candidates": last_tight_eligible,
                "selected_positions": len(holdings),
                "false_no_trade": bool(last_positive > 0 and not holdings),
                "selected_tickers": last_selected,
            }
        )
        selected_tickers = set(holdings)
        for rank_idx, row in ranked.iterrows():
            ticker = str(row["ticker"])
            snapshots.append(
                {
                    "variant": variant,
                    "rebalance_date": current_date.date().isoformat(),
                    "timing": frequency,
                    "top": top,
                    "ticker": ticker,
                    "selected": ticker in selected_tickers,
                    "eligible_after_tight_filter": ticker in set(eligible["ticker"].astype(str)) if not eligible.empty else False,
                    "accel_rank": int(row.get("accel_rank", rank_idx + 1)),
                    "accel_score": row.get("accel_score"),
                    "roc_20": row.get("roc_20"),
                    "acceleration_20": row.get("acceleration_20"),
                    "feature_date": row.get("feature_date"),
                    **{col: row.get(col) for col in feature_columns()},
                }
            )
        for rank_idx, row in selected.reset_index(drop=True).iterrows():
            trades.append(
                {
                    "variant": variant,
                    "event": "entry",
                    "date": current_date.date().isoformat(),
                    "ticker": row["ticker"],
                    "rank": int(rank_idx + 1),
                    "weight": round(float(weights.get(str(row["ticker"]), weight)), 6),
                    "accel_score": row.get("accel_score"),
                    "stop_level": round(float(stop_levels.get(str(row["ticker"]), np.nan)), 6),
                    "setup_filter": spec.setup_filter,
                    "stop_rule": spec.stop_rule,
                    "macro_filter": spec.macro_filter,
                }
            )
    return periods, trades, snapshots, rebalance_rows


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
        benchmark = pd.to_numeric(group["benchmark_return"], errors="coerce").fillna(0.0)
        rows.append(
            {
                "variant": variant,
                "timing": group["timing"].iloc[0],
                "top": int(group["top"].iloc[0]),
                "setup_filter": group["setup_filter"].iloc[0],
                "stop_rule": group["stop_rule"].iloc[0],
                "macro_filter": group["macro_filter"].iloc[0],
                "month": month,
                "year": int(month[:4]),
                "strategy_return_pct": round(((1 + returns).prod() - 1) * 100, 2),
                "benchmark_return_pct": round(((1 + benchmark).prod() - 1) * 100, 2),
                "max_drawdown_pct": round(max_drawdown_pct((1 + returns).cumprod()), 2),
                "exposure_pct": round(float(group["invested"].astype(bool).mean() * 100), 2),
                "avg_positions": round(float(pd.to_numeric(group["positions"], errors="coerce").mean()), 2),
                "macro_cash_days": int(group["macro_cash_signal"].astype(bool).sum()),
                "days": int(len(group)),
            }
        )
    return pd.DataFrame(rows).sort_values(["variant", "month"])


def build_yearly(periods: pd.DataFrame, monthly: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for (variant, year), group in periods.groupby(["variant", "year"], sort=True):
        returns = pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)
        benchmark = pd.to_numeric(group["benchmark_return"], errors="coerce").fillna(0.0)
        months = monthly[monthly["variant"].eq(variant) & monthly["year"].eq(int(year))]
        rows.append(
            {
                "variant": variant,
                "timing": group["timing"].iloc[0],
                "top": int(group["top"].iloc[0]),
                "setup_filter": group["setup_filter"].iloc[0],
                "stop_rule": group["stop_rule"].iloc[0],
                "macro_filter": group["macro_filter"].iloc[0],
                "year": int(year),
                "annual_return_pct": round(((1 + returns).prod() - 1) * 100, 2),
                "benchmark_return_pct": round(((1 + benchmark).prod() - 1) * 100, 2),
                "max_drawdown_pct": round(max_drawdown_pct((1 + returns).cumprod()), 2),
                "worst_month_pct": round(float(pd.to_numeric(months["strategy_return_pct"], errors="coerce").min()), 2)
                if not months.empty
                else np.nan,
                "exposure_pct": round(float(group["invested"].astype(bool).mean() * 100), 2),
                "avg_positions": round(float(pd.to_numeric(group["positions"], errors="coerce").mean()), 2),
            }
        )
    return pd.DataFrame(rows).sort_values(["variant", "year"])


def build_summary(periods: pd.DataFrame, yearly: pd.DataFrame, monthly: pd.DataFrame, rebalances: pd.DataFrame) -> pd.DataFrame:
    rows = []
    baseline_by_key: dict[tuple[str, int], dict[str, float]] = {}
    for variant, group in periods[periods["setup_filter"].eq("baseline")].groupby("variant"):
        key = (str(group["timing"].iloc[0]), int(group["top"].iloc[0]))
        returns = pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)
        total = float((1 + returns).prod() - 1)
        baseline_by_key[key] = {
            "cagr_pct": round(cagr(total, group["date"].iloc[0], group["date"].iloc[-1]) * 100, 2),
            "max_drawdown_pct": round(float(group["drawdown_pct"].min()), 2),
        }

    for variant, group in periods.groupby("variant", sort=True):
        group = group.sort_values("date")
        returns = pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)
        total = float((1 + returns).prod() - 1)
        timing = str(group["timing"].iloc[0])
        top = int(group["top"].iloc[0])
        key = (timing, top)
        baseline = baseline_by_key.get(key, {})
        variant_years = yearly[yearly["variant"].eq(variant)]
        variant_months = monthly[monthly["variant"].eq(variant)]
        rb = rebalances[rebalances["variant"].eq(variant)] if not rebalances.empty else pd.DataFrame()
        cagr_pct = round(cagr(total, group["date"].iloc[0], group["date"].iloc[-1]) * 100, 2)
        max_dd = round(float(group["drawdown_pct"].min()), 2)
        rows.append(
            {
                "variant": variant,
                "timing": timing,
                "top": top,
                "setup_filter": group["setup_filter"].iloc[0],
                "stop_rule": group["stop_rule"].iloc[0],
                "macro_filter": group["macro_filter"].iloc[0],
                "diagnostic_variant": bool(group["diagnostic_variant"].iloc[0]),
                "start_date": group["date"].iloc[0],
                "end_date": group["date"].iloc[-1],
                "total_return_pct": round(total * 100, 2),
                "cagr_pct": cagr_pct,
                "cagr_delta_vs_baseline_pct": round(cagr_pct - float(baseline.get("cagr_pct", cagr_pct)), 2),
                "max_drawdown_pct": max_dd,
                "dd_improvement_vs_baseline_pct": round(max_dd - float(baseline.get("max_drawdown_pct", max_dd)), 2),
                "worst_month_pct": round(float(pd.to_numeric(variant_months["strategy_return_pct"], errors="coerce").min()), 2),
                "worst_year": int(variant_years.sort_values("annual_return_pct").iloc[0]["year"]) if not variant_years.empty else np.nan,
                "worst_year_return_pct": round(float(pd.to_numeric(variant_years["annual_return_pct"], errors="coerce").min()), 2),
                "loss_years": int(pd.to_numeric(variant_years["annual_return_pct"], errors="coerce").lt(0).sum()),
                "exposure_pct": round(float(group["invested"].astype(bool).mean() * 100), 2),
                "avg_positions": round(float(pd.to_numeric(group["positions"], errors="coerce").mean()), 2),
                "avg_positive_accel_candidates": round(float(pd.to_numeric(rb.get("positive_accel_candidates"), errors="coerce").mean()), 2)
                if not rb.empty
                else np.nan,
                "avg_tight_eligible_names": round(float(pd.to_numeric(rb.get("tight_eligible_candidates"), errors="coerce").mean()), 2)
                if not rb.empty
                else np.nan,
                "false_no_trade_rebalances": int(rb["false_no_trade"].astype(bool).sum()) if not rb.empty else 0,
                "rebalance_count": int(len(rb)),
                "macro_cash_days": int(group["macro_cash_signal"].astype(bool).sum()),
                "margin_allowed": False,
                "short_allowed": False,
                "leveraged_etfs_allowed": False,
            }
        )
    return pd.DataFrame(rows).sort_values(["timing", "top", "cagr_pct"], ascending=[True, True, False])


def build_focus_years(yearly: pd.DataFrame) -> pd.DataFrame:
    return yearly[yearly["year"].isin(FOCUS_YEARS)].copy().sort_values(["year", "timing", "top", "variant"])


def build_math_checks(periods: pd.DataFrame, yearly: pd.DataFrame, monthly: pd.DataFrame, summary: pd.DataFrame) -> pd.DataFrame:
    checks: list[dict[str, Any]] = []

    def add(source: str, check: str, expected: float | str, actual: float | str, detail: str, tolerance: float = 0.05) -> None:
        if isinstance(expected, (int, float)) and isinstance(actual, (int, float)) and not (pd.isna(expected) or pd.isna(actual)):
            difference: float | str = round(float(actual) - float(expected), 6)
            status = "pass" if abs(float(expected) - float(actual)) <= tolerance else "fail"
        else:
            difference = ""
            status = "pass" if expected == actual else "fail"
        checks.append({"source": source, "check": check, "status": status, "expected": expected, "actual": actual, "difference": difference, "detail": detail})

    work = periods.copy()
    work["_month"] = pd.to_datetime(work["date"]).dt.to_period("M").astype(str)
    work["_return"] = pd.to_numeric(work["strategy_return"], errors="coerce").fillna(0.0).clip(lower=-1.0)
    yearly_expected = work.groupby(["variant", "year"], sort=False)["_return"].apply(lambda x: round(((1 + x).prod() - 1) * 100, 2)).to_dict()
    monthly_expected = work.groupby(["variant", "_month"], sort=False)["_return"].apply(lambda x: round(((1 + x).prod() - 1) * 100, 2)).to_dict()
    summary_expected = work.groupby("variant", sort=False)["_return"].apply(lambda x: round(((1 + x).prod() - 1) * 100, 2)).to_dict()
    drawdown_expected = work.groupby("variant", sort=False)["drawdown_pct"].min().round(2).to_dict()
    add("constraints", "no_margin_or_short", "pass", "pass" if pd.to_numeric(periods["gross_exposure"], errors="coerce").fillna(0.0).le(1.0000001).all() else "fail", "Gross exposure never exceeds 1x.")
    add("signals", "first_signal_day_has_no_return", "pass", "pass" if periods.groupby("variant")["strategy_return"].first().fillna(0.0).eq(0.0).all() else "fail", "Initial rebalance close does not earn same-day strategy return.")
    for _, row in yearly.iterrows():
        add("yearly", f"{row['variant']}_{int(row['year'])}_annual_return_pct", yearly_expected.get((row["variant"], int(row["year"])), np.nan), float(row["annual_return_pct"]), "Recomputed from daily returns.")
    for _, row in monthly.iterrows():
        add("monthly", f"{row['variant']}_{row['month']}_monthly_return_pct", monthly_expected.get((row["variant"], str(row["month"])), np.nan), float(row["strategy_return_pct"]), "Recomputed from daily returns.")
    for _, row in summary.iterrows():
        add("summary", f"{row['variant']}_total_return_pct", summary_expected.get(row["variant"], np.nan), float(row["total_return_pct"]), "Recomputed from daily returns.")
        add("summary", f"{row['variant']}_max_drawdown_pct", float(drawdown_expected.get(row["variant"], np.nan)), float(row["max_drawdown_pct"]), "Recomputed from daily equity curve.")
    return pd.DataFrame(checks)


def build_coverage(tickers: list[str], frames: dict[str, pd.DataFrame], sources: dict[str, str], cfg: TightConfig) -> pd.DataFrame:
    rows = []
    for ticker in tickers:
        frame = frames.get(ticker, pd.DataFrame())
        rows.append(
            {
                "ticker": ticker,
                "has_ohlcv": not frame.empty,
                "rows": int(len(frame)),
                "first_date": frame.index.min().date().isoformat() if not frame.empty else "",
                "last_date": frame.index.max().date().isoformat() if not frame.empty else "",
                "has_min_history": bool(len(frame) >= cfg.min_history_rows),
                "source": sources.get(ticker, ""),
            }
        )
    return pd.DataFrame(rows)


def select_iwm_top_dollar_volume(tickers: list[str], frames: dict[str, pd.DataFrame], cfg: TightConfig) -> tuple[list[str], pd.DataFrame]:
    rows: list[dict[str, Any]] = []
    for ticker in tickers:
        symbol = ticker.upper().strip()
        if symbol == "IWM":
            continue
        frame = frames.get(symbol, pd.DataFrame())
        if frame.empty:
            continue
        recent = frame.tail(63)
        close = pd.to_numeric(recent.get("close"), errors="coerce")
        volume = pd.to_numeric(recent.get("volume"), errors="coerce")
        dollar_volume = (close * volume).replace([float("inf"), -float("inf")], np.nan).dropna()
        last_close = pd.to_numeric(frame["close"], errors="coerce").dropna()
        history_ok = len(frame) >= cfg.min_history_rows
        price_ok = not last_close.empty and float(last_close.iloc[-1]) >= cfg.min_price
        hygiene_ok = passes_iwm_symbol_hygiene(symbol)
        dollar_volume_ok = not dollar_volume.empty and float(dollar_volume.mean()) > 0
        eligible = bool(history_ok and price_ok and hygiene_ok and dollar_volume_ok)
        rows.append(
            {
                "ticker": symbol,
                "eligible": eligible,
                "rows": int(len(frame)),
                "first_date": frame.index.min().date().isoformat(),
                "last_date": frame.index.max().date().isoformat(),
                "latest_close": round(float(last_close.iloc[-1]), 4) if not last_close.empty else np.nan,
                "avg_dollar_volume": float(dollar_volume.mean()) if dollar_volume_ok else np.nan,
                "history_ok": history_ok,
                "price_ok": price_ok,
                "symbol_hygiene_ok": hygiene_ok,
            }
        )

    subset = pd.DataFrame(rows)
    if subset.empty:
        return [], subset
    subset = subset.sort_values(["eligible", "avg_dollar_volume", "ticker"], ascending=[False, False, True]).reset_index(drop=True)
    selected = subset[subset["eligible"].astype(bool)].head(max(1, int(cfg.iwm_top_count)))["ticker"].astype(str).tolist()
    subset["selected"] = subset["ticker"].astype(str).isin(selected)
    subset["subset_mode"] = "top_dollar_volume_count"
    subset["subset_count"] = int(cfg.iwm_top_count)
    return selected, subset


def load_theme_tickers(cfg: TightConfig) -> set[str]:
    theme = cfg.theme.lower().strip()
    if theme == "none":
        return set()
    if theme != "ai_static":
        raise ValueError("Unsupported theme. Use 'none' or 'ai_static'.")

    path = Path(cfg.theme_tickers_file) if cfg.theme_tickers_file else PROJECT_ROOT / "data" / "ai_theme_tickers.txt"
    if not path.exists():
        raise FileNotFoundError(f"Theme ticker file not found: {path}")

    tickers: set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        ticker = line.strip().upper()
        if ticker and not ticker.startswith("#"):
            tickers.add(ticker)
    if not tickers:
        raise ValueError(f"No tickers found in theme file: {path}")
    return tickers


def markdown_table(frame: pd.DataFrame, columns: list[str], max_rows: int | None = None) -> list[str]:
    if frame.empty:
        return ["No rows available."]
    display = frame[[col for col in columns if col in frame.columns]].copy()
    if max_rows is not None:
        display = display.head(max_rows)
    display = display.where(pd.notna(display), "")
    lines = ["| " + " | ".join(display.columns) + " |", "| " + " | ".join("---" for _ in display.columns) + " |"]
    for _, row in display.iterrows():
        values = [f"{value:.2f}" if isinstance(value, float) else str(value) for value in row]
        lines.append("| " + " | ".join(values) + " |")
    return lines


def write_report(outputs: dict[str, Any], summary: pd.DataFrame, focus_years: pd.DataFrame, checks: pd.DataFrame, cfg: TightConfig) -> None:
    failures = checks[checks["status"].ne("pass")] if not checks.empty else checks
    primary = summary[(summary["timing"].eq("monthly")) & (summary["top"].eq(5))].sort_values("cagr_pct", ascending=False)
    universe_note = (
        f"IWM top {cfg.iwm_top_count} cached stocks by recent dollar volume"
        if cfg.universe == "iwm"
        else "Nasdaq-100 current QQQ constituents"
    )
    if cfg.theme != "none":
        universe_note = f"{universe_note}, filtered to {cfg.theme}"
    lines = [
        "# Tight Setup Acceleration Backtest",
        "",
        f"Generated: {datetime.now().isoformat(timespec='seconds')}",
        "",
        "## Method",
        "",
        f"- Universe: {universe_note}.",
        "- Cache-only acceleration ranking; no yfinance, margin, shorting, leveraged ETFs, fees, financing, slippage, or taxes.",
        "- Rebalance signals use completed close/volume/range data at the rebalance close and first earn return on the next close-to-close interval.",
        "- Tight/VCP filter requires contraction, low recent volatility vs prior year, near-high/not-extended location, and a tight stop-distance proxy.",
        "- Trend template approximates Minervini: price above rising 50/150/200-day averages, 50 > 150 > 200, and price in the upper part of the 52-week range.",
        "- Macro diagnostic uses existing shifted FRED/QQQ feature logic and goes cash on macro score >=3, or score >=2 with QQQ below its shifted SMA200.",
        "",
        "## Outputs",
        "",
    ]
    for name, path in outputs.items():
        lines.append(f"- {name}: `{path.relative_to(PROJECT_ROOT)}`")
    lines.extend(["", "## Monthly Top-5 Summary", ""])
    lines.extend(
        markdown_table(
            primary,
            [
                "variant",
                "cagr_pct",
                "cagr_delta_vs_baseline_pct",
                "max_drawdown_pct",
                "dd_improvement_vs_baseline_pct",
                "worst_year",
                "worst_year_return_pct",
                "loss_years",
                "worst_month_pct",
                "exposure_pct",
                "avg_tight_eligible_names",
                "false_no_trade_rebalances",
            ],
        )
    )
    lines.extend(["", "## Focus Years", ""])
    lines.extend(
        markdown_table(
            focus_years,
            [
                "variant",
                "year",
                "annual_return_pct",
                "max_drawdown_pct",
                "worst_month_pct",
                "exposure_pct",
                "avg_positions",
            ],
            max_rows=80,
        )
    )
    lines.extend(["", "## Math Checks", ""])
    lines.append("Internal math checks passed." if failures.empty else failures.to_markdown(index=False))
    lines.extend(["", "## Caveats", ""])
    lines.append("- Current constituent files have survivorship bias, so absolute CAGR is likely overstated; compare variants mainly against the same-run baseline.")
    if cfg.universe == "iwm":
        lines.append("- IWM top-count membership is selected using the latest cached dollar volume, so this is not a fully point-in-time historical universe test.")
    if cfg.theme != "none":
        lines.append("- Theme membership is static/current, not point-in-time historical membership, so theme-filtered tests have theme survivorship bias.")
    lines.append("- Tightness thresholds are intentionally labeled diagnostic until tested out-of-sample and against broader universes.")
    outputs["report"].write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_backtest(
    cfg: TightConfig,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    universe = cfg.universe.lower().strip()
    if universe not in {"qqq", "iwm"}:
        raise ValueError("Unsupported universe. Use 'qqq' or 'iwm'.")

    benchmark_symbol = "IWM" if universe == "iwm" else BENCHMARK
    universe_label = f"iwm_top{cfg.iwm_top_count}" if universe == "iwm" else "nasdaq100"
    selected_universe_label = (
        f"iwm_top{cfg.iwm_top_count}_by_latest_dollar_volume"
        if universe == "iwm"
        else "nasdaq100_current_qqq_constituents"
    )
    theme_tickers = load_theme_tickers(cfg)
    if cfg.theme != "none":
        universe_label = f"{universe_label}_{cfg.theme}"
        selected_universe_label = f"{selected_universe_label}_{cfg.theme}"

    raw_tickers = load_tickers(UNIVERSES[universe].constituents_file)
    all_symbols = sorted(set(raw_tickers + [benchmark_symbol, BENCHMARK]))
    frames: dict[str, pd.DataFrame] = {}
    sources: dict[str, str] = {}
    for ticker in all_symbols:
        frame, source = load_price_frame(ticker, cfg.adjusted_prices)
        if not frame.empty:
            frames[ticker] = add_tight_indicators(frame)
            sources[ticker] = source

    if universe == "iwm":
        tickers, subset = select_iwm_top_dollar_volume(raw_tickers, frames, cfg)
        if not subset.empty:
            REPORTS_DIR.mkdir(exist_ok=True)
            subset.to_csv(REPORTS_DIR / f"{cfg.output_prefix}_iwm_top{cfg.iwm_top_count}_subset.csv", index=False)
    else:
        tickers = raw_tickers
    if theme_tickers:
        tickers = [ticker for ticker in tickers if ticker.upper() in theme_tickers]
        if not tickers:
            raise RuntimeError(f"No {universe.upper()} tickers matched theme {cfg.theme}.")

    benchmark = frames.get(benchmark_symbol, pd.DataFrame())
    if benchmark.empty:
        raise RuntimeError(f"No local {benchmark_symbol} benchmark OHLCV prices found.")

    coverage = build_coverage(tickers, frames, sources, cfg)
    end = pd.Timestamp(cfg.end_date).normalize() if cfg.end_date else pd.Timestamp(benchmark.index.max()).normalize()
    latest_cutoff = end - pd.Timedelta(days=7)
    eligible_tickers = coverage[
        coverage["has_ohlcv"].astype(bool)
        & coverage["has_min_history"].astype(bool)
        & (pd.to_datetime(coverage["last_date"], errors="coerce") >= latest_cutoff)
    ]["ticker"].astype(str).tolist()

    scanner_cfg = ScannerConfig(
        start_year=cfg.start_year,
        end_date=cfg.end_date,
        top_values=cfg.top_values,
        frequencies=cfg.frequencies,
        min_price=cfg.min_price,
        min_history_rows=cfg.min_history_rows,
    )
    feature_frames = {
        ticker: completed_feature_frame(frames[ticker]["return_close"])
        for ticker in eligible_tickers
        if ticker in frames and len(frames[ticker]) >= cfg.min_history_rows
    }
    schedules = build_schedules(pd.to_numeric(benchmark["return_close"], errors="coerce").dropna(), scanner_cfg)
    global_start = min(schedule[0] for schedule in schedules.values() if schedule)
    global_end = max(schedule[-1] for schedule in schedules.values() if schedule)
    trading_dates = pd.DatetimeIndex(benchmark.loc[(benchmark.index >= global_start) & (benchmark.index <= global_end)].index).sort_values().unique()
    returns = pd.DataFrame(
        {
            ticker: pd.to_numeric(frames[ticker]["return_close"], errors="coerce").reindex(trading_dates).ffill().pct_change(fill_method=None).fillna(0.0)
            for ticker in eligible_tickers
            if ticker in frames
        },
        index=trading_dates,
    ).fillna(0.0)
    benchmark_returns = benchmark["return_close"].reindex(trading_dates).ffill().pct_change(fill_method=None).fillna(0.0)
    macro_signal = macro_cash_signal(trading_dates)

    period_rows: list[dict[str, Any]] = []
    trade_rows: list[dict[str, Any]] = []
    snapshot_rows: list[dict[str, Any]] = []
    rebalance_rows: list[dict[str, Any]] = []
    for frequency in cfg.frequencies:
        schedule = schedules.get(frequency, [])
        if len(schedule) < 2:
            continue
        for top in cfg.top_values:
            for spec in variant_specs(cfg.stop_grid):
                periods, trades, snapshots, rebalances = simulate_variant(
                    top,
                    frequency,
                    spec,
                    schedule,
                    eligible_tickers,
                    feature_frames,
                    frames,
                    returns,
                    benchmark_returns,
                    scanner_cfg,
                    macro_signal,
                    universe_label=universe_label,
                    selected_universe_label=selected_universe_label,
                    benchmark_symbol=benchmark_symbol,
                )
                period_rows.extend(periods)
                trade_rows.extend(trades)
                snapshot_rows.extend(snapshots)
                rebalance_rows.extend(rebalances)

    periods = add_equity_drawdown(pd.DataFrame(period_rows))
    trades = pd.DataFrame(trade_rows)
    snapshots = pd.DataFrame(snapshot_rows)
    rebalances = pd.DataFrame(rebalance_rows)
    monthly = build_monthly(periods)
    yearly = build_yearly(periods, monthly)
    summary = build_summary(periods, yearly, monthly, rebalances)
    focus_years = build_focus_years(yearly)
    checks = build_math_checks(periods, yearly, monthly, summary)
    return summary, yearly, monthly, periods, trades, snapshots, rebalances, coverage, focus_years, checks


def write_outputs(
    summary: pd.DataFrame,
    yearly: pd.DataFrame,
    monthly: pd.DataFrame,
    periods: pd.DataFrame,
    trades: pd.DataFrame,
    snapshots: pd.DataFrame,
    rebalances: pd.DataFrame,
    coverage: pd.DataFrame,
    focus_years: pd.DataFrame,
    checks: pd.DataFrame,
    cfg: TightConfig,
) -> dict[str, Any]:
    REPORTS_DIR.mkdir(exist_ok=True)
    base = cfg.output_prefix
    outputs = {
        "summary": REPORTS_DIR / f"{base}_summary.csv",
        "yearly": REPORTS_DIR / f"{base}_yearly.csv",
        "monthly": REPORTS_DIR / f"{base}_monthly.csv",
        "periods": REPORTS_DIR / f"{base}_periods.csv",
        "trades": REPORTS_DIR / f"{base}_trades.csv",
        "scanner_snapshots": REPORTS_DIR / f"{base}_scanner_snapshots.csv",
        "rebalances": REPORTS_DIR / f"{base}_rebalances.csv",
        "coverage": REPORTS_DIR / f"{base}_coverage.csv",
        "focus_years": REPORTS_DIR / f"{base}_focus_years.csv",
        "math_checks": REPORTS_DIR / f"{base}_math_checks.csv",
        "report": REPORTS_DIR / f"{base}_report.md",
    }
    summary.to_csv(outputs["summary"], index=False)
    yearly.to_csv(outputs["yearly"], index=False)
    monthly.to_csv(outputs["monthly"], index=False)
    periods.to_csv(outputs["periods"], index=False)
    trades.to_csv(outputs["trades"], index=False)
    snapshots.to_csv(outputs["scanner_snapshots"], index=False)
    rebalances.to_csv(outputs["rebalances"], index=False)
    coverage.to_csv(outputs["coverage"], index=False)
    focus_years.to_csv(outputs["focus_years"], index=False)
    checks.to_csv(outputs["math_checks"], index=False)
    write_report(outputs, summary, focus_years, checks, cfg)
    return outputs


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Acceleration tight setup/VCP filter backtest.")
    parser.add_argument("--start-year", type=int, default=2010)
    parser.add_argument("--end-date")
    parser.add_argument("--universe", choices=("qqq", "iwm"), default=UNIVERSE)
    parser.add_argument("--iwm-top-count", type=int, default=200)
    parser.add_argument("--theme", choices=("none", "ai_static"), default="none")
    parser.add_argument("--theme-tickers-file")
    parser.add_argument("--stop-grid", choices=("standard", "extended", "oneil"), default="standard")
    parser.add_argument("--top-values", type=parse_csv_ints, default=(5, 10))
    parser.add_argument("--frequencies", type=parse_csv_strings, default=("monthly", "weekly"))
    parser.add_argument("--min-price", type=float, default=1.0)
    parser.add_argument("--min-history-rows", type=int, default=260)
    parser.add_argument("--adjusted-prices", type=parse_bool, default=True)
    parser.add_argument("--output-prefix", default=OUTPUT_PREFIX)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    cfg = TightConfig(
        start_year=args.start_year,
        end_date=args.end_date,
        universe=args.universe,
        iwm_top_count=max(1, int(args.iwm_top_count)),
        theme=args.theme,
        theme_tickers_file=args.theme_tickers_file,
        stop_grid=args.stop_grid,
        top_values=args.top_values,
        frequencies=args.frequencies,
        min_price=args.min_price,
        min_history_rows=args.min_history_rows,
        adjusted_prices=args.adjusted_prices,
        output_prefix=args.output_prefix,
    )
    try:
        summary, yearly, monthly, periods, trades, snapshots, rebalances, coverage, focus_years, checks = run_backtest(cfg)
        outputs = write_outputs(summary, yearly, monthly, periods, trades, snapshots, rebalances, coverage, focus_years, checks, cfg)
    except Exception:
        # PowerShell can collapse Python stderr tracebacks to the first line.
        # Print to stdout so the command bridge captures the actionable error.
        print(traceback.format_exc())
        sys.exit(1)
    for name, path in outputs.items():
        print(f"{name}: {path}")
    print()
    print(summary.to_string(index=False))
    failures = checks[checks["status"].ne("pass")] if not checks.empty else checks
    print(f"\nInternal math checks: {len(checks)} run, {len(failures)} failures")


if __name__ == "__main__":
    main()
