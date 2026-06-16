from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from dotenv import load_dotenv

from price_cache import PROJECT_ROOT, load_tickers, universe_config


CACHE_ROOT = PROJECT_ROOT / "data" / "cache" / "fundamentals"
REPORTS_DIR = PROJECT_ROOT / "reports"
LEGACY_HOLY40_FINANCIALS_DIR = PROJECT_ROOT / "data" / "cache" / "holy40_godmode108" / "financials"
CONSTITUENTS_DIR = CACHE_ROOT / "constituents"

ENDPOINT_INCOME = "income_statement"
ENDPOINT_CASH_FLOW = "cash_flow_statement"
ENDPOINT_PROFILE = "profile"
ENDPOINT_KEY_METRICS = "key_metrics"
DEFAULT_ENDPOINTS = (ENDPOINT_INCOME, ENDPOINT_CASH_FLOW, ENDPOINT_PROFILE, ENDPOINT_KEY_METRICS)

REQUIRED_ENDPOINT_FIELDS: dict[str, tuple[str, ...]] = {
    ENDPOINT_INCOME: ("revenue", "eps", "netIncome", "grossProfit", "ebitda"),
    ENDPOINT_CASH_FLOW: ("operatingCashFlow", "capitalExpenditure"),
    ENDPOINT_PROFILE: (),
    ENDPOINT_KEY_METRICS: (),
}

CONSTITUENT_ENDPOINTS: dict[str, str] = {
    "nasdaq100": "nasdaq_constituent",
    "qqq": "nasdaq_constituent",
    "sp500": "sp500_constituent",
    "spy": "sp500_constituent",
}


@dataclass(frozen=True)
class EndpointConfig:
    endpoint: str
    url_path: str
    params: dict[str, Any]
    dated: bool


ENDPOINT_CONFIGS: dict[str, EndpointConfig] = {
    ENDPOINT_INCOME: EndpointConfig(
        endpoint=ENDPOINT_INCOME,
        url_path="income-statement",
        params={"period": "annual", "limit": 20},
        dated=True,
    ),
    ENDPOINT_CASH_FLOW: EndpointConfig(
        endpoint=ENDPOINT_CASH_FLOW,
        url_path="cash-flow-statement",
        params={"period": "annual", "limit": 20},
        dated=True,
    ),
    ENDPOINT_PROFILE: EndpointConfig(
        endpoint=ENDPOINT_PROFILE,
        url_path="profile",
        params={},
        dated=False,
    ),
    ENDPOINT_KEY_METRICS: EndpointConfig(
        endpoint=ENDPOINT_KEY_METRICS,
        url_path="key-metrics",
        params={"period": "annual", "limit": 20},
        dated=True,
    ),
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def safe_symbol(symbol: str) -> str:
    return symbol.upper().strip().replace("/", "-").replace("\\", "-").replace(".", "-")


def normalize_symbol(symbol: Any) -> str | None:
    if symbol is None:
        return None
    normalized = str(symbol).upper().strip()
    return normalized or None


def symbol_cache_path(symbol: str) -> Path:
    return CACHE_ROOT / f"{safe_symbol(symbol)}.json"


def constituents_cache_path(index: str) -> Path:
    key = index.lower().strip()
    return CONSTITUENTS_DIR / f"{key}.json"


def legacy_income_path(symbol: str) -> Path:
    return LEGACY_HOLY40_FINANCIALS_DIR / f"{safe_symbol(symbol)}.json"


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, sort_keys=True)
        f.write("\n")
    tmp.replace(path)


def get_api_key(required: bool = True) -> str | None:
    load_dotenv(PROJECT_ROOT / ".env")
    api_key = os.getenv("FMP_API_KEY")
    if required and not api_key:
        raise SystemExit("Missing FMP_API_KEY. Add it to .env before running a fundamentals update.")
    return api_key


def empty_symbol_payload(symbol: str) -> dict[str, Any]:
    return {
        "version": 1,
        "symbol": symbol.upper(),
        "updated_at_utc": None,
        "endpoints": {},
    }


def load_symbol_payload(symbol: str, include_legacy: bool = True) -> dict[str, Any]:
    normalized = symbol.upper()
    path = symbol_cache_path(normalized)
    if path.exists():
        payload = load_json(path)
        if isinstance(payload, dict):
            payload.setdefault("version", 1)
            payload.setdefault("symbol", normalized)
            payload.setdefault("endpoints", {})
            return payload

    payload = empty_symbol_payload(normalized)
    if include_legacy:
        rows = read_legacy_income_rows(normalized)
        if rows:
            payload["endpoints"][ENDPOINT_INCOME] = {
                "source": "legacy_holy40_godmode108",
                "rows": rows,
                "row_count": len(rows),
                "last_success_utc": None,
                "last_status": "legacy_available",
            }
    return payload


def write_symbol_payload(symbol: str, payload: dict[str, Any]) -> None:
    payload["version"] = 1
    payload["symbol"] = symbol.upper()
    payload["updated_at_utc"] = utc_now_iso()
    save_json(symbol_cache_path(symbol), payload)


def read_legacy_income_rows(symbol: str) -> list[dict[str, Any]]:
    path = legacy_income_path(symbol)
    if not path.exists():
        return []
    payload = load_json(path)
    return payload if isinstance(payload, list) else []


def endpoint_rows(payload: dict[str, Any], endpoint: str) -> list[dict[str, Any]]:
    block = payload.get("endpoints", {}).get(endpoint, {})
    rows = block.get("rows", []) if isinstance(block, dict) else []
    return rows if isinstance(rows, list) else []


def row_date(row: dict[str, Any]) -> pd.Timestamp | None:
    value = row.get("date") or row.get("calendarYear")
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.isna(parsed):
        return None
    return pd.Timestamp(parsed).normalize()


def available_date(row: dict[str, Any], lag_days: int) -> pd.Timestamp | None:
    filed = row.get("filingDate") or row.get("fillingDate") or row.get("acceptedDate")
    parsed = pd.to_datetime(filed, errors="coerce")
    if pd.notna(parsed):
        return pd.Timestamp(parsed).normalize()

    period_end = row_date(row)
    if period_end is None:
        return None
    return period_end + pd.Timedelta(days=lag_days)


def sort_dated_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def sort_key(row: dict[str, Any]) -> tuple[pd.Timestamp, str]:
        parsed = row_date(row)
        if parsed is None:
            parsed = pd.Timestamp.min
        return parsed, str(row.get("period") or "")

    return sorted(rows, key=sort_key, reverse=True)


def merge_rows(existing: list[dict[str, Any]], incoming: list[dict[str, Any]], dated: bool) -> list[dict[str, Any]]:
    if not dated:
        return incoming or existing

    merged: dict[tuple[str, str], dict[str, Any]] = {}
    for row in existing + incoming:
        if not isinstance(row, dict):
            continue
        key = (str(row.get("date") or row.get("calendarYear") or ""), str(row.get("period") or ""))
        if key == ("", ""):
            key = (json.dumps(row, sort_keys=True), "")
        merged[key] = row
    return sort_dated_rows(list(merged.values()))


def fetch_endpoint(symbol: str, endpoint: str, api_key: str, timeout: int = 30) -> list[dict[str, Any]]:
    cfg = ENDPOINT_CONFIGS[endpoint]
    params = dict(cfg.params)
    params["apikey"] = api_key
    response = requests.get(
        f"https://financialmodelingprep.com/api/v3/{cfg.url_path}/{symbol}",
        params=params,
        timeout=timeout,
    )
    response.raise_for_status()
    payload = response.json()
    return payload if isinstance(payload, list) else []


def normalize_constituent_index(index: str) -> str:
    key = index.lower().strip()
    if key not in CONSTITUENT_ENDPOINTS:
        supported = ", ".join(sorted(CONSTITUENT_ENDPOINTS))
        raise ValueError(f"Unsupported constituent index '{index}'. Supported: {supported}")
    if key == "qqq":
        return "nasdaq100"
    if key == "spy":
        return "sp500"
    return key


def load_constituent_payload(index: str) -> dict[str, Any]:
    normalized = normalize_constituent_index(index)
    path = constituents_cache_path(normalized)
    if not path.exists():
        return {"version": 1, "index": normalized, "snapshots": []}
    payload = load_json(path)
    if not isinstance(payload, dict):
        return {"version": 1, "index": normalized, "snapshots": []}
    payload.setdefault("version", 1)
    payload.setdefault("index", normalized)
    payload.setdefault("snapshots", [])
    return payload


def write_constituent_payload(index: str, payload: dict[str, Any]) -> None:
    normalized = normalize_constituent_index(index)
    payload["version"] = 1
    payload["index"] = normalized
    payload["updated_at_utc"] = utc_now_iso()
    save_json(constituents_cache_path(normalized), payload)


def fetch_constituents(index: str, api_key: str, timeout: int = 30) -> list[dict[str, Any]]:
    normalized = normalize_constituent_index(index)
    endpoint = CONSTITUENT_ENDPOINTS[normalized]
    response = requests.get(
        f"https://financialmodelingprep.com/api/v3/{endpoint}",
        params={"apikey": api_key},
        timeout=timeout,
    )
    response.raise_for_status()
    payload = response.json()
    return payload if isinstance(payload, list) else []


def update_constituents(
    index: str,
    api_key: str | None,
    max_age_days: int = 7,
    force: bool = False,
    dry_run: bool = False,
) -> dict[str, Any]:
    normalized = normalize_constituent_index(index)
    payload = load_constituent_payload(normalized)
    snapshots = payload.get("snapshots", [])
    latest = snapshots[-1] if snapshots else {}
    latest_success = parse_last_success(latest.get("fetched_at_utc"))
    is_fresh = (
        latest_success is not None
        and latest_success >= datetime.now(timezone.utc) - timedelta(days=max_age_days)
        and bool(latest.get("rows"))
    )

    if is_fresh and not force:
        return {
            "index": normalized,
            "status": "fresh",
            "snapshots": len(snapshots),
            "latest_snapshot_date": latest.get("snapshot_date"),
            "symbols": len(latest.get("rows", [])),
        }
    if dry_run:
        return {
            "index": normalized,
            "status": "dry_run_fetch" if not snapshots else "dry_run_refresh",
            "snapshots": len(snapshots),
            "latest_snapshot_date": latest.get("snapshot_date"),
            "symbols": len(latest.get("rows", [])) if latest else 0,
        }
    if api_key is None:
        return {"index": normalized, "status": "missing_api_key"}

    rows = fetch_constituents(normalized, api_key)
    snapshot_date = date.today().isoformat()
    snapshot = {
        "snapshot_date": snapshot_date,
        "fetched_at_utc": utc_now_iso(),
        "source": f"fmp:{CONSTITUENT_ENDPOINTS[normalized]}",
        "row_count": len(rows),
        "symbols": sorted({symbol for symbol in (normalize_symbol(row.get("symbol")) for row in rows) if symbol}),
        "rows": rows,
    }

    kept = [item for item in snapshots if item.get("snapshot_date") != snapshot_date]
    kept.append(snapshot)
    payload["snapshots"] = kept
    write_constituent_payload(normalized, payload)
    return {
        "index": normalized,
        "status": "updated" if rows else "no_rows",
        "snapshots": len(kept),
        "latest_snapshot_date": snapshot_date,
        "symbols": len(snapshot["symbols"]),
    }


def latest_constituents(index: str, as_of: date | str | pd.Timestamp | None = None) -> list[str]:
    payload = load_constituent_payload(index)
    snapshots = payload.get("snapshots", [])
    if not snapshots:
        return []
    if as_of is None:
        selected = snapshots[-1]
    else:
        cutoff = pd.Timestamp(as_of).date()
        eligible = [
            snapshot
            for snapshot in snapshots
            if snapshot.get("snapshot_date") and pd.Timestamp(snapshot["snapshot_date"]).date() <= cutoff
        ]
        if not eligible:
            return []
        selected = eligible[-1]
    symbols = selected.get("symbols") or [row.get("symbol") for row in selected.get("rows", [])]
    return sorted({symbol for symbol in (normalize_symbol(value) for value in symbols) if symbol})


def constituents_status(indexes: list[str] | None = None) -> pd.DataFrame:
    selected = [normalize_constituent_index(index) for index in (indexes or ["nasdaq100", "sp500"])]
    rows = []
    for index in selected:
        payload = load_constituent_payload(index)
        snapshots = payload.get("snapshots", [])
        latest = snapshots[-1] if snapshots else {}
        rows.append(
            {
                "index": index,
                "snapshots": len(snapshots),
                "latest_snapshot_date": latest.get("snapshot_date"),
                "latest_fetched_at_utc": latest.get("fetched_at_utc"),
                "symbols": len(latest.get("symbols", [])) if latest else 0,
                "cache_file": str(constituents_cache_path(index).relative_to(PROJECT_ROOT)),
            }
        )
    return pd.DataFrame(rows)


def parse_last_success(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def endpoint_is_fresh(block: dict[str, Any], max_age_days: int) -> bool:
    if not block.get("rows"):
        return False
    last_success = parse_last_success(block.get("last_success_utc"))
    if last_success is None:
        return False
    return last_success >= datetime.now(timezone.utc) - timedelta(days=max_age_days)


def endpoint_has_required_fields(endpoint: str, rows: list[dict[str, Any]]) -> bool:
    required = REQUIRED_ENDPOINT_FIELDS.get(endpoint, ())
    if not required or not rows:
        return bool(rows) or not required
    for row in rows:
        if not isinstance(row, dict):
            continue
        if all(field in row for field in required):
            return True
    return False


def update_symbol(
    symbol: str,
    api_key: str | None,
    endpoints: tuple[str, ...] = DEFAULT_ENDPOINTS,
    max_age_days: int = 7,
    force: bool = False,
    dry_run: bool = False,
    sleep_seconds: float = 0.15,
) -> dict[str, Any]:
    normalized = symbol.upper()
    payload = load_symbol_payload(normalized)
    payload.setdefault("endpoints", {})
    record: dict[str, Any] = {"symbol": normalized}

    for endpoint in endpoints:
        cfg = ENDPOINT_CONFIGS[endpoint]
        block = payload["endpoints"].get(endpoint, {})
        existing_rows = endpoint_rows(payload, endpoint)
        if endpoint == ENDPOINT_INCOME and not existing_rows:
            existing_rows = read_legacy_income_rows(normalized)
            if existing_rows:
                block = {
                    "source": "legacy_holy40_godmode108",
                    "rows": existing_rows,
                    "row_count": len(existing_rows),
                    "last_success_utc": None,
                    "last_status": "legacy_available",
                }
                payload["endpoints"][endpoint] = block

        has_required_fields = endpoint_has_required_fields(endpoint, existing_rows)
        if not force and endpoint_is_fresh(block, max_age_days) and has_required_fields:
            record[endpoint] = "fresh"
            continue
        if dry_run:
            if not existing_rows:
                record[endpoint] = "dry_run_fetch"
            elif not has_required_fields:
                record[endpoint] = "dry_run_schema_backfill"
            else:
                record[endpoint] = "dry_run_refresh"
            continue
        if api_key is None:
            record[endpoint] = "missing_api_key"
            continue

        try:
            incoming = fetch_endpoint(normalized, endpoint, api_key)
            merged = merge_rows(existing_rows, incoming, cfg.dated)
            payload["endpoints"][endpoint] = {
                "source": "fmp",
                "params": cfg.params,
                "rows": merged,
                "row_count": len(merged),
                "last_status": "updated" if incoming else "no_rows",
                "last_success_utc": utc_now_iso(),
            }
            record[endpoint] = "updated" if incoming else "no_rows"
            record[f"{endpoint}_rows"] = len(merged)
        except Exception as exc:  # Keep broad cache updates moving ticker by ticker.
            payload["endpoints"][endpoint] = {
                **block,
                "row_count": len(existing_rows),
                "last_status": "error",
                "last_error": str(exc),
                "last_error_utc": utc_now_iso(),
            }
            record[endpoint] = "error"
            record[f"{endpoint}_error"] = str(exc)

        if sleep_seconds:
            time.sleep(sleep_seconds)

    if not dry_run:
        write_symbol_payload(normalized, payload)
    return record


def symbols_from_args(universe: str | None, symbols: list[str] | None, limit: int | None) -> list[str]:
    selected: list[str] = []
    if universe:
        cfg = universe_config(universe)
        selected.extend(load_tickers(cfg.constituents_file))
    if symbols:
        selected.extend(symbols)
    cleaned = sorted({symbol for symbol in (normalize_symbol(value) for value in selected) if symbol})
    return cleaned[:limit] if limit is not None else cleaned


def canonical_symbols() -> set[str]:
    if not CACHE_ROOT.exists():
        return set()
    return {path.stem.replace("-", ".").upper() for path in CACHE_ROOT.glob("*.json")}


def legacy_symbols() -> set[str]:
    if not LEGACY_HOLY40_FINANCIALS_DIR.exists():
        return set()
    return {path.stem.replace("-", ".").upper() for path in LEGACY_HOLY40_FINANCIALS_DIR.glob("*.json")}


def latest_available_statement_date(rows: list[dict[str, Any]]) -> str | None:
    dated = [available_date(row, lag_days=45) for row in rows]
    dated = [value for value in dated if value is not None]
    if not dated:
        return None
    return max(dated).date().isoformat()


def cache_status(symbols: list[str] | None = None, limit: int | None = None) -> pd.DataFrame:
    selected = sorted({normalize_symbol(symbol) for symbol in symbols or [] if normalize_symbol(symbol)})
    if not selected:
        selected = sorted(canonical_symbols() | legacy_symbols())
    if limit is not None:
        selected = selected[:limit]

    rows: list[dict[str, Any]] = []
    for symbol in selected:
        if symbol is None:
            continue
        payload = load_symbol_payload(symbol)
        income_rows = endpoint_rows(payload, ENDPOINT_INCOME)
        cash_flow_rows = endpoint_rows(payload, ENDPOINT_CASH_FLOW)
        profile_rows = endpoint_rows(payload, ENDPOINT_PROFILE)
        key_metric_rows = endpoint_rows(payload, ENDPOINT_KEY_METRICS)
        rows.append(
            {
                "symbol": symbol,
                "canonical_cache": symbol_cache_path(symbol).exists(),
                "legacy_income": legacy_income_path(symbol).exists(),
                "income_rows": len(income_rows),
                "cash_flow_rows": len(cash_flow_rows),
                "profile_rows": len(profile_rows),
                "key_metric_rows": len(key_metric_rows),
                "latest_income_available": latest_available_statement_date(income_rows),
                "latest_cash_flow_available": latest_available_statement_date(cash_flow_rows),
                "updated_at_utc": payload.get("updated_at_utc"),
            }
        )
    return pd.DataFrame(rows)


def rows_as_of(
    symbol: str,
    endpoint: str,
    as_of: date | str | pd.Timestamp,
    lag_days: int = 45,
) -> list[dict[str, Any]]:
    payload = load_symbol_payload(symbol)
    rows = endpoint_rows(payload, endpoint)
    cutoff = pd.Timestamp(as_of).normalize()
    available = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        seen_date = available_date(row, lag_days)
        if seen_date is not None and seen_date <= cutoff:
            available.append(row)
    return sort_dated_rows(available)


def percent_growth(current: Any, previous: Any) -> float | None:
    current_value = pd.to_numeric(current, errors="coerce")
    previous_value = pd.to_numeric(previous, errors="coerce")
    if pd.isna(current_value) or pd.isna(previous_value) or float(previous_value) == 0:
        return None
    return float((float(current_value) - float(previous_value)) / abs(float(previous_value)) * 100)


def safe_ratio_pct(numerator: Any, denominator: Any) -> float | None:
    numerator_value = pd.to_numeric(numerator, errors="coerce")
    denominator_value = pd.to_numeric(denominator, errors="coerce")
    if pd.isna(numerator_value) or pd.isna(denominator_value) or float(denominator_value) == 0:
        return None
    return float(float(numerator_value) / float(denominator_value) * 100)


def first_numeric(rows: list[dict[str, Any]], keys: tuple[str, ...]) -> float | None:
    for row in rows:
        for key in keys:
            value = pd.to_numeric(row.get(key), errors="coerce")
            if pd.notna(value):
                return float(value)
    return None


def row_numeric(row: dict[str, Any], key: str) -> float | None:
    value = pd.to_numeric(row.get(key), errors="coerce")
    return None if pd.isna(value) else float(value)


def gross_margin_pct(row: dict[str, Any]) -> float | None:
    return safe_ratio_pct(row.get("grossProfit"), row.get("revenue"))


def free_cash_flow(row: dict[str, Any]) -> float | None:
    operating_cash_flow = row_numeric(row, "operatingCashFlow")
    capital_expenditure = row_numeric(row, "capitalExpenditure")
    if operating_cash_flow is None or capital_expenditure is None:
        return None
    return operating_cash_flow + capital_expenditure


def quality_metrics_as_of(symbol: str, as_of: date | str | pd.Timestamp, lag_days: int = 45) -> dict[str, Any] | None:
    income_rows = rows_as_of(symbol, ENDPOINT_INCOME, as_of, lag_days=lag_days)
    if len(income_rows) < 2:
        return None

    latest, previous = income_rows[0], income_rows[1]
    cash_flow_rows = rows_as_of(symbol, ENDPOINT_CASH_FLOW, as_of, lag_days=lag_days)
    latest_cash_flow = cash_flow_rows[0] if cash_flow_rows else {}
    previous_cash_flow = cash_flow_rows[1] if len(cash_flow_rows) > 1 else {}

    revenue_growth = percent_growth(latest.get("revenue"), previous.get("revenue"))
    eps_growth = percent_growth(latest.get("eps"), previous.get("eps"))
    net_income_growth = percent_growth(latest.get("netIncome"), previous.get("netIncome"))
    latest_gross_margin = gross_margin_pct(latest)
    previous_gross_margin = gross_margin_pct(previous)
    gross_margin_expansion = (
        latest_gross_margin - previous_gross_margin
        if latest_gross_margin is not None and previous_gross_margin is not None
        else None
    )
    ebitda_margin = safe_ratio_pct(latest.get("ebitda"), latest.get("revenue"))
    net_income_margin = safe_ratio_pct(latest.get("netIncome"), latest.get("revenue"))
    latest_fcf = free_cash_flow(latest_cash_flow)
    previous_fcf = free_cash_flow(previous_cash_flow)
    fcf_growth = percent_growth(latest_fcf, previous_fcf)
    rule40 = revenue_growth + ebitda_margin if revenue_growth is not None and ebitda_margin is not None else None

    profile_rows = endpoint_rows(load_symbol_payload(symbol), ENDPOINT_PROFILE)
    key_metric_rows = rows_as_of(symbol, ENDPOINT_KEY_METRICS, as_of, lag_days=lag_days)
    market_cap = first_numeric(key_metric_rows, ("marketCap", "marketCapTTM"))
    if market_cap is None:
        market_cap = first_numeric(profile_rows, ("mktCap", "marketCap"))

    return {
        "symbol": symbol.upper(),
        "as_of": pd.Timestamp(as_of).date().isoformat(),
        "financial_date": str(latest.get("date") or latest.get("calendarYear") or ""),
        "financial_available_date": available_date(latest, lag_days).date().isoformat()
        if available_date(latest, lag_days) is not None
        else None,
        "cash_flow_date": str(latest_cash_flow.get("date") or latest_cash_flow.get("calendarYear") or ""),
        "cash_flow_available_date": available_date(latest_cash_flow, lag_days).date().isoformat()
        if latest_cash_flow and available_date(latest_cash_flow, lag_days) is not None
        else None,
        "revenue": row_numeric(latest, "revenue"),
        "eps": row_numeric(latest, "eps"),
        "net_income": row_numeric(latest, "netIncome"),
        "gross_profit": row_numeric(latest, "grossProfit"),
        "ebitda": row_numeric(latest, "ebitda"),
        "operating_cash_flow": row_numeric(latest_cash_flow, "operatingCashFlow"),
        "capital_expenditures": row_numeric(latest_cash_flow, "capitalExpenditure"),
        "free_cash_flow": latest_fcf,
        "revenue_growth_pct": revenue_growth,
        "sales_growth_pct": revenue_growth,
        "eps_growth_pct": eps_growth,
        "net_income_growth_pct": net_income_growth,
        "fcf_growth_pct": fcf_growth,
        "gross_margin_pct": latest_gross_margin,
        "gross_margin_expansion_pct": gross_margin_expansion,
        "ebitda_margin_pct": ebitda_margin,
        "net_income_margin_pct": net_income_margin,
        "rule40": rule40,
        "market_cap": market_cap,
        "company_name": profile_rows[0].get("companyName") if profile_rows else None,
        "sector": profile_rows[0].get("sector") if profile_rows else None,
        "industry": profile_rows[0].get("industry") if profile_rows else None,
    }


def quality_metrics_frame_as_of(
    symbols: list[str],
    as_of: date | str | pd.Timestamp,
    lag_days: int = 45,
) -> pd.DataFrame:
    records = [quality_metrics_as_of(symbol, as_of, lag_days=lag_days) for symbol in symbols]
    frame = pd.DataFrame([record for record in records if record])
    if frame.empty:
        return frame
    frame["rule40_rank"] = frame["rule40"].rank(ascending=False, method="min", na_option="bottom")
    frame["net_income_growth_rank"] = frame["net_income_growth_pct"].rank(
        ascending=False,
        method="min",
        na_option="bottom",
    )
    frame["combined_golf_score"] = frame["rule40_rank"] + frame["net_income_growth_rank"]
    return frame.sort_values(["combined_golf_score", "rule40_rank", "symbol"]).reset_index(drop=True)


def write_missing_api_report(command: str, symbols: list[str]) -> Path:
    REPORTS_DIR.mkdir(exist_ok=True)
    path = REPORTS_DIR / f"fundamentals_cache_missing_{date.today().isoformat()}.md"
    symbol_preview = ", ".join(symbols[:20])
    if len(symbols) > 20:
        symbol_preview += f", ... ({len(symbols)} total)"
    lines = [
        "# Fundamentals Cache Missing API Key",
        "",
        "No FMP data was downloaded because `FMP_API_KEY` is not available in the environment or `.env`.",
        "",
        "Add a local `.env` entry:",
        "",
        "```text",
        "FMP_API_KEY=your_financial_modeling_prep_key",
        "```",
        "",
        "Then rerun:",
        "",
        "```powershell",
        command,
        "```",
        "",
        f"Requested symbols: {symbol_preview or 'none'}",
        "",
        "This report intentionally does not include or infer any API key.",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def parse_endpoints(values: list[str] | None) -> tuple[str, ...]:
    if not values:
        return DEFAULT_ENDPOINTS
    endpoints = tuple(values)
    unsupported = sorted(set(endpoints) - set(ENDPOINT_CONFIGS))
    if unsupported:
        raise SystemExit(f"Unsupported endpoint(s): {', '.join(unsupported)}")
    return endpoints


def bridge_compatible_argv(argv: list[str]) -> list[str]:
    if "--command" not in argv:
        return argv
    index = argv.index("--command")
    if index + 1 >= len(argv):
        raise SystemExit("--command requires status, update, metrics, rank, constituents-status, or constituents-update")
    command = argv[index + 1]
    return [command] + argv[:index] + argv[index + 2 :]


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    argv = bridge_compatible_argv(list(sys.argv[1:] if argv is None else argv))
    parser = argparse.ArgumentParser(description="Persistent local FMP fundamentals cache manager.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    status_parser = subparsers.add_parser("status", help="Inspect local fundamentals cache coverage.")
    status_parser.add_argument("--universe", help="Universe alias from price_cache.py.")
    status_parser.add_argument("--symbols", nargs="+", help="Specific symbols to inspect.")
    status_parser.add_argument("--limit", type=int, help="Limit printed rows.")

    update_parser = subparsers.add_parser("update", help="Refresh missing/stale FMP fundamentals without touching prices.")
    update_parser.add_argument("--universe", help="Universe alias from price_cache.py.")
    update_parser.add_argument("--symbols", nargs="+", help="Specific symbols to update.")
    update_parser.add_argument("--endpoints", nargs="+", choices=tuple(ENDPOINT_CONFIGS), help="Endpoint subset to update.")
    update_parser.add_argument("--limit", type=int, help="Limit ticker count for safe test runs.")
    update_parser.add_argument("--max-age-days", type=int, default=7, help="Skip canonical endpoint data refreshed within this many days.")
    update_parser.add_argument("--force", action="store_true", help="Refresh endpoints even if canonical cache is fresh.")
    update_parser.add_argument("--dry-run", action="store_true", help="Show what would be requested without calling FMP.")
    update_parser.add_argument("--sleep", type=float, default=0.15, help="Seconds between FMP requests.")

    metrics_parser = subparsers.add_parser("metrics", help="Print date-aware quality metrics for one symbol.")
    metrics_parser.add_argument("--symbol", required=True)
    metrics_parser.add_argument("--as-of", required=True)
    metrics_parser.add_argument("--lag-days", type=int, default=45)

    rank_parser = subparsers.add_parser("rank", help="Rank symbols by Rule-of-40 plus net-income-growth golf score.")
    rank_parser.add_argument("--universe", help="Universe alias from price_cache.py.")
    rank_parser.add_argument("--symbols", nargs="+", help="Specific symbols to rank.")
    rank_parser.add_argument("--as-of", required=True)
    rank_parser.add_argument("--lag-days", type=int, default=45)
    rank_parser.add_argument("--limit", type=int, help="Limit printed rows.")

    constituents_status_parser = subparsers.add_parser(
        "constituents-status",
        help="Inspect cached FMP constituent snapshots.",
    )
    constituents_status_parser.add_argument("--indexes", nargs="+", choices=tuple(sorted(CONSTITUENT_ENDPOINTS)))

    constituents_update_parser = subparsers.add_parser(
        "constituents-update",
        help="Refresh FMP constituent snapshots without touching prices/fundamentals.",
    )
    constituents_update_parser.add_argument("--indexes", nargs="+", choices=tuple(sorted(CONSTITUENT_ENDPOINTS)))
    constituents_update_parser.add_argument("--max-age-days", type=int, default=7)
    constituents_update_parser.add_argument("--force", action="store_true")
    constituents_update_parser.add_argument("--dry-run", action="store_true")

    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    if args.command == "status":
        symbols = symbols_from_args(args.universe, args.symbols, args.limit) if args.universe or args.symbols else None
        status = cache_status(symbols=symbols, limit=args.limit if not symbols else None)
        print(status.to_string(index=False) if not status.empty else "No fundamentals cache rows found.")
        return

    if args.command == "metrics":
        metrics = quality_metrics_as_of(args.symbol, args.as_of, lag_days=args.lag_days)
        print(json.dumps(metrics or {}, indent=2, sort_keys=True))
        return

    if args.command == "rank":
        symbols = symbols_from_args(args.universe, args.symbols, None)
        if not symbols:
            raise SystemExit("No symbols selected. Provide --universe or --symbols.")
        frame = quality_metrics_frame_as_of(symbols, args.as_of, lag_days=args.lag_days)
        if args.limit and not frame.empty:
            frame = frame.head(args.limit)
        print(frame.to_string(index=False) if not frame.empty else "No date-aware quality metrics found.")
        return

    if args.command == "constituents-status":
        status = constituents_status(args.indexes)
        print(status.to_string(index=False) if not status.empty else "No constituent cache rows found.")
        return

    if args.command == "constituents-update":
        indexes = args.indexes or ["nasdaq100", "sp500"]
        api_key = None if args.dry_run else get_api_key(required=False)
        if api_key is None and not args.dry_run:
            command = "python fundamentals_cache.py constituents-update"
            if args.indexes:
                command += " --indexes " + " ".join(args.indexes)
            report_path = write_missing_api_report(
                command,
                [f"constituents:{normalize_constituent_index(index)}" for index in indexes],
            )
            print(f"Missing FMP_API_KEY. Wrote cache-missing report: {report_path.relative_to(PROJECT_ROOT)}")
            return
        records = [
            update_constituents(
                index=index,
                api_key=api_key,
                max_age_days=args.max_age_days,
                force=args.force,
                dry_run=args.dry_run,
            )
            for index in indexes
        ]
        report = pd.DataFrame(records)
        print(report.to_string(index=False) if not report.empty else "No indexes processed.")
        return

    if args.command == "update":
        symbols = symbols_from_args(args.universe, args.symbols, args.limit)
        if not symbols:
            raise SystemExit("No symbols selected. Provide --universe or --symbols.")
        api_key = None if args.dry_run else get_api_key(required=False)
        if api_key is None and not args.dry_run:
            command = "python fundamentals_cache.py update"
            if args.universe:
                command += f" --universe {args.universe}"
            if args.symbols:
                command += " --symbols " + " ".join(args.symbols)
            if args.limit:
                command += f" --limit {args.limit}"
            report_path = write_missing_api_report(command, symbols)
            print(f"Missing FMP_API_KEY. Wrote cache-missing report: {report_path.relative_to(PROJECT_ROOT)}")
            return

        endpoints = parse_endpoints(args.endpoints)
        records = [
            update_symbol(
                symbol=symbol,
                api_key=api_key,
                endpoints=endpoints,
                max_age_days=args.max_age_days,
                force=args.force,
                dry_run=args.dry_run,
                sleep_seconds=args.sleep,
            )
            for symbol in symbols
        ]
        report = pd.DataFrame(records)
        print(report.to_string(index=False) if not report.empty else "No symbols processed.")


if __name__ == "__main__":
    main()
