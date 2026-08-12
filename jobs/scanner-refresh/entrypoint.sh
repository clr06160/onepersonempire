#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "== Dream Tree cloud scanner refresh =="
echo "Repo: $ROOT"
echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ -z "${FMP_API_KEY:-}" ]]; then
  echo "ERROR: FMP_API_KEY is required for live price updates." >&2
  exit 2
fi

if [[ -z "${SCANNER_RESULTS_GCS_BUCKET:-}${PUBLISHED_ASSETS_BUCKET:-}${SCANNER_GCS_BUCKET:-}" ]]; then
  echo "ERROR: Set SCANNER_RESULTS_GCS_BUCKET or PUBLISHED_ASSETS_BUCKET." >&2
  exit 2
fi

export PYTHONPATH="${ROOT}/scanner-download/shared:${ROOT}/jobs/scanner-refresh:${PYTHONPATH:-}"

mkdir -p jobs/scanner-refresh/out scanner-download/data/cache scanner-download/reports

if [[ "${SCANNER_SKIP_CACHE_PULL:-0}" != "1" ]]; then
  python jobs/scanner-refresh/cache_sync.py pull || echo "Cache pull soft-failed; continuing with local/cold cache."
fi

BUILD_ARGS=(--no-open)
if [[ "${SCANNER_FULL_PRICE_UPDATE:-0}" == "1" ]]; then
  BUILD_ARGS+=(--full-price-update)
fi
if [[ "${SCANNER_SKIP_PRICE_UPDATE:-0}" == "1" ]]; then
  BUILD_ARGS+=(--skip-price-update)
fi
if [[ "${SCANNER_ALLOW_WEEKEND:-0}" == "1" ]]; then
  BUILD_ARGS+=(--allow-weekend)
fi
if [[ "${SCANNER_SKIP_UPLOAD:-0}" == "1" ]]; then
  BUILD_ARGS+=(--skip-upload)
fi

python jobs/scanner-refresh/build_dashboard.py "${BUILD_ARGS[@]}"

if [[ "${SCANNER_SKIP_CACHE_PUSH:-0}" != "1" ]]; then
  python jobs/scanner-refresh/cache_sync.py push || echo "Cache push soft-failed."
fi

echo "== Refresh complete =="
