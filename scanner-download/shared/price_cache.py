from __future__ import annotations

import argparse
import json
import os
import pickle
import sys
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import requests
from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parent.parent
CACHE_ROOT = PROJECT_ROOT / "data" / "cache"
REPORTS_DIR = PROJECT_ROOT / "reports"
HOLY40_PRICE_DIR = CACHE_ROOT / "holy40_godmode108" / "prices"


@dataclass(frozen=True)
class UniverseConfig:
    slug: str
    aliases: tuple[str, ...]
    benchmark: str
    constituents_file: Path
    legacy_cache_file: Path


UNIVERSES: dict[str, UniverseConfig] = {
    "qqq": UniverseConfig(
        slug="qqq",
        aliases=("qqq", "nasdaq100", "nasdaq-100", "nasdaq"),
        benchmark="QQQ",
        constituents_file=PROJECT_ROOT / "nasdaq100_constituents_2026-06-08.json",
        legacy_cache_file=PROJECT_ROOT / "momentum_cache.pkl",
    ),
    "sp500": UniverseConfig(
        slug="sp500",
        aliases=("sp500", "s&p500", "s&p-500", "spy"),
        benchmark="SPY",
        constituents_file=PROJECT_ROOT / "sp500_constituents_2026-06-08.json",
        legacy_cache_file=PROJECT_ROOT / "sp500_closes_cache.pkl",
    ),
    "iwm": UniverseConfig(
        slug="iwm",
        aliases=("iwm", "russell", "russell2000", "russell-2000"),
        benchmark="IWM",
        constituents_file=PROJECT_ROOT / "russell_clean_2026-04-02.json",
        legacy_cache_file=PROJECT_ROOT / "russell2000_closes_cache.pkl",
    ),
    "soxlgood": UniverseConfig(
        slug="soxlgood",
        aliases=("soxlgood", "soxl-good", "soxlsoxs", "soxl-soxs"),
        benchmark="SOXL",
        constituents_file=PROJECT_ROOT / "soxlgood_constituents.json",
        legacy_cache_file=PROJECT_ROOT / "soxlgood_cache.pkl",
    ),
}

ALIAS_TO_SLUG = {alias: cfg.slug for cfg in UNIVERSES.values() for alias in cfg.aliases}
PRICE_COLUMNS = ["open", "high", "low", "close", "adjClose", "volume"]
DATE_COLUMN = "date"
METADATA_FILE = "metadata.json"
UNIVERSE_FILE = "universe.json"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def normalize_universe(universe: str) -> str:
    key = universe.lower().strip()
    try:
        return ALIAS_TO_SLUG[key]
    except KeyError as exc:
        supported = ", ".join(sorted(ALIAS_TO_SLUG))
        raise ValueError(f"Unsupported universe '{universe}'. Supported aliases: {supported}") from exc


def universe_config(universe: str) -> UniverseConfig:
    return UNIVERSES[normalize_universe(universe)]


def universe_cache_dir(universe: str) -> Path:
    return CACHE_ROOT / normalize_universe(universe)


def prices_dir(universe: str) -> Path:
    return universe_cache_dir(universe) / "prices"


def metadata_path(universe: str) -> Path:
    return universe_cache_dir(universe) / METADATA_FILE


def universe_file_path(universe: str) -> Path:
    return universe_cache_dir(universe) / UNIVERSE_FILE


def ticker_file_path(universe: str, ticker: str) -> Path:
    safe = ticker.upper().replace("/", "-").replace("\\", "-").replace(".", "-")
    return prices_dir(universe) / f"{safe}.csv"


def ensure_cache_dirs(universe: str) -> None:
    prices_dir(universe).mkdir(parents=True, exist_ok=True)


def get_api_key(required: bool = True) -> str | None:
    load_dotenv(PROJECT_ROOT / ".env")
    api_key = os.getenv("FMP_API_KEY")
    if required and not api_key:
        raise SystemExit("Missing FMP_API_KEY. Add it to .env before running an update.")
    return api_key


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


def write_missing_api_report(
    universe: str,
    symbols: list[str],
    from_date: date | None,
    to_date: date | None,
    limit: int | None,
) -> Path:
    REPORTS_DIR.mkdir(exist_ok=True)
    path = REPORTS_DIR / f"price_cache_missing_{normalize_universe(universe)}_{date.today().isoformat()}.md"
    command = f"python price_cache.py update --universe {normalize_universe(universe)}"
    if from_date:
        command += f" --from-date {from_date.isoformat()}"
    if to_date:
        command += f" --to-date {to_date.isoformat()}"
    if limit:
        command += f" --limit {limit}"
    symbol_preview = ", ".join(symbols[:20])
    if len(symbols) > 20:
        symbol_preview += f", ... ({len(symbols)} total)"
    lines = [
        "# Price Cache Missing API Key",
        "",
        "No FMP price data was downloaded because `FMP_API_KEY` is not available in the environment or `.env`.",
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


def load_tickers(path: Path) -> list[str]:
    if not path.exists():
        raise FileNotFoundError(f"Ticker file not found: {path}")

    data = load_json(path)
    if isinstance(data, list) and data and isinstance(data[0], dict):
        tickers = [row.get("symbol") for row in data]
    elif isinstance(data, list):
        tickers = data
    else:
        raise ValueError(f"Unsupported ticker file format: {path}")

    return sorted({str(t).upper().strip() for t in tickers if t})


def load_metadata(universe: str) -> dict[str, Any]:
    path = metadata_path(universe)
    if not path.exists():
        return {"version": 1, "universe": normalize_universe(universe), "tickers": {}}

    data = load_json(path)
    if not isinstance(data, dict):
        return {"version": 1, "universe": normalize_universe(universe), "tickers": {}}
    data.setdefault("version", 1)
    data.setdefault("universe", normalize_universe(universe))
    data.setdefault("tickers", {})
    return data


def save_metadata(universe: str, metadata: dict[str, Any]) -> None:
    metadata["version"] = 1
    metadata["universe"] = normalize_universe(universe)
    metadata["updated_at_utc"] = utc_now_iso()
    save_json(metadata_path(universe), metadata)


def normalize_price_frame(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return pd.DataFrame(columns=PRICE_COLUMNS)

    out = df.copy()
    if DATE_COLUMN in out.columns:
        out[DATE_COLUMN] = pd.to_datetime(out[DATE_COLUMN], errors="coerce")
        out = out.dropna(subset=[DATE_COLUMN]).set_index(DATE_COLUMN)
    else:
        out.index = pd.to_datetime(out.index, errors="coerce")
        out = out.loc[out.index.notna()]

    keep = [col for col in PRICE_COLUMNS if col in out.columns]
    out = out[keep].copy()
    for col in keep:
        out[col] = pd.to_numeric(out[col], errors="coerce")

    out.index = pd.to_datetime(out.index).normalize()
    out = out[~out.index.duplicated(keep="last")].sort_index()
    out.index.name = DATE_COLUMN
    return out


def read_ticker_prices(universe: str, ticker: str) -> pd.DataFrame:
    path = ticker_file_path(universe, ticker)
    if not path.exists():
        return pd.DataFrame(columns=PRICE_COLUMNS)
    return normalize_price_frame(pd.read_csv(path))


def write_ticker_prices(universe: str, ticker: str, df: pd.DataFrame) -> None:
    ensure_cache_dirs(universe)
    normalized = normalize_price_frame(df)
    path = ticker_file_path(universe, ticker)
    tmp = path.with_suffix(".csv.tmp")
    normalized.reset_index().to_csv(tmp, index=False)
    tmp.replace(path)


def latest_price_date(df: pd.DataFrame) -> date | None:
    if df.empty:
        return None
    return pd.to_datetime(df.index.max()).date()


def first_price_date(df: pd.DataFrame) -> date | None:
    if df.empty:
        return None
    return pd.to_datetime(df.index.min()).date()


def metadata_for_frame(
    ticker: str,
    df: pd.DataFrame,
    status: str,
    source: str,
    request_from: str | None = None,
    request_to: str | None = None,
    error: str | None = None,
) -> dict[str, Any]:
    first = first_price_date(df)
    last = latest_price_date(df)
    payload: dict[str, Any] = {
        "ticker": ticker,
        "source": source,
        "status": status,
        "row_count": int(len(df)),
        "first_date": first.isoformat() if first else None,
        "last_date": last.isoformat() if last else None,
        "last_update_utc": utc_now_iso(),
        "last_request_from": request_from,
        "last_request_to": request_to,
    }
    if error:
        payload["error"] = error
    return payload


def merge_price_frames(existing: pd.DataFrame, incoming: pd.DataFrame) -> pd.DataFrame:
    if existing.empty:
        return normalize_price_frame(incoming)
    if incoming.empty:
        return normalize_price_frame(existing)
    merged = pd.concat([normalize_price_frame(existing), normalize_price_frame(incoming)])
    merged = merged[~merged.index.duplicated(keep="last")].sort_index()
    return merged


def load_legacy_pickle(path: Path) -> dict[str, pd.DataFrame]:
    if not path.exists():
        return {}

    with path.open("rb") as f:
        raw = pickle.load(f)

    if not isinstance(raw, dict):
        raise ValueError(f"Expected ticker dictionary in legacy cache: {path}")

    cache: dict[str, pd.DataFrame] = {}
    for ticker, value in raw.items():
        symbol = str(ticker).upper().strip()
        if isinstance(value, pd.DataFrame):
            df = value.copy()
        elif isinstance(value, pd.Series):
            df = value.to_frame(name="adjClose")
        else:
            continue
        normalized = normalize_price_frame(df)
        if not normalized.empty:
            cache[symbol] = normalized
    return cache


def write_universe_file(universe: str, tickers: list[str], source_file: Path) -> None:
    cfg = universe_config(universe)
    try:
        source_name = str(source_file.relative_to(PROJECT_ROOT)) if source_file.is_absolute() else str(source_file)
    except ValueError:
        source_name = str(source_file)

    payload = {
        "universe": cfg.slug,
        "aliases": list(cfg.aliases),
        "benchmark": cfg.benchmark,
        "ticker_count": len(tickers),
        "tickers": tickers,
        "source_file": source_name,
        "updated_at_utc": utc_now_iso(),
    }
    save_json(universe_file_path(universe), payload)


def import_legacy_cache(universe: str, overwrite: bool = False) -> int:
    cfg = universe_config(universe)
    legacy = load_legacy_pickle(cfg.legacy_cache_file)
    if not legacy:
        return 0

    metadata = load_metadata(universe)
    imported = 0
    for ticker, legacy_df in legacy.items():
        existing = read_ticker_prices(universe, ticker)
        if not existing.empty and not overwrite:
            continue

        merged = merge_price_frames(existing, legacy_df)
        write_ticker_prices(universe, ticker, merged)
        metadata["tickers"][ticker] = metadata_for_frame(
            ticker=ticker,
            df=merged,
            status="imported",
            source=str(cfg.legacy_cache_file.name),
        )
        imported += 1

    if imported:
        save_metadata(universe, metadata)
    return imported


def load_holy40_price_json(path: Path) -> pd.DataFrame:
    payload = load_json(path)
    rows = payload.get("historical", []) if isinstance(payload, dict) else payload
    if not isinstance(rows, list):
        return pd.DataFrame(columns=PRICE_COLUMNS)
    return normalize_price_frame(pd.DataFrame(rows))


def import_holy40_prices(
    universe: str,
    tickers_file: Path | None = None,
    limit: int | None = None,
    overwrite: bool = False,
) -> pd.DataFrame:
    cfg = universe_config(universe)
    ensure_cache_dirs(cfg.slug)
    source_file = tickers_file or cfg.constituents_file
    all_tickers = load_tickers(source_file)
    if cfg.benchmark not in all_tickers:
        all_tickers = sorted(set(all_tickers + [cfg.benchmark]))
    write_universe_file(cfg.slug, all_tickers, source_file)

    selected_tickers = all_tickers[:limit] if limit is not None else all_tickers
    if cfg.benchmark not in selected_tickers:
        selected_tickers = sorted(set(selected_tickers + [cfg.benchmark]))

    metadata = load_metadata(cfg.slug)
    records: list[dict[str, Any]] = []
    for ticker in selected_tickers:
        safe_ticker = ticker.upper().replace("/", "-").replace("\\", "-").replace(".", "-")
        source_path = HOLY40_PRICE_DIR / f"{safe_ticker}.json"
        existing = read_ticker_prices(cfg.slug, ticker)
        record = {
            "ticker": ticker,
            "status": "missing_holy40_json",
            "source": str(source_path.relative_to(PROJECT_ROOT)) if source_path.exists() else None,
            "rows_before": int(len(existing)),
            "rows_after": int(len(existing)),
        }
        if not source_path.exists():
            records.append(record)
            continue
        if not existing.empty and not overwrite:
            record["status"] = "skipped_existing"
            records.append(record)
            continue
        try:
            incoming = load_holy40_price_json(source_path)
            merged = merge_price_frames(pd.DataFrame(columns=PRICE_COLUMNS) if overwrite else existing, incoming)
            if not merged.empty:
                write_ticker_prices(cfg.slug, ticker, merged)
            record["status"] = "imported" if not incoming.empty else "empty_holy40_json"
            record["rows_imported"] = int(len(incoming))
            record["rows_after"] = int(len(merged))
            metadata["tickers"][ticker] = metadata_for_frame(
                ticker=ticker,
                df=merged,
                status=str(record["status"]),
                source=str(HOLY40_PRICE_DIR.relative_to(PROJECT_ROOT)),
            )
        except Exception as exc:
            record["status"] = "error"
            record["error"] = str(exc)
            metadata["tickers"][ticker] = metadata_for_frame(
                ticker=ticker,
                df=existing,
                status="error",
                source=str(HOLY40_PRICE_DIR.relative_to(PROJECT_ROOT)),
                error=str(exc),
            )
        records.append(record)

    save_metadata(cfg.slug, metadata)
    return pd.DataFrame(records)


def fetch_historical_prices(
    ticker: str,
    api_key: str,
    from_date: date,
    to_date: date,
    timeout: int = 30,
) -> pd.DataFrame:
    url = f"https://financialmodelingprep.com/api/v3/historical-price-full/{ticker}"
    response = requests.get(
        url,
        params={
            "from": from_date.isoformat(),
            "to": to_date.isoformat(),
            "apikey": api_key,
        },
        timeout=timeout,
    )
    response.raise_for_status()
    payload = response.json()
    rows = payload.get("historical", []) if isinstance(payload, dict) else []
    if not rows:
        return pd.DataFrame(columns=PRICE_COLUMNS)
    return normalize_price_frame(pd.DataFrame(rows))


def next_missing_start(existing: pd.DataFrame, from_date: date | None, bootstrap_days: int | None) -> date | None:
    first = first_price_date(existing)
    if from_date is not None and first is not None and first > from_date:
        return from_date
    last = latest_price_date(existing)
    if last is not None:
        candidate = last + timedelta(days=1)
        return max(candidate, from_date) if from_date else candidate
    if from_date is not None:
        return from_date
    if bootstrap_days is not None and bootstrap_days > 0:
        return date.today() - timedelta(days=bootstrap_days)
    return None


def update_universe_cache(
    universe: str,
    tickers: list[str] | None = None,
    tickers_file: Path | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    bootstrap_days: int | None = 450,
    limit: int | None = None,
    sleep_seconds: float = 0.15,
    dry_run: bool = False,
    import_legacy: bool = True,
) -> pd.DataFrame:
    cfg = universe_config(universe)
    ensure_cache_dirs(cfg.slug)

    source_file = tickers_file or cfg.constituents_file
    all_tickers = tickers or load_tickers(source_file)
    if cfg.benchmark not in all_tickers:
        all_tickers = sorted(set(all_tickers + [cfg.benchmark]))
    write_universe_file(cfg.slug, all_tickers, source_file)

    selected_tickers = all_tickers
    if limit is not None:
        selected_tickers = selected_tickers[:limit]
    if cfg.benchmark not in selected_tickers:
        selected_tickers = sorted(set(selected_tickers + [cfg.benchmark]))

    if import_legacy:
        import_legacy_cache(cfg.slug)

    api_key = None if dry_run else get_api_key(required=False)
    if api_key is None and not dry_run:
        report_path = write_missing_api_report(cfg.slug, selected_tickers, from_date, to_date, limit)
        return pd.DataFrame(
            [
                {
                    "ticker": "*",
                    "status": "missing_api_key",
                    "last_cached_date": None,
                    "request_from": from_date.isoformat() if from_date else None,
                    "request_to": (to_date or date.today()).isoformat(),
                    "rows_before": 0,
                    "rows_after": 0,
                    "report": str(report_path.relative_to(PROJECT_ROOT)),
                }
            ]
        )
    metadata = load_metadata(cfg.slug)
    target_end = to_date or date.today()
    records: list[dict[str, Any]] = []

    for index, ticker in enumerate(selected_tickers, start=1):
        existing = read_ticker_prices(cfg.slug, ticker)
        start = next_missing_start(existing, from_date, bootstrap_days)
        last = latest_price_date(existing)

        if start is None:
            status = "skipped_empty_no_start"
        elif start > target_end:
            status = "fresh"
        else:
            status = "dry_run" if dry_run else "updated"

        record = {
            "ticker": ticker,
            "status": status,
            "last_cached_date": last.isoformat() if last else None,
            "request_from": start.isoformat() if start and start <= target_end else None,
            "request_to": target_end.isoformat() if start and start <= target_end else None,
            "rows_before": int(len(existing)),
            "rows_after": int(len(existing)),
        }

        if status in {"fresh", "skipped_empty_no_start", "dry_run"}:
            records.append(record)
            continue

        print(f"[{index}/{len(selected_tickers)}] {ticker}: {start} -> {target_end}", flush=True)
        try:
            if api_key is None:
                raise RuntimeError("Internal error: missing FMP API key for live update.")
            incoming = fetch_historical_prices(ticker, api_key, start, target_end)
            merged = merge_price_frames(existing, incoming)
            if not incoming.empty:
                write_ticker_prices(cfg.slug, ticker, merged)
            record["fetched_rows"] = int(len(incoming))
            record["rows_after"] = int(len(merged))
            record["status"] = "updated" if not incoming.empty else "no_new_rows"
            metadata["tickers"][ticker] = metadata_for_frame(
                ticker=ticker,
                df=merged,
                status=str(record["status"]),
                source="fmp",
                request_from=record["request_from"],
                request_to=record["request_to"],
            )
        except Exception as exc:  # Keep a broad-universe update moving.
            record["status"] = "error"
            record["error"] = str(exc)
            metadata["tickers"][ticker] = metadata_for_frame(
                ticker=ticker,
                df=existing,
                status="error",
                source="fmp",
                request_from=record["request_from"],
                request_to=record["request_to"],
                error=str(exc),
            )

        records.append(record)
        if sleep_seconds:
            time.sleep(sleep_seconds)

    save_metadata(cfg.slug, metadata)
    return pd.DataFrame(records)


def init_universe_cache(
    universe: str,
    tickers_file: Path | None = None,
    import_legacy: bool = True,
) -> dict[str, Any]:
    cfg = universe_config(universe)
    ensure_cache_dirs(cfg.slug)
    source_file = tickers_file or cfg.constituents_file
    tickers = load_tickers(source_file)
    if cfg.benchmark not in tickers:
        tickers = sorted(set(tickers + [cfg.benchmark]))
    write_universe_file(cfg.slug, tickers, source_file)
    imported = import_legacy_cache(cfg.slug) if import_legacy else 0
    metadata = load_metadata(cfg.slug)
    save_metadata(cfg.slug, metadata)
    return {
        "universe": cfg.slug,
        "cache_dir": str(universe_cache_dir(cfg.slug)),
        "ticker_count": len(tickers),
        "imported_legacy_tickers": imported,
    }


def cache_status(universe: str) -> pd.DataFrame:
    cfg = universe_config(universe)
    metadata = load_metadata(cfg.slug)
    universe_payload = load_json(universe_file_path(cfg.slug)) if universe_file_path(cfg.slug).exists() else {}
    expected = universe_payload.get("tickers", [])
    if cfg.benchmark not in expected:
        expected = sorted(set(expected + [cfg.benchmark]))

    rows = []
    metadata_tickers = metadata.get("tickers", {})
    for ticker in expected:
        df = read_ticker_prices(cfg.slug, ticker)
        meta = metadata_tickers.get(ticker, {})
        first = first_price_date(df)
        last = latest_price_date(df)
        rows.append(
            {
                "ticker": ticker,
                "rows": int(len(df)),
                "first_date": first.isoformat() if first else None,
                "last_date": last.isoformat() if last else None,
                "metadata_status": meta.get("status"),
                "last_update_utc": meta.get("last_update_utc"),
                "cache_file": str(ticker_file_path(cfg.slug, ticker).relative_to(PROJECT_ROOT)),
            }
        )

    found_files = {path.stem.replace("-", ".") for path in prices_dir(cfg.slug).glob("*.csv")} if prices_dir(cfg.slug).exists() else set()
    extra = sorted(found_files - set(expected))
    for ticker in extra:
        df = read_ticker_prices(cfg.slug, ticker)
        first = first_price_date(df)
        last = latest_price_date(df)
        rows.append(
            {
                "ticker": ticker,
                "rows": int(len(df)),
                "first_date": first.isoformat() if first else None,
                "last_date": last.isoformat() if last else None,
                "metadata_status": metadata_tickers.get(ticker, {}).get("status"),
                "last_update_utc": metadata_tickers.get(ticker, {}).get("last_update_utc"),
                "cache_file": str(ticker_file_path(cfg.slug, ticker).relative_to(PROJECT_ROOT)),
            }
        )

    status = pd.DataFrame(rows)
    if status.empty:
        return status
    return status.sort_values(["last_date", "ticker"], na_position="first")


def load_price_cache(universe: str) -> dict[str, pd.DataFrame]:
    cfg = universe_config(universe)
    cache: dict[str, pd.DataFrame] = {}
    directory = prices_dir(cfg.slug)
    if not directory.exists():
        return cache
    for path in directory.glob("*.csv"):
        ticker = path.stem.replace("-", ".").upper()
        df = read_ticker_prices(cfg.slug, ticker)
        if not df.empty:
            cache[ticker] = df
    return cache


def load_cache_for_backtest(path_or_universe: Path | str) -> dict[str, pd.DataFrame]:
    value = Path(path_or_universe)
    if value.suffix.lower() == ".pkl":
        return load_legacy_pickle(value)
    if (value.exists() and value.is_dir()) or value.name.lower() in ALIAS_TO_SLUG:
        return load_price_cache(value.name)
    return load_price_cache(str(path_or_universe))


def parse_iso_date(value: str | None) -> date | None:
    if not value:
        return None
    return datetime.strptime(value, "%Y-%m-%d").date()


def add_common_update_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--universe", default="qqq", help="Universe alias: qqq/nasdaq100, sp500/spy, iwm/russell, soxlgood.")
    parser.add_argument("--tickers-file", type=Path, help="Optional local JSON constituents file override.")
    parser.add_argument("--from-date", help="Backfill from this date for empty tickers, e.g. 2021-01-01.")
    parser.add_argument("--to-date", help="Update through this date. Defaults to today.")
    parser.add_argument("--bootstrap-days", type=int, default=450, help="Bounded fetch window for tickers with no cache.")
    parser.add_argument("--limit", type=int, help="Limit ticker count for safe test runs.")
    parser.add_argument("--sleep", type=float, default=0.15, help="Seconds between FMP requests.")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be requested without calling FMP.")
    parser.add_argument("--no-import-legacy", action="store_true", help="Do not import existing root-level pickle cache first.")


def bridge_compatible_argv(argv: list[str]) -> list[str]:
    if "--command" not in argv:
        return argv
    index = argv.index("--command")
    if index + 1 >= len(argv):
        raise SystemExit("--command requires init, status, update, or import-holy40")
    command = argv[index + 1]
    return [command] + argv[:index] + argv[index + 2 :]


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    argv = bridge_compatible_argv(list(sys.argv[1:] if argv is None else argv))
    parser = argparse.ArgumentParser(description="Persistent local FMP price cache manager.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    init_parser = subparsers.add_parser("init", help="Create local cache folders and import legacy pickle data.")
    init_parser.add_argument("--universe", default="qqq", help="Universe alias: qqq/nasdaq100, sp500/spy, iwm/russell, soxlgood.")
    init_parser.add_argument("--tickers-file", type=Path, help="Optional local JSON constituents file override.")
    init_parser.add_argument("--no-import-legacy", action="store_true", help="Do not import existing root-level pickle cache.")

    update_parser = subparsers.add_parser("update", help="Incrementally fetch only missing/new dates from FMP.")
    add_common_update_args(update_parser)

    status_parser = subparsers.add_parser("status", help="Inspect local cache coverage and metadata.")
    status_parser.add_argument("--universe", default="qqq", help="Universe alias: qqq/nasdaq100, sp500/spy, iwm/russell, soxlgood.")
    status_parser.add_argument("--limit", type=int, help="Limit printed rows.")

    holy40_parser = subparsers.add_parser("import-holy40", help="Import local Holy40 JSON prices into the canonical CSV cache.")
    holy40_parser.add_argument("--universe", default="iwm", help="Universe alias: qqq/nasdaq100, sp500/spy, iwm/russell, soxlgood.")
    holy40_parser.add_argument("--tickers-file", type=Path, help="Optional local JSON constituents file override.")
    holy40_parser.add_argument("--limit", type=int, help="Limit ticker count for safe test runs.")
    holy40_parser.add_argument("--overwrite", action="store_true", help="Overwrite existing canonical CSV cache files.")

    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    if args.command == "init":
        result = init_universe_cache(
            universe=args.universe,
            tickers_file=args.tickers_file,
            import_legacy=not args.no_import_legacy,
        )
        print(json.dumps(result, indent=2))
        return

    if args.command == "update":
        report = update_universe_cache(
            universe=args.universe,
            tickers_file=args.tickers_file,
            from_date=parse_iso_date(args.from_date),
            to_date=parse_iso_date(args.to_date),
            bootstrap_days=args.bootstrap_days,
            limit=args.limit,
            sleep_seconds=args.sleep,
            dry_run=args.dry_run,
            import_legacy=not args.no_import_legacy,
        )
        print(report.to_string(index=False) if not report.empty else "No tickers processed.")
        return

    if args.command == "status":
        status = cache_status(args.universe)
        if args.limit:
            status = status.head(args.limit)
        print(status.to_string(index=False) if not status.empty else "No cache rows found.")
        return

    if args.command == "import-holy40":
        report = import_holy40_prices(
            universe=args.universe,
            tickers_file=args.tickers_file,
            limit=args.limit,
            overwrite=args.overwrite,
        )
        print(report.to_string(index=False) if not report.empty else "No tickers processed.")


if __name__ == "__main__":
    main()
