from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from nasdaq100_second_derivative_scanner import (
    BENCHMARK,
    FEATURE_DEFINITION,
    SCORE_DEFINITION,
    ScannerConfig,
    build_schedules,
    completed_feature_frame,
    rank_acceleration_candidates,
)
from quality_regime_router_runner import (
    PROJECT_ROOT,
    REPORTS_DIR,
    UNIVERSES,
    cache_price_file_index,
    load_price_series,
    load_tickers,
    max_drawdown_pct,
    safe_symbol,
)


UNIVERSE = "qqq"
BREAKOUT_RISK_PER_TRADE = 0.01
INITIAL_ATR_MULTIPLIER = 2.0
CHANDELIER_ATR_MULTIPLIER = 3.0
DEFAULT_INITIAL_CAPITAL = 10_000.0
BASELINE_RESULTS = {
    "nasdaq100_accel_top5_monthly": {"cagr_pct": 37.34, "total_return_pct": 18253.0, "max_drawdown_pct": -50.29},
    "nasdaq100_accel_top10_monthly": {"cagr_pct": 31.24, "total_return_pct": np.nan, "max_drawdown_pct": -48.23},
}


@dataclass(frozen=True)
class RunConfig:
    start_year: int = 2010
    end_date: str | None = None
    top_values: tuple[int, ...] = (5, 10)
    initial_capital: float = DEFAULT_INITIAL_CAPITAL
    min_price: float = 1.0
    min_history_rows: int = 150
    adjusted_prices: bool = True
    output_prefix: str = f"nasdaq100_accel_momentum_risk_{date.today().isoformat()}"


@dataclass
class Position:
    ticker: str
    weight: float
    entry_date: pd.Timestamp
    entry_price: float
    entry_atr14: float
    initial_stop: float
    max_high: float
    rank: int
    accel_score: float


def parse_csv_ints(value: str) -> tuple[int, ...]:
    parsed = tuple(int(part.strip()) for part in value.split(",") if part.strip())
    if not parsed or any(item <= 0 for item in parsed):
        raise argparse.ArgumentTypeError("Provide positive comma-separated integers.")
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
    return float((1 + total_return) ** (1 / years) - 1)


def normalize_ohlcv_frame(path: Path, adjusted_prices: bool) -> pd.DataFrame:
    raw = pd.read_csv(path)
    if "date" not in raw.columns:
        return pd.DataFrame()
    required = {"open", "high", "low", "close", "volume"}
    price_column = "adjClose" if adjusted_prices and "adjClose" in raw.columns else "close"
    if price_column not in raw.columns or not required.issubset(raw.columns):
        return pd.DataFrame()

    frame = raw.copy()
    frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    for column in [*required, price_column]:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame = frame.dropna(subset=["date", *required, price_column])
    frame = frame.drop_duplicates("date", keep="last").sort_values("date").set_index("date")
    frame.index = pd.to_datetime(frame.index).tz_localize(None).normalize()

    out = pd.DataFrame(index=frame.index)
    out["volume"] = frame["volume"]
    out["return_close"] = frame[price_column]
    if adjusted_prices and price_column == "adjClose":
        factor = (frame["adjClose"] / frame["close"]).replace([np.inf, -np.inf], np.nan)
        out["open"] = frame["open"] * factor
        out["high"] = frame["high"] * factor
        out["low"] = frame["low"] * factor
        out["close"] = frame["close"] * factor
        out["ohlc_adjustment"] = "adjClose/close_factor"
    else:
        out["open"] = frame["open"]
        out["high"] = frame["high"]
        out["low"] = frame["low"]
        out["close"] = frame["close"]
        out["ohlc_adjustment"] = "raw_ohlc"
    return out.dropna(subset=["open", "high", "low", "close", "return_close"]).sort_index()


def load_price_frame(ticker: str, adjusted_prices: bool) -> tuple[pd.DataFrame, str]:
    candidates: list[tuple[pd.DataFrame, Path]] = []
    for path in cache_price_file_index().get(safe_symbol(ticker), []):
        try:
            frame = normalize_ohlcv_frame(path, adjusted_prices)
        except Exception:
            continue
        if not frame.empty:
            candidates.append((frame, path))
    if not candidates:
        return pd.DataFrame(), ""
    frame, path = max(candidates, key=lambda item: (len(item[0]), pd.Timestamp(item[0].index.max())))
    return frame, str(path.relative_to(PROJECT_ROOT))


def add_indicators(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    previous_close = out["close"].shift(1)
    true_range = pd.concat(
        [
            out["high"] - out["low"],
            (out["high"] - previous_close).abs(),
            (out["low"] - previous_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    out["sma50"] = out["close"].rolling(50).mean()
    out["atr14"] = true_range.rolling(14).mean()
    out["atr22"] = true_range.rolling(22).mean()
    return out


def row_as_of(frame: pd.DataFrame, current_date: pd.Timestamp) -> pd.Series | None:
    history = frame.loc[:current_date]
    if history.empty:
        return None
    row = history.iloc[-1]
    if pd.isna(row.get("close")) or pd.isna(row.get("atr14")) or pd.isna(row.get("atr22")):
        return None
    return row


def aligned_returns(frames: dict[str, pd.DataFrame], trading_dates: pd.DatetimeIndex) -> pd.DataFrame:
    columns = {}
    for ticker, frame in frames.items():
        aligned = pd.to_numeric(frame["return_close"], errors="coerce").reindex(trading_dates).ffill()
        columns[ticker] = aligned.pct_change(fill_method=None).fillna(0.0)
    return pd.DataFrame(columns, index=trading_dates).fillna(0.0)


def variant_name(top: int, sizing: str, sma50_exit: bool) -> str:
    suffix = "sma50_exit" if sma50_exit else "active_exits"
    sizing_label = "risk1pct" if sizing == "risk" else "equal_weight"
    return f"nasdaq100_accel_top{top}_monthly_{sizing_label}_{suffix}"


def close_trade(
    position: Position,
    exit_date: pd.Timestamp,
    exit_price: float,
    exit_reason: str,
    trades: list[dict[str, Any]],
) -> None:
    trade_return = exit_price / position.entry_price - 1
    trades.append(
        {
            "variant": "",
            "ticker": position.ticker,
            "event": "closed_trade",
            "entry_date": position.entry_date.date().isoformat(),
            "exit_date": exit_date.date().isoformat(),
            "entry_price": round(position.entry_price, 6),
            "exit_price": round(exit_price, 6),
            "entry_weight": round(position.weight, 6),
            "exit_reason": exit_reason,
            "holding_days": int((exit_date - position.entry_date).days),
            "trade_return_pct": round(trade_return * 100, 2),
            "weighted_return": round(position.weight * trade_return, 6),
            "initial_stop": round(position.initial_stop, 6),
            "entry_atr14": round(position.entry_atr14, 6),
            "max_high_since_entry": round(position.max_high, 6),
            "rank": position.rank,
            "accel_score": position.accel_score,
        }
    )


def build_target_positions(
    current_date: pd.Timestamp,
    selected: pd.DataFrame,
    frames: dict[str, pd.DataFrame],
    sizing: str,
) -> tuple[dict[str, Position], list[dict[str, Any]]]:
    positions: dict[str, Position] = {}
    skipped: list[dict[str, Any]] = []
    if selected.empty:
        return positions, skipped

    selected_rows: list[tuple[int, pd.Series, pd.Series]] = []
    for rank, row in selected.reset_index(drop=True).iterrows():
        ticker = str(row["ticker"])
        signal = row_as_of(frames.get(ticker, pd.DataFrame()), current_date)
        if signal is None:
            skipped.append({"ticker": ticker, "reason": "missing_ohlc_or_atr"})
            continue
        selected_rows.append((rank + 1, row, signal))

    if not selected_rows:
        return positions, skipped

    if sizing == "equal":
        weight_by_ticker = {str(row["ticker"]): 1.0 / len(selected_rows) for _, row, _ in selected_rows}
    elif sizing == "risk":
        remaining_cash = 1.0
        weight_by_ticker = {}
        for _, row, signal in selected_rows:
            ticker = str(row["ticker"])
            close = float(signal["close"])
            stop_distance = float(signal["atr14"]) * INITIAL_ATR_MULTIPLIER
            stop_pct = stop_distance / close if close > 0 else np.nan
            if pd.isna(stop_pct) or stop_pct <= 0:
                skipped.append({"ticker": ticker, "reason": "invalid_stop_distance"})
                continue
            target_weight = min(remaining_cash, BREAKOUT_RISK_PER_TRADE / stop_pct)
            if target_weight <= 0:
                skipped.append({"ticker": ticker, "reason": "no_remaining_cash"})
                continue
            weight_by_ticker[ticker] = target_weight
            remaining_cash -= target_weight
            if remaining_cash <= 1e-9:
                break
    else:
        raise ValueError(f"Unsupported sizing: {sizing}")

    for rank, row, signal in selected_rows:
        ticker = str(row["ticker"])
        weight = float(weight_by_ticker.get(ticker, 0.0))
        if weight <= 0:
            continue
        close = float(signal["close"])
        atr14 = float(signal["atr14"])
        positions[ticker] = Position(
            ticker=ticker,
            weight=weight,
            entry_date=current_date,
            entry_price=close,
            entry_atr14=atr14,
            initial_stop=close - atr14 * INITIAL_ATR_MULTIPLIER,
            max_high=float(signal["high"]),
            rank=rank,
            accel_score=float(row["accel_score"]),
        )
    return positions, skipped


def simulate_variant(
    top: int,
    schedule: list[pd.Timestamp],
    tickers: list[str],
    feature_frames: dict[str, pd.DataFrame],
    frames: dict[str, pd.DataFrame],
    returns: pd.DataFrame,
    benchmark_returns: pd.Series,
    scanner_cfg: ScannerConfig,
    sizing: str,
    sma50_exit: bool,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    variant = variant_name(top, sizing, sma50_exit)
    baseline_key = f"nasdaq100_accel_top{top}_monthly"
    baseline = BASELINE_RESULTS.get(baseline_key, {})
    rebalance_dates = set(pd.Timestamp(item) for item in schedule[:-1])
    all_dates = [pd.Timestamp(item) for item in returns.index if schedule and schedule[0] <= item <= schedule[-1]]
    positions: dict[str, Position] = {}
    periods: list[dict[str, Any]] = []
    trades: list[dict[str, Any]] = []
    snapshots: list[dict[str, Any]] = []
    last_rebalance: pd.Timestamp | None = None
    last_candidates = 0
    last_positive = 0
    last_exit_reasons = ""

    for current_date in all_dates:
        day_returns = returns.loc[current_date]
        strategy_return = float(sum(float(day_returns.get(ticker, 0.0)) * pos.weight for ticker, pos in positions.items()))
        gross_exposure = float(sum(pos.weight for pos in positions.values()))

        periods.append(
            {
                "date": current_date.date().isoformat(),
                "year": int(current_date.year),
                "variant": variant,
                "timing": "monthly",
                "top": top,
                "sizing": "momentumbreakout_1pct_risk" if sizing == "risk" else "equal_weight",
                "sma50_exit": sma50_exit,
                "strategy_return": strategy_return,
                "benchmark_return": float(benchmark_returns.loc[current_date]) if current_date in benchmark_returns.index else 0.0,
                "invested": bool(positions),
                "positions": int(len(positions)),
                "gross_exposure": gross_exposure,
                "cash_weight": max(0.0, 1.0 - gross_exposure),
                "rebalance_date": last_rebalance.date().isoformat() if last_rebalance is not None else None,
                "clean_tradable_candidates": last_candidates,
                "positive_accel_candidates": last_positive,
                "exit_reasons_after_prior_close": last_exit_reasons,
                "rank_metric": SCORE_DEFINITION,
                "feature_definition": FEATURE_DEFINITION,
                "risk_rule_source": "momentumbreakout.py active 2x ATR14 initial stop plus 3x ATR22 chandelier",
                "baseline_variant": baseline_key,
                "prior_baseline_cagr_pct": baseline.get("cagr_pct", np.nan),
                "prior_baseline_max_drawdown_pct": baseline.get("max_drawdown_pct", np.nan),
                "margin_allowed": False,
                "short_allowed": False,
                "leveraged_etfs_allowed": False,
            }
        )

        exit_reasons: list[str] = []
        for ticker, position in list(positions.items()):
            signal = row_as_of(frames.get(ticker, pd.DataFrame()), current_date)
            if signal is None:
                continue
            close = float(signal["close"])
            position.max_high = max(position.max_high, float(signal["high"]))
            chandelier_stop = position.max_high - float(signal["atr22"]) * CHANDELIER_ATR_MULTIPLIER
            hit_initial = close < position.initial_stop
            hit_chandelier = close < chandelier_stop
            hit_sma50 = sma50_exit and not pd.isna(signal.get("sma50")) and close < float(signal["sma50"])
            reason_parts = []
            if hit_initial:
                reason_parts.append("initial_stop")
            if hit_chandelier:
                reason_parts.append("chandelier_stop")
            if hit_sma50:
                reason_parts.append("sma50_exit")
            if reason_parts:
                reason = "_and_".join(reason_parts)
                close_trade(position, current_date, close, reason, trades)
                positions.pop(ticker, None)
                exit_reasons.append(f"{ticker}:{reason}")

        if current_date in rebalance_dates:
            ranked = rank_acceleration_candidates(current_date, tickers, feature_frames, scanner_cfg)
            eligible = ranked[ranked["positive_accel_filter"].astype(bool)].copy() if not ranked.empty else pd.DataFrame()
            selected = eligible.head(top).copy()
            selected_tickers = set(selected["ticker"].astype(str).tolist()) if not selected.empty else set()

            for ticker, position in list(positions.items()):
                signal = row_as_of(frames.get(ticker, pd.DataFrame()), current_date)
                exit_price = float(signal["close"]) if signal is not None else position.entry_price
                exit_reason = "monthly_rebalance_refresh" if ticker in selected_tickers else "monthly_rebalance_deselected"
                close_trade(position, current_date, exit_price, exit_reason, trades)
            positions, skipped = build_target_positions(current_date, selected, frames, sizing)
            for trade in trades:
                if trade["variant"] == "":
                    trade["variant"] = variant
                    trade["timing"] = "monthly"
                    trade["top"] = top
                    trade["sizing"] = "momentumbreakout_1pct_risk" if sizing == "risk" else "equal_weight"
                    trade["sma50_exit"] = sma50_exit

            last_rebalance = current_date
            last_candidates = int(len(ranked))
            last_positive = int(len(eligible))
            last_exit_reasons = ";".join(exit_reasons + [f"{item['ticker']}:{item['reason']}" for item in skipped])

            for _, row in ranked.iterrows():
                snapshots.append(
                    {
                        "rebalance_date": current_date.date().isoformat(),
                        "variant": variant,
                        "timing": "monthly",
                        "top": top,
                        "ticker": row["ticker"],
                        "selected": str(row["ticker"]) in selected_tickers,
                        "accel_rank": int(row["accel_rank"]),
                        "accel_score": row["accel_score"],
                        "roc_20": row["roc_20"],
                        "acceleration_20": row["acceleration_20"],
                        "acceleration_10": row["acceleration_10"],
                        "positive_accel_filter": bool(row["positive_accel_filter"]),
                        "feature_date": row["feature_date"],
                    }
                )

            for ticker, position in positions.items():
                trades.append(
                    {
                        "variant": variant,
                        "timing": "monthly",
                        "top": top,
                        "sizing": "momentumbreakout_1pct_risk" if sizing == "risk" else "equal_weight",
                        "sma50_exit": sma50_exit,
                        "ticker": ticker,
                        "event": "entry",
                        "entry_date": current_date.date().isoformat(),
                        "exit_date": "",
                        "entry_price": round(position.entry_price, 6),
                        "exit_price": np.nan,
                        "entry_weight": round(position.weight, 6),
                        "exit_reason": "",
                        "holding_days": 0,
                        "trade_return_pct": np.nan,
                        "weighted_return": np.nan,
                        "initial_stop": round(position.initial_stop, 6),
                        "entry_atr14": round(position.entry_atr14, 6),
                        "max_high_since_entry": round(position.max_high, 6),
                        "rank": position.rank,
                        "accel_score": position.accel_score,
                    }
                )
        else:
            last_exit_reasons = ";".join(exit_reasons)

    if all_dates:
        final_date = all_dates[-1]
        for ticker, position in positions.items():
            signal = row_as_of(frames.get(ticker, pd.DataFrame()), final_date)
            exit_price = float(signal["close"]) if signal is not None else position.entry_price
            close_trade(position, final_date, exit_price, "open_at_end", trades)
        for trade in trades:
            if trade["variant"] == "":
                trade["variant"] = variant
                trade["timing"] = "monthly"
                trade["top"] = top
                trade["sizing"] = "momentumbreakout_1pct_risk" if sizing == "risk" else "equal_weight"
                trade["sma50_exit"] = sma50_exit

    return periods, trades, snapshots


def add_equity_drawdown(periods: pd.DataFrame) -> pd.DataFrame:
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
    rows = []
    for (variant, year), group in periods.groupby(["variant", "year"], sort=True):
        returns = pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)
        benchmark = pd.to_numeric(group["benchmark_return"], errors="coerce").fillna(0.0)
        rows.append(
            {
                "variant": variant,
                "timing": group["timing"].iloc[0],
                "top": int(group["top"].iloc[0]),
                "year": int(year),
                "periods": int(len(group)),
                "annual_return_pct": round(((1 + returns).prod() - 1) * 100, 2),
                "benchmark_return_pct": round(((1 + benchmark).prod() - 1) * 100, 2),
                "max_drawdown_pct": round(max_drawdown_pct((1 + returns).cumprod()), 2),
                "exposure_pct": round(float(pd.to_numeric(group["gross_exposure"], errors="coerce").mean() * 100), 2),
                "avg_positions": round(float(pd.to_numeric(group["positions"], errors="coerce").mean()), 2),
            }
        )
    return pd.DataFrame(rows).sort_values(["variant", "year"])


def build_monthly(periods: pd.DataFrame) -> pd.DataFrame:
    rows = []
    work = periods.copy()
    work["month"] = pd.to_datetime(work["date"]).dt.to_period("M").astype(str)
    for (variant, month), group in work.groupby(["variant", "month"], sort=True):
        returns = pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)
        benchmark = pd.to_numeric(group["benchmark_return"], errors="coerce").fillna(0.0)
        rows.append(
            {
                "variant": variant,
                "timing": group["timing"].iloc[0],
                "top": int(group["top"].iloc[0]),
                "month": month,
                "strategy_return_pct": round(((1 + returns).prod() - 1) * 100, 2),
                "benchmark_return_pct": round(((1 + benchmark).prod() - 1) * 100, 2),
                "exposure_pct": round(float(pd.to_numeric(group["gross_exposure"], errors="coerce").mean() * 100), 2),
                "avg_positions": round(float(pd.to_numeric(group["positions"], errors="coerce").mean()), 2),
                "days": int(len(group)),
            }
        )
    return pd.DataFrame(rows).sort_values(["variant", "month"])


def build_summary(periods: pd.DataFrame, monthly: pd.DataFrame, trades: pd.DataFrame, cfg: RunConfig) -> pd.DataFrame:
    rows = []
    for variant, group in periods.groupby("variant", sort=True):
        group = group.sort_values("date")
        returns = pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)
        total_return = float((1 + returns).prod() - 1)
        variant_months = monthly[monthly["variant"].astype(str).eq(str(variant))]
        variant_trades = trades[trades["variant"].astype(str).eq(str(variant))] if not trades.empty else pd.DataFrame()
        closed = variant_trades[variant_trades["event"].astype(str).eq("closed_trade")] if not variant_trades.empty else pd.DataFrame()
        top = int(group["top"].iloc[0])
        baseline = BASELINE_RESULTS.get(f"nasdaq100_accel_top{top}_monthly", {})
        annualized = cagr(total_return, group["date"].iloc[0], group["date"].iloc[-1]) * 100
        max_dd = float(group["drawdown_pct"].min())
        rows.append(
            {
                "variant": variant,
                "timing": group["timing"].iloc[0],
                "top": top,
                "sizing": group["sizing"].iloc[0],
                "sma50_exit": bool(group["sma50_exit"].iloc[0]),
                "start_date": group["date"].iloc[0],
                "end_date": group["date"].iloc[-1],
                "final_equity": round(float((1 + returns).cumprod().iloc[-1]), 6),
                "total_return_pct": round(total_return * 100, 2),
                "cagr_pct": round(annualized, 2),
                "max_drawdown_pct": round(max_dd, 2),
                "worst_month_pct": round(float(pd.to_numeric(variant_months["strategy_return_pct"], errors="coerce").min()), 2),
                "exposure_pct": round(float(pd.to_numeric(group["gross_exposure"], errors="coerce").mean() * 100), 2),
                "avg_positions": round(float(pd.to_numeric(group["positions"], errors="coerce").mean()), 2),
                "entries": int(variant_trades["event"].astype(str).eq("entry").sum()) if not variant_trades.empty else 0,
                "closed_trades": int(len(closed)),
                "stop_exits": int(closed["exit_reason"].astype(str).str.contains("stop|sma50", regex=True).sum()) if not closed.empty else 0,
                "win_rate_pct": round(float(pd.to_numeric(closed["trade_return_pct"], errors="coerce").gt(0).mean() * 100), 2) if not closed.empty else 0.0,
                "prior_baseline_cagr_pct": baseline.get("cagr_pct", np.nan),
                "prior_baseline_total_return_pct": baseline.get("total_return_pct", np.nan),
                "prior_baseline_max_drawdown_pct": baseline.get("max_drawdown_pct", np.nan),
                "cagr_sacrifice_pct": round(float(baseline.get("cagr_pct", np.nan)) - annualized, 2) if baseline else np.nan,
                "drawdown_improvement_pct": round(max_dd - float(baseline.get("max_drawdown_pct", np.nan)), 2) if baseline else np.nan,
                "initial_capital": cfg.initial_capital,
                "margin_allowed": False,
                "short_allowed": False,
                "leveraged_etfs_allowed": False,
            }
        )
    return pd.DataFrame(rows).sort_values(["top", "sma50_exit", "sizing"])


def build_math_checks(periods: pd.DataFrame, yearly: pd.DataFrame, monthly: pd.DataFrame, summary: pd.DataFrame) -> pd.DataFrame:
    checks = []

    def add(name: str, expected: float | str, actual: float | str, detail: str, tolerance: float = 0.05) -> None:
        if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
            status = "pass" if abs(float(expected) - float(actual)) <= tolerance else "fail"
            difference: float | str = round(float(actual) - float(expected), 6)
        else:
            status = "pass" if expected == actual else "fail"
            difference = ""
        checks.append({"check": name, "status": status, "expected": expected, "actual": actual, "difference": difference, "detail": detail})

    for _, row in summary.iterrows():
        group = periods[periods["variant"].astype(str).eq(str(row["variant"]))]
        expected_total = round(((1 + pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)).prod() - 1) * 100, 2)
        add(f"{row['variant']}_total_return_pct", expected_total, float(row["total_return_pct"]), "Recomputed from daily periods.")
        add(f"{row['variant']}_max_drawdown_pct", round(float(group["drawdown_pct"].min()), 2), float(row["max_drawdown_pct"]), "Recomputed from daily equity.")

    for _, row in yearly.iterrows():
        group = periods[(periods["variant"].astype(str).eq(str(row["variant"]))) & (periods["year"].astype(int).eq(int(row["year"])))]
        expected = round(((1 + pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)).prod() - 1) * 100, 2)
        add(f"{row['variant']}_{row['year']}_annual_return_pct", expected, float(row["annual_return_pct"]), "Recomputed yearly return.")

    for _, row in monthly.iterrows():
        dates = pd.to_datetime(periods["date"])
        group = periods[(periods["variant"].astype(str).eq(str(row["variant"]))) & (dates.dt.to_period("M").astype(str).eq(str(row["month"])))]
        expected = round(((1 + pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)).prod() - 1) * 100, 2)
        add(f"{row['variant']}_{row['month']}_monthly_return_pct", expected, float(row["strategy_return_pct"]), "Recomputed monthly return.")

    no_margin = bool(pd.to_numeric(periods["gross_exposure"], errors="coerce").fillna(0.0).le(1.0000001).all())
    add("gross_exposure_never_above_one", "pass", "pass" if no_margin else "fail", "No leverage or margin.")
    first_return_zero = bool(periods.groupby("variant")["strategy_return"].first().fillna(0.0).eq(0.0).all())
    add("first_day_has_no_strategy_return", "pass", "pass" if first_return_zero else "fail", "No same-day initial signal return.")
    return pd.DataFrame(checks)


def build_coverage(tickers: list[str], frames: dict[str, pd.DataFrame], sources: dict[str, str], cfg: RunConfig) -> pd.DataFrame:
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


def write_markdown_report(outputs: dict[str, Path], summary: pd.DataFrame, checks: pd.DataFrame) -> None:
    failures = checks[checks["status"].ne("pass")] if not checks.empty else checks
    display = summary[
        [
            "variant",
            "cagr_pct",
            "total_return_pct",
            "max_drawdown_pct",
            "worst_month_pct",
            "exposure_pct",
            "entries",
            "closed_trades",
            "prior_baseline_cagr_pct",
            "prior_baseline_max_drawdown_pct",
            "cagr_sacrifice_pct",
            "drawdown_improvement_pct",
        ]
    ]
    lines = [
        "# Nasdaq-100 Acceleration Momentum Risk Backtest",
        "",
        f"Generated: {date.today().isoformat()}",
        "",
        "## Method",
        "",
        "- Uses the same Nasdaq-100 acceleration ranking as `nasdaq100_second_derivative_scanner.py`, focused on monthly top-5 and top-10 selections.",
        "- Active `momentumbreakout.py` risk rules applied close-to-close: 2x ATR14 initial stop from entry close and 3x ATR22 chandelier exit from highest adjusted high since entry.",
        "- Equal-weight variants keep the acceleration portfolio weights but move stopped names to cash until the next monthly rebalance.",
        "- Risk-sized variants use the original 1% account-risk sizing idea: target weight = 1% / initial stop distance percent, constrained by remaining cash and no margin.",
        "- SMA50 variants are diagnostic only because the moving-average exit is commented out in `momentumbreakout.py`; no 10/20 MA, profit target, or active market filter was found.",
        "- Signals and stops are close-based; same-day signals affect the next close-to-close return. No yfinance, margin, shorting, or leveraged ETFs.",
        "",
        "## Outputs",
        "",
    ]
    for name, path in outputs.items():
        if name != "report":
            lines.append(f"- {name}: `{path.relative_to(PROJECT_ROOT)}`")
    lines.extend(["", "## Summary", "", display.to_markdown(index=False), "", "## Math Checks", ""])
    lines.append("Internal math checks passed." if failures.empty else failures.to_markdown(index=False))
    lines.append("")
    outputs["report"].write_text("\n".join(lines), encoding="utf-8")


def run_backtest(cfg: RunConfig) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    tickers = load_tickers(UNIVERSES[UNIVERSE].constituents_file)
    all_symbols = sorted(set(tickers + [BENCHMARK]))
    frames: dict[str, pd.DataFrame] = {}
    sources: dict[str, str] = {}
    for ticker in all_symbols:
        frame, source = load_price_frame(ticker, cfg.adjusted_prices)
        if not frame.empty:
            frames[ticker] = add_indicators(frame)
            sources[ticker] = source

    benchmark = frames.get(BENCHMARK, pd.DataFrame())
    if benchmark.empty:
        raise RuntimeError("No local QQQ benchmark OHLCV prices found.")

    coverage = build_coverage(tickers, frames, sources, cfg)
    latest_cutoff = pd.Timestamp(cfg.end_date).normalize() - pd.Timedelta(days=7) if cfg.end_date else pd.Timestamp(benchmark.index.max()).normalize() - pd.Timedelta(days=7)
    eligible_tickers = coverage[
        coverage["has_ohlcv"].astype(bool)
        & coverage["has_min_history"].astype(bool)
        & (pd.to_datetime(coverage["last_date"], errors="coerce") >= latest_cutoff)
    ]["ticker"].astype(str).tolist()

    scanner_cfg = ScannerConfig(
        start_year=cfg.start_year,
        end_date=cfg.end_date,
        top_values=cfg.top_values,
        frequencies=("monthly",),
        min_price=cfg.min_price,
        min_history_rows=cfg.min_history_rows,
    )
    close_prices = {ticker: load_price_series(ticker) for ticker in sorted(set(eligible_tickers + [BENCHMARK]))}
    feature_frames = {
        ticker: completed_feature_frame(series)
        for ticker, series in close_prices.items()
        if ticker != BENCHMARK and len(series) >= cfg.min_history_rows
    }
    schedules = build_schedules(pd.to_numeric(benchmark["return_close"], errors="coerce").dropna(), scanner_cfg)
    schedule = schedules.get("monthly", [])
    if len(schedule) < 2:
        raise RuntimeError("Monthly schedule has fewer than two dates.")
    global_start, global_end = schedule[0], schedule[-1]
    trading_dates = pd.DatetimeIndex(benchmark.loc[(benchmark.index >= global_start) & (benchmark.index <= global_end)].index).sort_values().unique()
    returns = aligned_returns({ticker: frames[ticker] for ticker in eligible_tickers if ticker in frames}, trading_dates)
    benchmark_returns = benchmark["return_close"].reindex(trading_dates).ffill().pct_change(fill_method=None).fillna(0.0)

    period_rows: list[dict[str, Any]] = []
    trade_rows: list[dict[str, Any]] = []
    snapshot_rows: list[dict[str, Any]] = []
    for top in cfg.top_values:
        for sizing, sma50_exit in (("equal", False), ("risk", False), ("equal", True)):
            periods, trades, snapshots = simulate_variant(
                top=top,
                schedule=schedule,
                tickers=eligible_tickers,
                feature_frames=feature_frames,
                frames=frames,
                returns=returns,
                benchmark_returns=benchmark_returns,
                scanner_cfg=scanner_cfg,
                sizing=sizing,
                sma50_exit=sma50_exit,
            )
            period_rows.extend(periods)
            trade_rows.extend(trades)
            snapshot_rows.extend(snapshots)

    periods = add_equity_drawdown(pd.DataFrame(period_rows))
    trades = pd.DataFrame(trade_rows)
    snapshots = pd.DataFrame(snapshot_rows)
    yearly = build_yearly(periods)
    monthly = build_monthly(periods)
    summary = build_summary(periods, monthly, trades, cfg)
    checks = build_math_checks(periods, yearly, monthly, summary)
    return summary, yearly, monthly, periods, trades, snapshots, coverage, checks


def write_outputs(
    summary: pd.DataFrame,
    yearly: pd.DataFrame,
    monthly: pd.DataFrame,
    periods: pd.DataFrame,
    trades: pd.DataFrame,
    snapshots: pd.DataFrame,
    coverage: pd.DataFrame,
    checks: pd.DataFrame,
    cfg: RunConfig,
) -> dict[str, Path]:
    REPORTS_DIR.mkdir(exist_ok=True)
    base = cfg.output_prefix
    outputs = {
        "summary": REPORTS_DIR / f"{base}_summary.csv",
        "yearly": REPORTS_DIR / f"{base}_yearly.csv",
        "monthly": REPORTS_DIR / f"{base}_monthly.csv",
        "periods": REPORTS_DIR / f"{base}_periods.csv",
        "trades": REPORTS_DIR / f"{base}_trades.csv",
        "scanner_snapshots": REPORTS_DIR / f"{base}_scanner_snapshots.csv",
        "coverage": REPORTS_DIR / f"{base}_coverage.csv",
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
    checks.to_csv(outputs["math_checks"], index=False)
    write_markdown_report(outputs, summary, checks)
    return outputs


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Nasdaq-100 acceleration selections with momentumbreakout.py risk overlays.")
    parser.add_argument("--start-year", type=int, default=2010)
    parser.add_argument("--end-date")
    parser.add_argument("--top-values", type=parse_csv_ints, default=(5, 10))
    parser.add_argument("--initial-capital", type=float, default=DEFAULT_INITIAL_CAPITAL)
    parser.add_argument("--min-price", type=float, default=1.0)
    parser.add_argument("--min-history-rows", type=int, default=150)
    parser.add_argument("--adjusted-prices", type=parse_bool, default=True)
    parser.add_argument("--output-prefix", default=f"nasdaq100_accel_momentum_risk_{date.today().isoformat()}")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    cfg = RunConfig(
        start_year=args.start_year,
        end_date=args.end_date,
        top_values=args.top_values,
        initial_capital=args.initial_capital,
        min_price=args.min_price,
        min_history_rows=args.min_history_rows,
        adjusted_prices=args.adjusted_prices,
        output_prefix=args.output_prefix,
    )
    summary, yearly, monthly, periods, trades, snapshots, coverage, checks = run_backtest(cfg)
    outputs = write_outputs(summary, yearly, monthly, periods, trades, snapshots, coverage, checks, cfg)
    for name, path in outputs.items():
        print(f"{name}: {path}")
    print()
    print(summary.to_string(index=False))
    failures = checks[checks["status"].ne("pass")] if not checks.empty else checks
    print(f"\nInternal math checks: {len(checks)} run, {len(failures)} failures")


if __name__ == "__main__":
    main()
