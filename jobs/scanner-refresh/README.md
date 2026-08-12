# Cloud scanner daily refresh

The system scanner used to refresh only when your **Windows PC** ran
`REFRESH_STOCK_SCANNER_SILENT.bat` (~7:35 AM). When the PC is off or broken,
`stock_scanner_dashboard.json` goes stale (`Live scan · as of …` stops moving).

This folder is the **cloud replacement** for that core loop:

1. Pull warm FMP cache from GCS (`scanner/cache/`)
2. Update IWM/QQQ prices via `FMP_API_KEY`
3. Rebuild live system picks → `stock_scanner_dashboard.json`
4. Upload to GCS (same object the website already reads)
5. Push cache back to GCS for the next run

## One-time setup

### 1. Secrets / bucket
- GCS bucket = same as site (`PUBLISHED_ASSETS_BUCKET` / `SCANNER_RESULTS_GCS_BUCKET`)
- Secret Manager: `FMP_API_KEY`

### 2. Seed cache from your PC (strongly recommended)
Cold FMP download of Russell + Nasdaq is slow and rate-limited. Once:

```bash
gsutil -m rsync -r "C:\Users\CoryRoberts\Projects\stocks\data\cache" gs://YOUR_BUCKET/scanner/cache/
```

(Adjust the local path to wherever your stocks project cache lives.)

### 3. Deploy job + weekday schedule

```bash
export PUBLISHED_ASSETS_BUCKET=YOUR_BUCKET
export GOOGLE_CLOUD_PROJECT=onepersonempire   # or your project
chmod +x jobs/scanner-refresh/deploy.sh
./jobs/scanner-refresh/deploy.sh
```

Schedule default: `35 7 * * 1-5` in `America/Denver` (same as the old bat).

### 4. Run once now

```bash
gcloud run jobs execute scanner-daily-refresh --region us-central1
```

When it finishes, System scanner **as of** should advance to the latest completed session.

## Local test (on a machine with FMP + ADC)

```bash
export FMP_API_KEY=...
export SCANNER_RESULTS_GCS_BUCKET=YOUR_BUCKET
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json   # or gcloud auth application-default login
./jobs/scanner-refresh/entrypoint.sh
```

## What this does / does not cover

**Does:** main System scanner dashboard (`scanner/stock_scanner_dashboard.json`).

**Not yet (still PC / later phases):** Leaders, charts (~700 JSON), earnings calendar,
EW overlay, monitor, FedWatch, research pages. Those still need their builders
ported from the private stocks project — same pattern as this job.

## Env vars

| Var | Required | Meaning |
|---|---|---|
| `FMP_API_KEY` | yes | Financial Modeling Prep |
| `SCANNER_RESULTS_GCS_BUCKET` or `PUBLISHED_ASSETS_BUCKET` | yes | Upload target |
| `SCANNER_CACHE_GCS_PREFIX` | no | default `scanner/cache/` |
| `SCANNER_FULL_PRICE_UPDATE=1` | no | Full IWM universe (slow) |
| `SCANNER_SKIP_CACHE_PULL=1` | no | Skip GCS cache pull |
| `SCANNER_ALLOW_WEEKEND=1` | no | Allow Sat/Sun runs |
