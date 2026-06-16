from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

import pandas as pd

from fundamentals_cache import ENDPOINT_CASH_FLOW, ENDPOINT_INCOME, endpoint_rows, load_symbol_payload
from scoreboard import REPORTS_DIR, max_drawdown_pct


PROJECT_ROOT = Path(__file__).resolve().parent
HOLY40_CACHE = PROJECT_ROOT / "data" / "cache" / "holy40_godmode108"
SOXLGOOD_PRICE_DIR = PROJECT_ROOT / "data" / "cache" / "soxlgood" / "prices"
CACHE_PRICE_UNIVERSES = ("qqq", "sp500", "iwm", "soxlgood")
PRICE_FILE_INDEX: dict[str, list[Path]] | None = None


@dataclass(frozen=True)
class UniverseSpec:
    slug: str
    label: str
    benchmark: str
    constituents_file: Path


UNIVERSES: dict[str, UniverseSpec] = {
    "iwm": UniverseSpec(
        slug="iwm",
        label="IWM",
        benchmark="IWM",
        constituents_file=PROJECT_ROOT / "russell_clean_2026-04-02.json",
    ),
    "qqq": UniverseSpec(
        slug="qqq",
        label="QQQ",
        benchmark="QQQ",
        constituents_file=PROJECT_ROOT / "nasdaq100_constituents_2026-06-08.json",
    ),
    "spy": UniverseSpec(
        slug="spy",
        label="SPY",
        benchmark="SPY",
        constituents_file=PROJECT_ROOT / "sp500_constituents_2026-06-08.json",
    ),
}


@dataclass(frozen=True)
class RouterConfig:
    start_year: int = 2010
    end_date: str | None = None
    top: int = 10
    rule40_min: float = 40.0
    min_price: float = 1.0
    lag_days_when_filing_missing: int = 90
    output_prefix: str = "quality_regime_router"


def safe_symbol(symbol: str) -> str:
    return symbol.upper().replace("/", "-").replace("\\", "-").replace(".", "-")


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_tickers(path: Path) -> list[str]:
    if not path.exists():
        return []
    raw = load_json(path)
    if isinstance(raw, list) and raw and isinstance(raw[0], dict):
        values = [row.get("symbol") for row in raw]
    elif isinstance(raw, list):
        values = raw
    else:
        values = []
    return sorted({str(value).upper().strip() for value in values if value})


def normalize_price_rows(rows: list[dict[str, Any]]) -> pd.Series:
    if not rows:
        return pd.Series(dtype="float64")
    frame = pd.DataFrame(rows)
    if "date" not in frame.columns:
        return pd.Series(dtype="float64")
    price_column = "adjClose" if "adjClose" in frame.columns else "close"
    if price_column not in frame.columns:
        return pd.Series(dtype="float64")
    frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    frame[price_column] = pd.to_numeric(frame[price_column], errors="coerce")
    frame = frame.dropna(subset=["date", price_column]).drop_duplicates("date", keep="last")
    frame = frame.sort_values("date").set_index("date")
    frame.index = pd.to_datetime(frame.index).normalize()
    return frame[price_column].dropna().astype("float64")


def normalize_price_frame(frame: pd.DataFrame) -> pd.Series:
    if frame.empty:
        return pd.Series(dtype="float64")
    price_column = "adjClose" if "adjClose" in frame.columns else "close"
    if price_column not in frame.columns:
        return pd.Series(dtype="float64")
    normalized = frame.copy()
    if "date" in normalized.columns:
        normalized["date"] = pd.to_datetime(normalized["date"], errors="coerce")
        normalized = normalized.dropna(subset=["date"]).set_index("date")
    else:
        normalized.index = pd.to_datetime(normalized.index, errors="coerce")
        normalized = normalized.loc[normalized.index.notna()]
    normalized[price_column] = pd.to_numeric(normalized[price_column], errors="coerce")
    normalized = normalized.dropna(subset=[price_column])
    normalized.index = pd.to_datetime(normalized.index).normalize()
    normalized = normalized[~normalized.index.duplicated(keep="last")].sort_index()
    return normalized[price_column].dropna().astype("float64")


def cache_price_file_index() -> dict[str, list[Path]]:
    global PRICE_FILE_INDEX
    if PRICE_FILE_INDEX is not None:
        return PRICE_FILE_INDEX
    index: dict[str, list[Path]] = {}
    for universe in CACHE_PRICE_UNIVERSES:
        directory = PROJECT_ROOT / "data" / "cache" / universe / "prices"
        if not directory.exists():
            continue
        for path in directory.glob("*.csv"):
            index.setdefault(path.stem.upper(), []).append(path)
    PRICE_FILE_INDEX = index
    return index


def load_price_series(ticker: str) -> pd.Series:
    safe = safe_symbol(ticker)
    candidates: list[pd.Series] = []
    for path in cache_price_file_index().get(safe, []):
        try:
            cached = normalize_price_frame(pd.read_csv(path))
        except Exception:
            continue
        if not cached.empty:
            candidates.append(cached)

    holy_path = HOLY40_CACHE / "prices" / f"{safe}.json"
    if holy_path.exists():
        payload = load_json(holy_path)
        rows = payload.get("historical", []) if isinstance(payload, dict) else payload
        cached = normalize_price_rows(rows if isinstance(rows, list) else [])
        if not cached.empty:
            candidates.append(cached)

    soxlgood_path = SOXLGOOD_PRICE_DIR / f"{safe}.csv"
    if soxlgood_path.exists():
        cached = normalize_price_frame(pd.read_csv(soxlgood_path))
        if not cached.empty:
            candidates.append(cached)

    if candidates:
        return max(candidates, key=lambda series: (len(series), pd.Timestamp(series.index.max())))

    return pd.Series(dtype="float64")


def load_financials(ticker: str) -> list[dict[str, Any]]:
    payload = load_symbol_payload(ticker)
    rows = endpoint_rows(payload, ENDPOINT_INCOME)
    if rows:
        return rows
    path = HOLY40_CACHE / "financials" / f"{safe_symbol(ticker)}.json"
    if not path.exists():
        return []
    payload = load_json(path)
    return payload if isinstance(payload, list) else []


def load_cashflows(ticker: str) -> list[dict[str, Any]]:
    payload = load_symbol_payload(ticker)
    rows = endpoint_rows(payload, ENDPOINT_CASH_FLOW)
    if rows:
        return rows
    safe = safe_symbol(ticker)
    for folder in ("cashflows", "cash_flows", "cash-flow-statements", "cash_flow_statements"):
        path = HOLY40_CACHE / folder / f"{safe}.json"
        if path.exists():
            payload = load_json(path)
            return payload if isinstance(payload, list) else []
    return []


def row_date_range(rows: list[dict[str, Any]]) -> tuple[str | None, str | None]:
    dates = pd.to_datetime([row.get("date") or row.get("calendarYear") for row in rows], errors="coerce")
    dates = pd.Series(dates).dropna()
    if dates.empty:
        return None, None
    return pd.Timestamp(dates.min()).date().isoformat(), pd.Timestamp(dates.max()).date().isoformat()


def price_date_range(series: pd.Series) -> tuple[str | None, str | None]:
    if series.empty:
        return None, None
    return pd.Timestamp(series.index.min()).date().isoformat(), pd.Timestamp(series.index.max()).date().isoformat()


def selection_universe_tickers(
    universe_tickers: dict[str, list[str]],
    prices: dict[str, pd.Series],
    financials: dict[str, list[dict[str, Any]]],
) -> dict[str, list[str]]:
    selected = {universe: list(tickers) for universe, tickers in universe_tickers.items()}
    # IWM is intentionally a clean-sample universe: keep the full Russell-sized
    # file for coverage reporting, but do not repeatedly scan unusable symbols.
    selected["iwm"] = [
        ticker
        for ticker in universe_tickers.get("iwm", [])
        if not prices.get(ticker, pd.Series(dtype="float64")).empty and len(financials.get(ticker, [])) >= 2
    ]
    return selected


def cache_coverage_detail(
    universe_tickers: dict[str, list[str]],
    prices: dict[str, pd.Series],
    financials: dict[str, list[dict[str, Any]]],
    cashflows: dict[str, list[dict[str, Any]]],
    benchmarks: dict[str, pd.Series],
    selection_coverage: pd.DataFrame,
    cfg: RouterConfig,
    end: pd.Timestamp | None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    start = pd.Timestamp(cfg.start_year, 1, 1)
    required_end = end or pd.Timestamp(date.today())
    detail_rows = []
    coverage_rows = []

    for universe, tickers in universe_tickers.items():
        benchmark = UNIVERSES[universe].benchmark
        benchmark_series = benchmarks.get(benchmark, pd.Series(dtype="float64"))
        benchmark_first, benchmark_last = price_date_range(benchmark_series)
        price_count = financial_count = cashflow_count = both_count = two_income_count = 0
        full_price_count = latest_price_count = 0

        for ticker in tickers:
            series = prices.get(ticker, pd.Series(dtype="float64"))
            income_rows = financials.get(ticker, [])
            cashflow_rows = cashflows.get(ticker, [])
            price_first, price_last = price_date_range(series)
            income_first, income_last = row_date_range(income_rows)
            cashflow_first, cashflow_last = row_date_range(cashflow_rows)
            has_price = not series.empty
            has_income = bool(income_rows)
            has_two_income = len(income_rows) >= 2
            has_cashflow = bool(cashflow_rows)
            price_starts_by_start = has_price and pd.Timestamp(series.index.min()) <= start
            price_runs_to_end = has_price and pd.Timestamp(series.index.max()) >= required_end - pd.Timedelta(days=7)

            price_count += int(has_price)
            financial_count += int(has_income)
            cashflow_count += int(has_cashflow)
            both_count += int(has_price and has_income)
            two_income_count += int(has_price and has_two_income)
            full_price_count += int(price_starts_by_start)
            latest_price_count += int(price_runs_to_end)

            if not (has_price and has_two_income and price_runs_to_end):
                detail_rows.append(
                    {
                        "universe": universe,
                        "ticker": ticker,
                        "missing_price": not has_price,
                        "price_first_date": price_first,
                        "price_last_date": price_last,
                        "price_starts_by_start_year": price_starts_by_start,
                        "price_runs_to_end": price_runs_to_end,
                        "missing_income_statement": not has_income,
                        "income_statement_rows": len(income_rows),
                        "has_two_income_statements": has_two_income,
                        "income_first_date": income_first,
                        "income_last_date": income_last,
                        "missing_cashflow_statement": not has_cashflow,
                        "cashflow_rows": len(cashflow_rows),
                        "cashflow_first_date": cashflow_first,
                        "cashflow_last_date": cashflow_last,
                    }
                )

        constituents = len(tickers)
        coverage_pct = (two_income_count / constituents * 100) if constituents else 0.0
        benchmark_cached = not benchmark_series.empty
        benchmark_runs_to_end = benchmark_cached and pd.Timestamp(benchmark_series.index.max()) >= required_end - pd.Timedelta(days=7)
        selection_rows = (
            selection_coverage[selection_coverage["universe"].astype(str) == str(universe)]
            if not selection_coverage.empty and "universe" in selection_coverage.columns
            else pd.DataFrame()
        )
        min_clean_candidates = (
            int(pd.to_numeric(selection_rows["clean_tradable_candidates"], errors="coerce").min())
            if not selection_rows.empty
            else 0
        )
        min_quality_pass_candidates = (
            int(pd.to_numeric(selection_rows["quality_pass_candidates"], errors="coerce").min())
            if not selection_rows.empty
            else 0
        )
        clean_sample_periods = int(len(selection_rows)) if not selection_rows.empty else 0
        clean_sample_top10_periods = (
            int(selection_rows["clean_sample_top10_ready"].astype(bool).sum())
            if not selection_rows.empty and "clean_sample_top10_ready" in selection_rows.columns
            else 0
        )
        if universe == "iwm":
            gate_policy = "clean_sample_top10_rebalance"
            fair_ready = benchmark_cached and benchmark_runs_to_end and clean_sample_periods > 0 and clean_sample_top10_periods == clean_sample_periods
        else:
            gate_policy = "strict_90pct_price_two_income"
            fair_ready = benchmark_cached and benchmark_runs_to_end and coverage_pct >= 90.0
        coverage_rows.append(
            {
                "universe": universe,
                "constituents": constituents,
                "coverage_gate_policy": gate_policy,
                "cached_prices": int(price_count),
                "prices_starting_by_start_year": int(full_price_count),
                "prices_running_to_end": int(latest_price_count),
                "cached_financials": int(financial_count),
                "cached_cashflows": int(cashflow_count),
                "cached_both": int(both_count),
                "cached_price_and_two_income": int(two_income_count),
                "price_and_two_income_pct": round(coverage_pct, 2),
                "benchmark": benchmark,
                "benchmark_cached": benchmark_cached,
                "benchmark_first_date": benchmark_first,
                "benchmark_last_date": benchmark_last,
                "benchmark_runs_to_end": benchmark_runs_to_end,
                "min_clean_tradable_candidates_at_rebalance": min_clean_candidates,
                "min_quality_pass_candidates_at_rebalance": min_quality_pass_candidates,
                "clean_sample_top10_ready_periods": clean_sample_top10_periods,
                "clean_sample_rebalance_periods": clean_sample_periods,
                "fair_comparison_ready": fair_ready,
            }
        )

    return pd.DataFrame(coverage_rows), pd.DataFrame(detail_rows)


def first_trading_on_or_after(index: pd.DatetimeIndex, target: pd.Timestamp, end: pd.Timestamp) -> pd.Timestamp | None:
    candidates = index[(index >= target) & (index <= end)]
    if candidates.empty:
        return None
    return pd.Timestamp(candidates.min())


def last_trading_on_or_before(series: pd.Series, target: pd.Timestamp) -> pd.Timestamp | None:
    history = series.loc[:target].dropna()
    if history.empty:
        return None
    return pd.Timestamp(history.index.max())


def all_trading_dates(benchmarks: dict[str, pd.Series]) -> pd.DatetimeIndex:
    indexes = [series.index for series in benchmarks.values() if not series.empty]
    if not indexes:
        return pd.DatetimeIndex([])
    combined = indexes[0]
    for index in indexes[1:]:
        combined = combined.union(index)
    return pd.DatetimeIndex(sorted(combined.unique()))


def common_benchmark_end(benchmarks: dict[str, pd.Series]) -> pd.Timestamp | None:
    last_dates = [pd.Timestamp(series.index.max()).normalize() for series in benchmarks.values() if not series.empty]
    if not last_dates:
        return None
    return min(last_dates)


def filing_timestamp(row: dict[str, Any], conservative_lag_days: int) -> pd.Timestamp | None:
    value = row.get("filingDate") or row.get("fillingDate") or row.get("acceptedDate")
    timestamp = pd.to_datetime(value, errors="coerce")
    if pd.notna(timestamp):
        return pd.Timestamp(timestamp).normalize()

    period_end = pd.to_datetime(row.get("date"), errors="coerce")
    if pd.isna(period_end):
        return None
    return pd.Timestamp(period_end).normalize() + pd.Timedelta(days=conservative_lag_days)


def financial_pair_as_of(
    rows: list[dict[str, Any]],
    as_of: pd.Timestamp,
    conservative_lag_days: int,
) -> tuple[dict[str, Any], dict[str, Any]] | None:
    dated_rows = []
    for row in rows:
        filed = filing_timestamp(row, conservative_lag_days)
        if filed is None or filed > as_of:
            continue
        period_end = pd.to_datetime(row.get("date"), errors="coerce")
        sort_date = filed if pd.isna(period_end) else pd.Timestamp(period_end).normalize()
        dated_rows.append((sort_date, filed, row))
    dated_rows.sort(key=lambda item: (item[0], item[1]), reverse=True)
    if len(dated_rows) < 2:
        return None
    return dated_rows[0][2], dated_rows[1][2]


def pct_growth(latest: float, previous: float) -> float | None:
    if previous == 0:
        return None
    return ((latest - previous) / abs(previous)) * 100


def gross_margin(row: dict[str, Any]) -> float | None:
    revenue = float(row.get("revenue") or 0.0)
    if revenue == 0:
        return None
    return (float(row.get("grossProfit") or 0.0) / revenue) * 100


def free_cash_flow(row: dict[str, Any]) -> float:
    capex = row.get("capitalExpenditures")
    if capex is None:
        capex = row.get("capitalExpenditure")
    return float(row.get("operatingCashFlow") or 0.0) + float(capex or 0.0)


def quality_metrics(
    income_rows: list[dict[str, Any]],
    cashflow_rows: list[dict[str, Any]],
    as_of: pd.Timestamp,
    cfg: RouterConfig,
) -> dict[str, Any] | None:
    pair = financial_pair_as_of(income_rows, as_of, cfg.lag_days_when_filing_missing)
    if pair is None:
        return None
    latest, previous = pair

    prev_revenue = float(previous.get("revenue") or 0.0)
    latest_revenue = float(latest.get("revenue") or 0.0)
    if prev_revenue == 0:
        return None
    sales_growth = pct_growth(latest_revenue, prev_revenue)
    if sales_growth is None:
        return None
    ebitda_margin = (float(latest.get("ebitda") or 0.0) / max(latest_revenue, 1.0)) * 100
    rule40 = sales_growth + ebitda_margin

    prev_net_income = float(previous.get("netIncome") or 0.0)
    latest_net_income = float(latest.get("netIncome") or 0.0)
    net_income_growth = pct_growth(latest_net_income, prev_net_income)
    if net_income_growth is None:
        return None

    eps_growth = pct_growth(float(latest.get("eps") or 0.0), float(previous.get("eps") or 0.0))
    latest_gross_margin = gross_margin(latest)
    previous_gross_margin = gross_margin(previous)
    gross_margin_expansion = (
        latest_gross_margin - previous_gross_margin
        if latest_gross_margin is not None and previous_gross_margin is not None
        else None
    )

    cashflow_pair = financial_pair_as_of(cashflow_rows, as_of, cfg.lag_days_when_filing_missing)
    fcf_growth = None
    cashflow_statement_date = None
    cashflow_filing_date = None
    if cashflow_pair is not None:
        latest_cf, previous_cf = cashflow_pair
        latest_fcf = free_cash_flow(latest_cf)
        previous_fcf = free_cash_flow(previous_cf)
        fcf_growth = pct_growth(latest_fcf, previous_fcf)
        cashflow_statement_date = latest_cf.get("date")
        cashflow_filing = filing_timestamp(latest_cf, cfg.lag_days_when_filing_missing)
        cashflow_filing_date = str(cashflow_filing.date()) if cashflow_filing is not None else None

    income_filing = filing_timestamp(latest, cfg.lag_days_when_filing_missing)

    return {
        "revenue_growth_pct": sales_growth,
        "sales_growth_pct": sales_growth,
        "eps_growth_pct": eps_growth,
        "gross_margin_expansion_pct": gross_margin_expansion,
        "ebitda_margin_pct": ebitda_margin,
        "rule40": rule40,
        "net_income_growth_pct": net_income_growth,
        "fcf_growth_pct": fcf_growth,
        "statement_date": latest.get("date"),
        "statement_filing_date": str(income_filing.date()) if income_filing is not None else None,
        "previous_statement_date": previous.get("date"),
        "cashflow_statement_date": cashflow_statement_date,
        "cashflow_filing_date": cashflow_filing_date,
        "cashflow_available_asof": cashflow_pair is not None,
    }


def point_return(series: pd.Series, start: pd.Timestamp, end: pd.Timestamp) -> float | None:
    start_date = last_trading_on_or_before(series, start)
    end_date = last_trading_on_or_before(series, end)
    if start_date is None or end_date is None or end_date <= start_date:
        return None
    start_price = series.loc[start_date]
    end_price = series.loc[end_date]
    if pd.isna(start_price) or pd.isna(end_price) or start_price <= 0:
        return None
    return float(end_price / start_price - 1)


def quality_candidate_frame(
    universe: str,
    as_of: pd.Timestamp,
    universe_tickers: dict[str, list[str]],
    prices: dict[str, pd.Series],
    financials: dict[str, list[dict[str, Any]]],
    cashflows: dict[str, list[dict[str, Any]]],
    cfg: RouterConfig,
) -> pd.DataFrame:
    rows = []
    for ticker in universe_tickers[universe]:
        series = prices.get(ticker, pd.Series(dtype="float64"))
        price_date = last_trading_on_or_before(series, as_of)
        if price_date is None:
            continue
        current_price = float(series.loc[price_date])
        if current_price < cfg.min_price:
            continue

        metrics = quality_metrics(financials.get(ticker, []), cashflows.get(ticker, []), as_of, cfg)
        if metrics is None:
            continue

        rows.append(
            {
                "ticker": ticker,
                "close": current_price,
                "price_date": price_date.date().isoformat(),
                **metrics,
            }
        )

    if not rows:
        return pd.DataFrame()
    frame = pd.DataFrame(rows)
    return frame


def rank_quality_candidates(candidates: pd.DataFrame, cfg: RouterConfig) -> pd.DataFrame:
    if candidates.empty:
        return pd.DataFrame()
    frame = candidates[candidates["rule40"] > cfg.rule40_min].copy()
    if frame.empty:
        return pd.DataFrame()
    frame["rule40_rank"] = frame["rule40"].rank(ascending=False, method="min")
    frame["net_income_growth_rank"] = frame["net_income_growth_pct"].rank(ascending=False, method="min")
    frame["combined_score_rule40_net_income"] = frame["rule40_rank"] + frame["net_income_growth_rank"]
    return (
        frame.sort_values(
            ["combined_score_rule40_net_income", "net_income_growth_pct", "rule40"],
            ascending=[True, False, False],
        )
        .reset_index(drop=True)
    )


def select_quality_top(
    universe: str,
    as_of: pd.Timestamp,
    universe_tickers: dict[str, list[str]],
    prices: dict[str, pd.Series],
    financials: dict[str, list[dict[str, Any]]],
    cashflows: dict[str, list[dict[str, Any]]],
    cfg: RouterConfig,
) -> pd.DataFrame:
    candidates = quality_candidate_frame(universe, as_of, universe_tickers, prices, financials, cashflows, cfg)
    return rank_quality_candidates(candidates, cfg).head(cfg.top).reset_index(drop=True)


def build_selection_coverage(
    schedule: list[pd.Timestamp],
    universe_tickers: dict[str, list[str]],
    prices: dict[str, pd.Series],
    financials: dict[str, list[dict[str, Any]]],
    cashflows: dict[str, list[dict[str, Any]]],
    cfg: RouterConfig,
) -> pd.DataFrame:
    rows = []
    for as_of in schedule[:-1]:
        for universe in UNIVERSES:
            candidates = quality_candidate_frame(universe, as_of, universe_tickers, prices, financials, cashflows, cfg)
            ranked = rank_quality_candidates(candidates, cfg)
            rows.append(
                {
                    "rebalance_date": as_of.date().isoformat(),
                    "universe": universe,
                    "constituents": len(universe_tickers.get(universe, [])),
                    "clean_tradable_candidates": int(len(candidates)),
                    "quality_pass_candidates": int(len(ranked)),
                    "selected_top_count": int(min(len(ranked), cfg.top)),
                    "clean_sample_top10_ready": bool(len(ranked) >= cfg.top),
                }
            )
    return pd.DataFrame(rows)


def selection_coverage_from_periods(periods: pd.DataFrame, cfg: RouterConfig) -> pd.DataFrame:
    if periods.empty:
        return pd.DataFrame()
    rows = []
    for universe in UNIVERSES:
        variant = f"static_semiannual_{universe}"
        universe_rows = periods[periods["variant"].astype(str) == variant].copy()
        if universe_rows.empty:
            continue
        universe_rows["rebalance_date"] = universe_rows["period"].astype(str).str.split("_").str[0]
        for _, row in universe_rows.drop_duplicates(["rebalance_date", "selected_universe"]).iterrows():
            rows.append(
                {
                    "rebalance_date": row["rebalance_date"],
                    "universe": universe,
                    "clean_tradable_candidates": int(row.get("clean_tradable_candidates", 0)),
                    "quality_pass_candidates": int(row.get("quality_pass_candidates", 0)),
                    "selected_top_count": int(row.get("selected_positions", 0)),
                    "clean_sample_top10_ready": bool(row.get("clean_sample_top10_ready", False)),
                    "top_count_required": int(cfg.top),
                }
            )
    return pd.DataFrame(rows)


def etf_score(series: pd.Series, as_of: pd.Timestamp) -> float | None:
    history = series.loc[:as_of].dropna()
    if len(history) < 200:
        return None
    close = float(history.iloc[-1])
    sma50 = float(history.rolling(50).mean().iloc[-1])
    sma200 = float(history.rolling(200).mean().iloc[-1])
    ret126 = close / float(history.iloc[-126]) - 1 if len(history) > 126 else 0.0
    ret252 = close / float(history.iloc[-252]) - 1 if len(history) > 252 else 0.0
    trend_bonus = (100.0 if close > sma200 else 0.0) + (50.0 if close > sma50 else 0.0)
    return trend_bonus + ret126 * 100 + ret252 * 50


def choose_start_regime(benchmarks: dict[str, pd.Series], as_of: pd.Timestamp) -> tuple[str | None, dict[str, float]]:
    scores = {}
    for universe, spec in UNIVERSES.items():
        score = etf_score(benchmarks.get(spec.benchmark, pd.Series(dtype="float64")), as_of)
        if score is not None:
            scores[universe] = score
    if not scores:
        return None, scores
    return max(scores, key=scores.get), scores


def choose_midyear_regime(
    benchmarks: dict[str, pd.Series],
    year_start: pd.Timestamp,
    as_of: pd.Timestamp,
    current_universe: str | None,
) -> tuple[str | None, dict[str, float]]:
    returns = {}
    for universe, spec in UNIVERSES.items():
        ret = point_return(benchmarks.get(spec.benchmark, pd.Series(dtype="float64")), year_start, as_of)
        if ret is not None:
            returns[universe] = ret
    if not returns:
        return current_universe, returns
    return max(returns, key=returns.get), returns


def period_label(start: pd.Timestamp, end: pd.Timestamp) -> str:
    return f"{start.date().isoformat()}_{end.date().isoformat()}"


def run_period(
    variant: str,
    timing: str,
    selected_universe: str,
    start_date: pd.Timestamp,
    end_date: pd.Timestamp,
    universe_tickers: dict[str, list[str]],
    prices: dict[str, pd.Series],
    financials: dict[str, list[dict[str, Any]]],
    cashflows: dict[str, list[dict[str, Any]]],
    benchmarks: dict[str, pd.Series],
    cfg: RouterConfig,
    decision_reason: str,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    candidates = quality_candidate_frame(selected_universe, start_date, universe_tickers, prices, financials, cashflows, cfg)
    ranked = rank_quality_candidates(candidates, cfg)
    selected = ranked.head(cfg.top).reset_index(drop=True)
    trade_rows = []
    weighted_returns = []

    if not selected.empty:
        weight = 1.0 / len(selected)
        for rank, row in selected.iterrows():
            ticker = str(row["ticker"])
            ret = point_return(prices.get(ticker, pd.Series(dtype="float64")), start_date, end_date)
            if ret is None:
                continue
            weighted_returns.append(ret * weight)
            trade_rows.append(
                {
                    "variant": variant,
                    "timing": timing,
                    "selected_universe": selected_universe,
                    "rebalance_date": start_date.date().isoformat(),
                    "exit_date": end_date.date().isoformat(),
                    "ticker": ticker,
                    "rank": int(rank + 1),
                    "weight": weight,
                    "return_pct": ret * 100,
                    "weighted_return": ret * weight,
                    "rule40": row["rule40"],
                    "rule40_rank": row["rule40_rank"],
                    "net_income_growth_pct": row["net_income_growth_pct"],
                    "net_income_growth_rank": row["net_income_growth_rank"],
                    "combined_score_rule40_net_income": row["combined_score_rule40_net_income"],
                    "revenue_growth_pct": row["revenue_growth_pct"],
                    "sales_growth_pct": row["sales_growth_pct"],
                    "eps_growth_pct": row["eps_growth_pct"],
                    "gross_margin_expansion_pct": row["gross_margin_expansion_pct"],
                    "fcf_growth_pct": row["fcf_growth_pct"],
                    "ebitda_margin_pct": row["ebitda_margin_pct"],
                    "statement_date": row["statement_date"],
                    "statement_filing_date": row["statement_filing_date"],
                    "cashflow_statement_date": row["cashflow_statement_date"],
                    "cashflow_filing_date": row["cashflow_filing_date"],
                    "cashflow_available_asof": row["cashflow_available_asof"],
                    "decision_reason": decision_reason,
                }
            )

    strategy_return = float(sum(weighted_returns)) if weighted_returns else 0.0
    spec = UNIVERSES[selected_universe]
    benchmark_return = point_return(
        benchmarks.get(spec.benchmark, pd.Series(dtype="float64")),
        start_date,
        end_date,
    )
    row = {
        "date": end_date.date().isoformat(),
        "year": int(end_date.year),
        "variant": variant,
        "timing": timing,
        "period": period_label(start_date, end_date),
        "selected_universe": selected_universe,
        "benchmark": spec.benchmark,
        "strategy_return": strategy_return,
        "benchmark_return": benchmark_return if benchmark_return is not None else 0.0,
        "invested": bool(weighted_returns),
        "positions": int(len(weighted_returns)),
        "selected_positions": int(len(selected)),
        "clean_tradable_candidates": int(len(candidates)),
        "quality_pass_candidates": int(len(ranked)),
        "clean_sample_top10_ready": bool(len(ranked) >= cfg.top),
        "gross_exposure": float(sum([1.0 / len(selected) for _ in weighted_returns])) if not selected.empty else 0.0,
        "decision_reason": decision_reason,
        "rule40_min": cfg.rule40_min,
        "rank_metric": "combined_score_rule40_net_income_lowest_best",
    }
    return row, trade_rows


def build_rebalance_dates(cfg: RouterConfig, benchmarks: dict[str, pd.Series]) -> tuple[list[pd.Timestamp], pd.Timestamp | None]:
    dates = all_trading_dates(benchmarks)
    if dates.empty:
        return [], None
    common_end = common_benchmark_end(benchmarks)
    if common_end is None:
        return [], None
    requested_end = pd.to_datetime(cfg.end_date).normalize() if cfg.end_date else pd.Timestamp(dates.max()).normalize()
    end = min(requested_end, common_end)
    dates = dates[dates <= end]
    schedule = []
    for year in range(cfg.start_year, end.year + 1):
        for month, day in ((1, 2), (7, 1)):
            target = pd.Timestamp(year, month, day)
            if target > end:
                continue
            trade_date = first_trading_on_or_after(dates, target, end)
            if trade_date is not None:
                schedule.append(trade_date)
    if not schedule or schedule[-1] < end:
        schedule.append(end)
    return sorted(pd.DatetimeIndex(schedule).unique().to_list()), end


def benchmark_year_winners(benchmarks: dict[str, pd.Series], schedule: list[pd.Timestamp]) -> pd.DataFrame:
    rows = []
    for year in sorted({d.year for d in schedule}):
        year_dates = sorted(d for d in schedule if d.year == year)
        if not year_dates:
            continue
        start = year_dates[0]
        end = year_dates[-1]
        returns = {}
        for universe, spec in UNIVERSES.items():
            ret = point_return(benchmarks.get(spec.benchmark, pd.Series(dtype="float64")), start, end)
            if ret is not None:
                returns[universe] = ret
        winner = max(returns, key=returns.get) if returns else None
        rows.append(
            {
                "year": year,
                "year_start_date": start.date().isoformat(),
                "year_end_or_latest_date": end.date().isoformat(),
                "actual_winner": winner,
                **{f"{universe}_return_pct": ret * 100 for universe, ret in returns.items()},
            }
        )
    return pd.DataFrame(rows)


def run_backtest(
    cfg: RouterConfig,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    universe_tickers = {slug: load_tickers(spec.constituents_file) for slug, spec in UNIVERSES.items()}
    all_tickers = sorted({ticker for tickers in universe_tickers.values() for ticker in tickers})
    benchmark_tickers = [spec.benchmark for spec in UNIVERSES.values()]

    prices = {ticker: load_price_series(ticker) for ticker in sorted(set(all_tickers + benchmark_tickers))}
    financials = {ticker: load_financials(ticker) for ticker in all_tickers}
    cashflows = {ticker: load_cashflows(ticker) for ticker in all_tickers}
    benchmarks = {ticker: prices.get(ticker, pd.Series(dtype="float64")) for ticker in benchmark_tickers}
    tradable_universe_tickers = selection_universe_tickers(universe_tickers, prices, financials)
    schedule, end = build_rebalance_dates(cfg, benchmarks)

    if len(schedule) < 2 or end is None:
        selection_coverage = pd.DataFrame()
        coverage, missing_coverage = cache_coverage_detail(
            universe_tickers=universe_tickers,
            prices=prices,
            financials=financials,
            cashflows=cashflows,
            benchmarks=benchmarks,
            selection_coverage=selection_coverage,
            cfg=cfg,
            end=end,
        )
        return pd.DataFrame(), pd.DataFrame(), pd.DataFrame(), coverage, pd.DataFrame(), missing_coverage, selection_coverage

    period_rows: list[dict[str, Any]] = []
    trade_rows: list[dict[str, Any]] = []
    diagnostic_rows: list[dict[str, Any]] = []

    # Static annual buy-and-hold variants.
    annual_dates = [d for d in schedule if d.month == 1 or (d.month == 6 and d == schedule[-1])]
    if schedule[-1] not in annual_dates:
        annual_dates.append(schedule[-1])
    annual_dates = sorted(pd.DatetimeIndex(annual_dates).unique().to_list())
    for universe in UNIVERSES:
        for start_date, end_date in zip(annual_dates, annual_dates[1:]):
            if start_date >= end_date:
                continue
            row, trades = run_period(
                variant=f"static_annual_{universe}",
                timing="annual",
                selected_universe=universe,
                start_date=start_date,
                end_date=end_date,
                universe_tickers=tradable_universe_tickers,
                prices=prices,
                financials=financials,
                cashflows=cashflows,
                benchmarks=benchmarks,
                cfg=cfg,
                decision_reason="fixed_universe_year_start",
            )
            period_rows.append(row)
            trade_rows.extend(trades)

    # Static semiannual variants with mid-year rebalance.
    for universe in UNIVERSES:
        for start_date, end_date in zip(schedule, schedule[1:]):
            if start_date >= end_date:
                continue
            row, trades = run_period(
                variant=f"static_semiannual_{universe}",
                timing="semiannual",
                selected_universe=universe,
                start_date=start_date,
                end_date=end_date,
                universe_tickers=tradable_universe_tickers,
                prices=prices,
                financials=financials,
                cashflows=cashflows,
                benchmarks=benchmarks,
                cfg=cfg,
                decision_reason="fixed_universe_midyear_rebalance",
            )
            period_rows.append(row)
            trade_rows.extend(trades)

    # First-pass regime/router variant.
    current_universe: str | None = None
    current_year_start: pd.Timestamp | None = None
    start_guess_by_year: dict[int, str | None] = {}
    mid_choice_by_year: dict[int, str | None] = {}
    for start_date, end_date in zip(schedule, schedule[1:]):
        if start_date.month == 1 or current_universe is None or current_year_start is None:
            current_year_start = start_date
            current_universe, scores = choose_start_regime(benchmarks, start_date)
            start_guess_by_year[start_date.year] = current_universe
            reason = "year_start_etf_trend_relative_strength"
        elif start_date.month >= 6:
            current_universe, scores = choose_midyear_regime(benchmarks, current_year_start, start_date, current_universe)
            mid_choice_by_year[start_date.year] = current_universe
            reason = "midyear_ytd_etf_leadership_check"
        else:
            scores = {}
            reason = "carry_forward_regime"

        if current_universe is None:
            continue
        row, trades = run_period(
            variant="router_firstpass_semiannual",
            timing="semiannual",
            selected_universe=current_universe,
            start_date=start_date,
            end_date=end_date,
            universe_tickers=tradable_universe_tickers,
            prices=prices,
            financials=financials,
            cashflows=cashflows,
            benchmarks=benchmarks,
            cfg=cfg,
            decision_reason=reason,
        )
        row["regime_scores_json"] = json.dumps(scores, sort_keys=True)
        period_rows.append(row)
        trade_rows.extend(trades)

    periods = pd.DataFrame(period_rows)
    trades = pd.DataFrame(trade_rows)
    selection_coverage = selection_coverage_from_periods(periods, cfg)
    coverage, missing_coverage = cache_coverage_detail(
        universe_tickers=universe_tickers,
        prices=prices,
        financials=financials,
        cashflows=cashflows,
        benchmarks=benchmarks,
        selection_coverage=selection_coverage,
        cfg=cfg,
        end=end,
    )
    hindsight = benchmark_year_winners(benchmarks, schedule)
    for _, row in hindsight.iterrows():
        year = int(row["year"])
        diagnostic_rows.append(
            {
                "year": year,
                "start_guess": start_guess_by_year.get(year),
                "midyear_choice": mid_choice_by_year.get(year),
                "actual_winner": row.get("actual_winner"),
                "start_guess_matched": start_guess_by_year.get(year) == row.get("actual_winner"),
                "midyear_choice_matched": mid_choice_by_year.get(year) == row.get("actual_winner"),
            }
        )
    diagnostics_base = pd.DataFrame(diagnostic_rows)
    if not diagnostics_base.empty and "actual_winner" in diagnostics_base.columns:
        diagnostics_base = diagnostics_base.drop(columns=["actual_winner"])
    diagnostics = diagnostics_base.merge(hindsight, on="year", how="outer") if not hindsight.empty else diagnostics_base

    yearly = summarize_yearly(periods, trades)
    summary = summarize_variants(periods, yearly, cfg)
    return (
        yearly,
        periods,
        trades,
        coverage,
        diagnostics.merge(summary[["variant"]].head(0), how="outer") if False else diagnostics,
        missing_coverage,
        selection_coverage,
    )


def summarize_yearly(periods: pd.DataFrame, trades: pd.DataFrame) -> pd.DataFrame:
    if periods.empty:
        return pd.DataFrame()
    rows = []
    for (variant, timing, year), group in periods.groupby(["variant", "timing", "year"]):
        returns = pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)
        benchmark = pd.to_numeric(group["benchmark_return"], errors="coerce").fillna(0.0)
        equity = (1 + returns).cumprod()
        bench_equity = (1 + benchmark).cumprod()
        year_trades = (
            trades[
                (trades["variant"].astype(str) == str(variant))
                & (pd.to_datetime(trades["exit_date"], errors="coerce").dt.year == int(year))
            ]
            if not trades.empty
            else pd.DataFrame()
        )
        rows.append(
            {
                "year": int(year),
                "variant": variant,
                "timing": timing,
                "strategy_id": variant,
                "strategy_family": "quality_regime_router",
                "universe": "router" if str(variant).startswith("router") else str(variant).split("_")[-1],
                "rebalance_frequency": timing,
                "position_count": int(group["selected_positions"].max()),
                "weighting_scheme": "equal",
                "top1_weight": None,
                "annual_return_pct": round(((1 + returns).prod() - 1) * 100, 2),
                "benchmark": "selected_proxy",
                "benchmark_return_pct": round(((1 + benchmark).prod() - 1) * 100, 2),
                "excess_return_pct": round((((1 + returns).prod() - 1) - ((1 + benchmark).prod() - 1)) * 100, 2),
                "max_drawdown_pct": round(max_drawdown_pct(equity), 2),
                "benchmark_max_drawdown_pct": round(max_drawdown_pct(bench_equity), 2),
                "exposure_pct": round(group["invested"].astype(bool).mean() * 100, 2),
                "periods": int(len(group)),
                "trades": int(len(year_trades)),
                "dominant_market_state": group["selected_universe"].mode().iloc[0],
                "cash_allowed": True,
                "stop_type": "none",
                "uses_relative_strength": str(variant).startswith("router"),
                "uses_regime_filter": str(variant).startswith("router"),
                "uses_rule40": True,
                "uses_net_income_growth": True,
                "uses_gap_up": False,
                "research_source": "quality_regime_router_cache_only",
                "margin_allowed": False,
                "leveraged_etfs_allowed": False,
            }
        )
    return pd.DataFrame(rows).sort_values(["variant", "year"])


def summarize_variants(periods: pd.DataFrame, yearly: pd.DataFrame, cfg: RouterConfig) -> pd.DataFrame:
    if periods.empty:
        return pd.DataFrame()
    rows = []
    for (variant, timing), group in periods.groupby(["variant", "timing"]):
        group = group.sort_values("date").copy()
        returns = pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)
        equity = (1 + returns).cumprod()
        start = pd.to_datetime(group["period"].iloc[0].split("_")[0])
        end = pd.to_datetime(group["date"].iloc[-1])
        years = max((end - start).days / 365.25, 1e-9)
        total_return = float(equity.iloc[-1] - 1) if not equity.empty else 0.0
        annualized = (1 + total_return) ** (1 / years) - 1
        yearly_group = yearly[(yearly["variant"].astype(str) == str(variant)) & (yearly["timing"].astype(str) == str(timing))]
        rows.append(
            {
                "variant": variant,
                "timing": timing,
                "start_date": start.date().isoformat(),
                "end_date": end.date().isoformat(),
                "years": round(years, 2),
                "initial_capital": 1.0,
                "final_equity": round(float(equity.iloc[-1]), 6) if not equity.empty else 1.0,
                "total_return_pct": round(total_return * 100, 2),
                "annualized_return_pct": round(annualized * 100, 2),
                "max_drawdown_pct": round(max_drawdown_pct(equity), 2),
                "exposure_pct": round(group["invested"].astype(bool).mean() * 100, 2),
                "win_years": int((pd.to_numeric(yearly_group["annual_return_pct"], errors="coerce") > 0).sum()),
                "loss_years": int((pd.to_numeric(yearly_group["annual_return_pct"], errors="coerce") < 0).sum()),
                "periods": int(len(group)),
                "avg_positions": round(pd.to_numeric(group["positions"], errors="coerce").mean(), 2),
                "rule40_min": cfg.rule40_min,
                "rank_metric": "combined_score_rule40_net_income_lowest_best",
                "margin_allowed": False,
                "leveraged_etfs_allowed": False,
            }
        )
    return pd.DataFrame(rows).sort_values("annualized_return_pct", ascending=False)


def math_check(periods: pd.DataFrame, yearly: pd.DataFrame, summary: pd.DataFrame) -> pd.DataFrame:
    checks = []
    if periods.empty or yearly.empty or summary.empty:
        return pd.DataFrame(
            [
                {
                    "check": "quality_router_outputs_present",
                    "status": "fail",
                    "detail": "Periods, yearly, or summary output was empty.",
                }
            ]
        )

    for _, row in yearly.iterrows():
        group = periods[
            (periods["variant"].astype(str) == str(row["variant"]))
            & (periods["timing"].astype(str) == str(row["timing"]))
            & (periods["year"].astype(int) == int(row["year"]))
        ]
        expected = round(((1 + pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)).prod() - 1) * 100, 2)
        actual = float(row["annual_return_pct"])
        checks.append(
            {
                "check": f"{row['variant']}_{row['year']}_annual_return_pct",
                "status": "pass" if abs(expected - actual) <= 0.05 else "fail",
                "expected": expected,
                "actual": actual,
                "detail": "Recomputed from period returns.",
            }
        )

    for _, row in summary.iterrows():
        group = periods[
            (periods["variant"].astype(str) == str(row["variant"]))
            & (periods["timing"].astype(str) == str(row["timing"]))
        ]
        expected = round(((1 + pd.to_numeric(group["strategy_return"], errors="coerce").fillna(0.0)).prod() - 1) * 100, 2)
        actual = float(row["total_return_pct"])
        checks.append(
            {
                "check": f"{row['variant']}_total_return_pct",
                "status": "pass" if abs(expected - actual) <= 0.05 else "fail",
                "expected": expected,
                "actual": actual,
                "detail": "Recomputed from all period returns.",
            }
        )
    return pd.DataFrame(checks)


def write_markdown_report(
    report_file: Path,
    summary: pd.DataFrame,
    coverage: pd.DataFrame,
    missing_coverage: pd.DataFrame,
    selection_coverage: pd.DataFrame,
    diagnostics: pd.DataFrame,
    math_checks: pd.DataFrame,
    outputs: dict[str, Path],
    cfg: RouterConfig,
) -> None:
    failures = math_checks[math_checks["status"] != "pass"] if not math_checks.empty else math_checks
    fair_ready = bool(not coverage.empty and coverage["fair_comparison_ready"].astype(bool).all())
    lines = [
        "# Quality Regime Router Backtest",
        "",
        f"Generated: {date.today().isoformat()}",
        "",
        "## Method",
        "",
        "- Cache-only run; no yfinance, margin, shorting, or leveraged ETF path.",
        "- Quality filter uses the supplied HolyRollerFmpScreener logic: Sales Growth %, EPS Growth %, Net Income Growth %, Gross Margin Expansion %, EBITDA margin, Rule of 40, and FCF Growth % when cash-flow statements are cached.",
        "- Selection requires Rule of 40 greater than the threshold, then ranks passers by Combined Score = rank(Rule of 40 descending) + rank(Net Income Growth % descending). Lowest combined score wins, with Net Income Growth % and Rule of 40 as tie-breakers.",
        f"- Rule of 40 threshold: greater than {cfg.rule40_min:g}. Top count: {cfg.top}.",
        "- Financial statements are selected using filingDate/fillingDate/acceptedDate at or before the rebalance date. If a filing date is absent, statement period end plus a conservative lag is used.",
        "- Rebalance uses close-to-close returns from the rebalance date to the next scheduled date, so selections are interpreted as executable at that day's close after data is known.",
        "- Universe constituents are current local files, so constituent survivorship bias remains a limitation.",
        "- Earnings reaction score is intentionally excluded from this first-pass annual/midyear backtest.",
        "",
        "## Outputs",
        "",
    ]
    for name, path in outputs.items():
        lines.append(f"- {name}: `{path.relative_to(PROJECT_ROOT)}`")

    lines.extend(["", "## Fair Comparison Status", ""])
    if fair_ready:
        lines.append(
            "Fair comparison gate passed for this cache snapshot: QQQ/SPY use strict near-complete coverage, "
            "while IWM is treated as a clean-sample small/mid-cap universe with missing/bad symbols discarded."
        )
    else:
        lines.append(
            "Fair comparison gate did not pass. QQQ/SPY require strict near-complete coverage; IWM requires enough "
            "clean tradable quality candidates at each rebalance to form the top 10 after discarding bad/missing symbols."
        )
    if not selection_coverage.empty:
        iwm_rows = selection_coverage[selection_coverage["universe"].astype(str) == "iwm"]
        if not iwm_rows.empty:
            lines.append(
                f"IWM clean-sample top-10 readiness: {int(iwm_rows['clean_sample_top10_ready'].astype(bool).sum())}/"
                f"{len(iwm_rows)} rebalance periods; min clean tradable candidates "
                f"{int(pd.to_numeric(iwm_rows['clean_tradable_candidates'], errors='coerce').min())}, "
                f"min Rule-of-40 pass candidates {int(pd.to_numeric(iwm_rows['quality_pass_candidates'], errors='coerce').min())}."
            )

    lines.extend(["", "## Summary", ""])
    if summary.empty:
        lines.append("No strategy periods were generated.")
    else:
        lines.append(summary.to_markdown(index=False))

    lines.extend(["", "## Cache Coverage", ""])
    lines.append(coverage.to_markdown(index=False) if not coverage.empty else "No cache coverage rows.")
    if not missing_coverage.empty:
        lines.extend(
            [
                "",
                f"Detailed missing symbol coverage is in `{outputs['missing_coverage'].relative_to(PROJECT_ROOT)}`.",
            ]
        )
    if not selection_coverage.empty:
        lines.extend(
            [
                "",
                f"Per-rebalance clean-sample candidate counts are in `{outputs['selection_coverage'].relative_to(PROJECT_ROOT)}`.",
            ]
        )

    lines.extend(["", "## Regime Guess Diagnostic", ""])
    if diagnostics.empty:
        lines.append("No regime diagnostic rows were generated, usually because benchmark proxy data was missing.")
    else:
        display_cols = [
            col
            for col in [
                "year",
                "start_guess",
                "midyear_choice",
                "actual_winner",
                "start_guess_matched",
                "midyear_choice_matched",
                "iwm_return_pct",
                "qqq_return_pct",
                "spy_return_pct",
            ]
            if col in diagnostics.columns
        ]
        lines.append(diagnostics[display_cols].to_markdown(index=False))

    lines.extend(["", "## Math Check", ""])
    if failures.empty:
        lines.append("Internal math checks passed.")
    else:
        lines.append("Internal math checks failed; do not use these outputs for selection until fixed.")
        lines.append(failures.to_markdown(index=False))

    lines.extend(
        [
            "",
            "## Data Limitations",
            "",
            "- Results are only as complete as the canonical `data/cache/{qqq,sp500,iwm}` price caches, `data/cache/fundamentals`, and legacy `data/cache/holy40_godmode108` fallbacks.",
            "- Missing QQQ/SPY/SP500/IWM fundamentals, cash-flow statements, member prices, or benchmark prices are reported instead of filled with synthetic data.",
            "- IWM constituent coverage is intentionally clean-sample: bad, tiny, or missing symbols are discarded and reported rather than treated as a blocker for the full Russell-sized file.",
            "- If cash-flow statements are absent, FCF Growth % remains blank and is not used for ranking; the required ranking uses Rule of 40 and Net Income Growth %.",
            "- This is a first-pass transparent regime rule using ETF trend and relative strength, not a validated macro classifier.",
            "",
        ]
    )
    report_file.write_text("\n".join(lines), encoding="utf-8")


def write_outputs(
    yearly: pd.DataFrame,
    periods: pd.DataFrame,
    trades: pd.DataFrame,
    summary: pd.DataFrame,
    coverage: pd.DataFrame,
    missing_coverage: pd.DataFrame,
    selection_coverage: pd.DataFrame,
    diagnostics: pd.DataFrame,
    math_checks: pd.DataFrame,
    cfg: RouterConfig,
) -> dict[str, Path]:
    REPORTS_DIR.mkdir(exist_ok=True)
    stamp = date.today().isoformat()
    base = f"{cfg.output_prefix}_{stamp}"
    outputs = {
        "yearly": REPORTS_DIR / f"{base}_yearly.csv",
        "periods": REPORTS_DIR / f"{base}_periods.csv",
        "trades": REPORTS_DIR / f"{base}_trades.csv",
        "summary": REPORTS_DIR / f"{base}_summary.csv",
        "coverage": REPORTS_DIR / f"{base}_coverage.csv",
        "missing_coverage": REPORTS_DIR / f"{base}_missing_coverage.csv",
        "selection_coverage": REPORTS_DIR / f"{base}_selection_coverage.csv",
        "regime_diagnostic": REPORTS_DIR / f"{base}_regime_diagnostic.csv",
        "math_checks": REPORTS_DIR / f"{base}_math_checks.csv",
        "report": REPORTS_DIR / f"{base}_report.md",
    }
    yearly.to_csv(outputs["yearly"], index=False)
    periods.to_csv(outputs["periods"], index=False)
    trades.to_csv(outputs["trades"], index=False)
    summary.to_csv(outputs["summary"], index=False)
    coverage.to_csv(outputs["coverage"], index=False)
    missing_coverage.to_csv(outputs["missing_coverage"], index=False)
    selection_coverage.to_csv(outputs["selection_coverage"], index=False)
    diagnostics.to_csv(outputs["regime_diagnostic"], index=False)
    math_checks.to_csv(outputs["math_checks"], index=False)
    write_markdown_report(outputs["report"], summary, coverage, missing_coverage, selection_coverage, diagnostics, math_checks, outputs, cfg)
    return outputs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Cache-only quality filter and regime-router research backtest.")
    parser.add_argument("--start-year", type=int, default=2010)
    parser.add_argument("--end-date", help="Optional end date, e.g. 2026-06-09.")
    parser.add_argument("--top", type=int, default=10)
    parser.add_argument("--rule40-min", type=float, default=40.0)
    parser.add_argument("--min-price", type=float, default=1.0)
    parser.add_argument("--output-prefix", default="quality_regime_router")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    cfg = RouterConfig(
        start_year=args.start_year,
        end_date=args.end_date,
        top=args.top,
        rule40_min=args.rule40_min,
        min_price=args.min_price,
        output_prefix=args.output_prefix,
    )
    yearly, periods, trades, coverage, diagnostics, missing_coverage, selection_coverage = run_backtest(cfg)
    summary = summarize_variants(periods, yearly, cfg)
    math_checks = math_check(periods, yearly, summary)
    outputs = write_outputs(yearly, periods, trades, summary, coverage, missing_coverage, selection_coverage, diagnostics, math_checks, cfg)

    for name, path in outputs.items():
        print(f"{name}: {path}")
    print()
    if not summary.empty:
        print(summary.to_string(index=False))
    else:
        print("No strategy summary generated. See coverage output for missing cache details.")
    failures = math_checks[math_checks["status"] != "pass"] if not math_checks.empty else math_checks
    print(f"\nInternal math checks: {len(math_checks)} run, {len(failures)} failures")


if __name__ == "__main__":
    main()
