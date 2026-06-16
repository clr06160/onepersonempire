from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import pandas as pd

from price_cache import load_cache_for_backtest, normalize_universe, universe_cache_dir


PROJECT_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = PROJECT_ROOT / "reports"

DEFAULT_UNIVERSES = {
    "qqq": {
        "cache": universe_cache_dir("qqq"),
        "benchmark": "QQQ",
    },
    "sp500": {
        "cache": universe_cache_dir("sp500"),
        "benchmark": "SPY",
    },
    "iwm": {
        "cache": universe_cache_dir("iwm"),
        "benchmark": "IWM",
    },
}

DEFAULT_EXCLUDES = {
    "SPY",
    "QQQ",
    "IWM",
    "DIA",
    "TQQQ",
    "SQQQ",
    "SOXL",
    "SOXS",
    "UPRO",
    "SPXU",
}


@dataclass
class StrategyConfig:
    universe: str
    cache_file: Path
    benchmark: str
    rebalance: str
    top: int
    min_price: float
    max_mom5: float
    max_mom20: float
    min_dollar_volume: float
    start: str | None
    end: str | None
    include_etfs: bool
    progress: bool
    top1_weight: float | None = None


def load_cache(path: Path) -> dict[str, pd.DataFrame]:
    raw = load_cache_for_backtest(path)
    if not raw:
        raise FileNotFoundError(f"Cache not found or empty: {path}")

    cache: dict[str, pd.DataFrame] = {}
    for ticker, value in raw.items():
        symbol = str(ticker).upper().strip()
        if isinstance(value, pd.DataFrame):
            df = value.copy()
        elif isinstance(value, pd.Series):
            df = value.to_frame(name="adj_close")
        else:
            continue

        if df.empty:
            continue

        df.index = pd.to_datetime(df.index)
        df = df.sort_index()
        cache[symbol] = df

    return cache


def close_series(df: pd.DataFrame) -> pd.Series:
    for col in ("adjClose", "adj_close", "close", "Close"):
        if col in df.columns:
            return pd.to_numeric(df[col], errors="coerce").dropna()

    if len(df.columns) == 1:
        return pd.to_numeric(df.iloc[:, 0], errors="coerce").dropna()

    raise ValueError("No close column found")


def volume_series(df: pd.DataFrame) -> pd.Series | None:
    for col in ("volume", "Volume"):
        if col in df.columns:
            return pd.to_numeric(df[col], errors="coerce").dropna()
    return None


def build_price_frame(cache: dict[str, pd.DataFrame]) -> pd.DataFrame:
    closes = {}
    for ticker, df in cache.items():
        try:
            closes[ticker] = close_series(df)
        except ValueError:
            continue

    prices = pd.DataFrame(closes).sort_index()
    return prices.dropna(how="all")


def build_volume_frame(cache: dict[str, pd.DataFrame]) -> pd.DataFrame:
    volumes = {}
    for ticker, df in cache.items():
        series = volume_series(df)
        if series is not None:
            volumes[ticker] = series

    if not volumes:
        return pd.DataFrame()
    return pd.DataFrame(volumes).sort_index()


def apply_date_window(df: pd.DataFrame, start: str | None, end: str | None) -> pd.DataFrame:
    out = df
    if start:
        out = out.loc[pd.to_datetime(start) :]
    if end:
        out = out.loc[: pd.to_datetime(end)]
    return out


def rebalance_dates(prices: pd.DataFrame, frequency: str) -> list[pd.Timestamp]:
    available = prices.dropna(how="all").index
    if frequency == "weekly":
        grouped = pd.Series(available, index=available).groupby(available.to_period("W-FRI")).last()
    elif frequency == "monthly":
        grouped = pd.Series(available, index=available).groupby(available.to_period("M")).last()
    else:
        raise ValueError(f"Unsupported rebalance frequency: {frequency}")

    dates = [pd.Timestamp(d) for d in grouped.dropna().tolist()]
    return dates


def select_candidates(
    prices: pd.DataFrame,
    volumes: pd.DataFrame,
    as_of: pd.Timestamp,
    cfg: StrategyConfig,
) -> pd.DataFrame:
    history = prices.loc[:as_of].tail(60)
    if len(history) < 55:
        return pd.DataFrame()

    latest = history.iloc[-1]
    sma4 = history.rolling(4).mean().iloc[-1]
    sma20 = history.rolling(20).mean().iloc[-1]
    sma50 = history.rolling(50).mean().iloc[-1]
    mom5 = history.pct_change(5, fill_method=None).iloc[-1] * 100
    mom20 = history.pct_change(20, fill_method=None).iloc[-1] * 100

    dollar_volume = pd.Series(index=latest.index, dtype="float64")
    if not volumes.empty:
        vol_history = volumes.reindex(history.index).tail(20)
        avg_volume = vol_history.mean()
        dollar_volume = latest * avg_volume

    rows = []
    for ticker in latest.index:
        if not cfg.include_etfs and ticker in DEFAULT_EXCLUDES:
            continue

        close = latest.get(ticker)
        if pd.isna(close) or close < cfg.min_price:
            continue

        m5 = mom5.get(ticker)
        m20 = mom20.get(ticker)
        if pd.isna(m5) or pd.isna(m20):
            continue
        if abs(m5) > cfg.max_mom5 or abs(m20) > cfg.max_mom20:
            continue

        if not (close > sma4.get(ticker) and close > sma20.get(ticker) and close > sma50.get(ticker)):
            continue

        dv = dollar_volume.get(ticker)
        if cfg.min_dollar_volume > 0 and (pd.isna(dv) or dv < cfg.min_dollar_volume):
            continue

        rows.append(
            {
                "Ticker": ticker,
                "Close": float(close),
                "Mom_5D_%": float(m5),
                "Mom_20D_%": float(m20),
                "Dollar_Volume_20D": float(dv) if pd.notna(dv) else None,
            }
        )

    selected = pd.DataFrame(rows)
    if selected.empty:
        return selected
    return selected.sort_values(["Mom_5D_%", "Mom_20D_%"], ascending=False).head(cfg.top)


def weighting_label(cfg: StrategyConfig) -> str:
    if cfg.top1_weight is None:
        return "equal"
    return f"top1w{int(round(cfg.top1_weight * 100))}"


def strategy_id(cfg: StrategyConfig) -> str:
    base = f"holyroller_{cfg.universe}_{cfg.rebalance}_top{cfg.top}"
    if cfg.top1_weight is None:
        return base
    return f"{base}_{weighting_label(cfg)}"


def portfolio_weights(position_count: int, cfg: StrategyConfig) -> list[float]:
    if position_count <= 0:
        return []
    if cfg.top1_weight is None or position_count == 1:
        return [1.0 / position_count] * position_count

    if not 0 <= cfg.top1_weight <= 1:
        raise ValueError(f"top1_weight must be between 0 and 1, got {cfg.top1_weight}")

    remaining_count = position_count - 1
    remaining_weight = (1.0 - cfg.top1_weight) / remaining_count
    return [cfg.top1_weight] + [remaining_weight] * remaining_count


def max_drawdown_pct(equity: pd.Series) -> float:
    if equity.empty:
        return 0.0
    equity_with_start = pd.concat(
        [pd.Series([1.0]), equity.reset_index(drop=True)],
        ignore_index=True,
    )
    drawdown = equity_with_start / equity_with_start.cummax() - 1
    return float(drawdown.min() * 100)


def simple_regime(prices: pd.DataFrame, benchmark: str, as_of: pd.Timestamp) -> str:
    if benchmark not in prices.columns:
        return "unknown"

    series = prices[benchmark].loc[:as_of].dropna().tail(220)
    if len(series) < 200:
        return "unknown"

    close = series.iloc[-1]
    sma50 = series.rolling(50).mean().iloc[-1]
    sma200 = series.rolling(200).mean().iloc[-1]

    if close > sma50 > sma200:
        return "risk_on_growth"
    if close > sma200:
        return "selective_growth"
    if close > sma50:
        return "choppy"
    return "risk_off"


def run_backtest(cfg: StrategyConfig) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    cache = load_cache(cfg.cache_file)
    prices = build_price_frame(cache)
    volumes = build_volume_frame(cache)
    prices = apply_date_window(prices, cfg.start, cfg.end)
    volumes = apply_date_window(volumes, cfg.start, cfg.end) if not volumes.empty else volumes

    dates = rebalance_dates(prices, cfg.rebalance)
    records = []
    holdings_records = []
    equity = 1.0
    benchmark_equity = 1.0

    total_periods = max(len(dates) - 1, 0)
    for period_num, (current_date, next_date) in enumerate(zip(dates, dates[1:]), start=1):
        if cfg.progress and (period_num == 1 or period_num % 25 == 0 or period_num == total_periods):
            print(f"Processing {period_num}/{total_periods}: {current_date.date()} -> {next_date.date()}", flush=True)

        selected = select_candidates(prices, volumes, current_date, cfg)

        tradable_positions = []
        for rank, (_, row) in enumerate(selected.iterrows(), start=1):
            ticker = row["Ticker"]
            start_price = prices.at[current_date, ticker] if ticker in prices.columns else None
            end_price = prices.at[next_date, ticker] if ticker in prices.columns else None
            if pd.isna(start_price) or pd.isna(end_price) or start_price <= 0:
                continue

            ret = float(end_price / start_price - 1)
            tradable_positions.append((rank, row, ret))

        period_returns = []
        position_weights = portfolio_weights(len(tradable_positions), cfg)
        for (rank, row, ret), weight in zip(tradable_positions, position_weights):
            period_returns.append((ret, weight))
            holdings_records.append(
                {
                    "rebalance_date": current_date.date().isoformat(),
                    "exit_date": next_date.date().isoformat(),
                    "ticker": row["Ticker"],
                    "rank": rank,
                    "weight": weight,
                    "return_pct": ret * 100,
                    "weighted_return": ret * weight,
                    "rank_mom5_pct": row["Mom_5D_%"],
                    "rank_mom20_pct": row["Mom_20D_%"],
                }
            )
        strategy_return = sum(ret * weight for ret, weight in period_returns) if period_returns else 0.0

        benchmark_return = 0.0
        if cfg.benchmark in prices.columns:
            bench_start = prices.at[current_date, cfg.benchmark]
            bench_end = prices.at[next_date, cfg.benchmark]
            if pd.notna(bench_start) and pd.notna(bench_end) and bench_start > 0:
                benchmark_return = float(bench_end / bench_start - 1)

        equity *= 1 + strategy_return
        benchmark_equity *= 1 + benchmark_return

        records.append(
            {
                "date": next_date,
                "year": next_date.year,
                "strategy_return": strategy_return,
                "benchmark_return": benchmark_return,
                "equity": equity,
                "benchmark_equity": benchmark_equity,
                "invested": bool(period_returns),
                "positions": len(period_returns),
                "gross_exposure": sum(weight for _, weight in period_returns),
                "weighting_scheme": weighting_label(cfg),
                "regime": simple_regime(prices, cfg.benchmark, current_date),
            }
        )

    periods = pd.DataFrame(records)
    trades = pd.DataFrame(holdings_records)
    yearly = summarize_yearly(periods, trades, cfg)
    return yearly, periods, trades


def summarize_yearly(periods: pd.DataFrame, trades: pd.DataFrame, cfg: StrategyConfig) -> pd.DataFrame:
    if periods.empty:
        return pd.DataFrame()

    rows = []
    for year, group in periods.groupby("year"):
        strategy_return = (1 + group["strategy_return"]).prod() - 1
        benchmark_return = (1 + group["benchmark_return"]).prod() - 1
        exposure = group["invested"].mean() * 100
        equity = (1 + group["strategy_return"]).cumprod()
        bench_equity = (1 + group["benchmark_return"]).cumprod()
        year_trades = trades[pd.to_datetime(trades["exit_date"]).dt.year == year] if not trades.empty else pd.DataFrame()

        regime_counts = group["regime"].value_counts(normalize=True)
        dominant_regime = regime_counts.index[0] if not regime_counts.empty else "unknown"

        rows.append(
            {
                "year": int(year),
                "strategy_id": strategy_id(cfg),
                "strategy_family": "growth_momentum",
                "universe": cfg.universe,
                "rebalance_frequency": cfg.rebalance,
                "position_count": cfg.top,
                "weighting_scheme": weighting_label(cfg),
                "top1_weight": cfg.top1_weight if cfg.top1_weight is not None else None,
                "annual_return_pct": round(strategy_return * 100, 2),
                "benchmark": cfg.benchmark,
                "benchmark_return_pct": round(benchmark_return * 100, 2),
                "excess_return_pct": round((strategy_return - benchmark_return) * 100, 2),
                "max_drawdown_pct": round(max_drawdown_pct(equity), 2),
                "benchmark_max_drawdown_pct": round(max_drawdown_pct(bench_equity), 2),
                "exposure_pct": round(exposure, 2),
                "periods": int(len(group)),
                "trades": int(len(year_trades)),
                "dominant_market_state": dominant_regime,
                "cash_allowed": True,
                "stop_type": "none",
                "uses_relative_strength": True,
                "uses_regime_filter": False,
                "uses_rule40": False,
                "uses_net_income_growth": False,
                "uses_gap_up": False,
            }
        )

    yearly = pd.DataFrame(rows)
    return yearly.sort_values("year")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a year-by-year strategy scoreboard.")
    parser.add_argument("--universe", default="iwm", help="Universe alias: qqq/nasdaq100, sp500/spy, iwm/russell.")
    parser.add_argument("--cache-file", type=Path, help="Optional pickle cache override.")
    parser.add_argument("--benchmark", help="Benchmark ticker override.")
    parser.add_argument("--rebalance", choices=["weekly", "monthly"], default="monthly")
    parser.add_argument("--top", type=int, default=10)
    parser.add_argument("--min-price", type=float, default=5.0)
    parser.add_argument("--max-mom5", type=float, default=80.0)
    parser.add_argument("--max-mom20", type=float, default=250.0)
    parser.add_argument("--min-dollar-volume", type=float, default=0.0)
    parser.add_argument("--start", help="Start date, e.g. 2010-01-01")
    parser.add_argument("--end", help="End date, e.g. 2026-06-09")
    parser.add_argument("--include-etfs", action="store_true")
    parser.add_argument(
        "--top1-weight",
        type=float,
        help="Optional weight for the top-ranked name; the remainder is spread across the other selected names.",
    )
    parser.add_argument("--progress", action="store_true", help="Print progress during long backtests.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    universe = normalize_universe(args.universe)
    defaults = DEFAULT_UNIVERSES[universe]
    cfg = StrategyConfig(
        universe=universe,
        cache_file=args.cache_file or defaults["cache"],
        benchmark=args.benchmark or defaults["benchmark"],
        rebalance=args.rebalance,
        top=args.top,
        min_price=args.min_price,
        max_mom5=args.max_mom5,
        max_mom20=args.max_mom20,
        min_dollar_volume=args.min_dollar_volume,
        start=args.start,
        end=args.end,
        include_etfs=args.include_etfs,
        progress=args.progress,
        top1_weight=args.top1_weight,
    )

    yearly, periods, trades = run_backtest(cfg)
    REPORTS_DIR.mkdir(exist_ok=True)

    stamp = date.today().isoformat()
    base = f"scoreboard_{cfg.universe}_{cfg.rebalance}_top{cfg.top}_{weighting_label(cfg)}_{stamp}"
    yearly_file = REPORTS_DIR / f"{base}_yearly.csv"
    periods_file = REPORTS_DIR / f"{base}_periods.csv"
    trades_file = REPORTS_DIR / f"{base}_trades.csv"

    yearly.to_csv(yearly_file, index=False)
    periods.to_csv(periods_file, index=False)
    trades.to_csv(trades_file, index=False)

    print(f"Yearly scoreboard written to {yearly_file}")
    print(f"Period returns written to {periods_file}")
    print(f"Trade details written to {trades_file}")
    if not yearly.empty:
        print()
        print(yearly.to_string(index=False))


if __name__ == "__main__":
    main()
