# Scanner Deploy Pipeline

**Repo:** `C:\Users\CoryRoberts\onepersonempire` (archived duplicate moved to `C:\Users\CoryRoberts\ARCHIVED\`).

**Same domain, two products:** `onepersonempire.web.app/` is the builder/landing app; `onepersonempire.web.app/scanner` is the private scanner shell. They share one Cloud Run deploy but **different code trees** — scanner work should stay under `app/scanner/`, `app/api/scanner/`, and `lib/scanner-*` (not `app/page.tsx` / builder).

Use this doc for scanner-only updates so unrelated builder work does not get deployed by accident.

## Cloud daily refresh (preferred — PC optional)

The System scanner JSON used to depend on the Windows 7:35 AM bat. That breaks whenever the PC is off or reset.

**Use the Cloud Run Job instead:** see `jobs/scanner-refresh/README.md`.

```bash
export PUBLISHED_ASSETS_BUCKET=YOUR_BUCKET
./jobs/scanner-refresh/deploy.sh
gcloud run jobs execute scanner-daily-refresh --region us-central1
```

One-time: seed `gs://YOUR_BUCKET/scanner/cache/` from your PC FMP cache so the first cloud run is not a cold download.

This uploads `scanner/stock_scanner_dashboard.json` on weekdays. Other dashboards (Leaders, charts, calendars, …) still need their PC builders until those are ported the same way.

## Legacy PC refresh (fallback)

`REFRESH_STOCK_SCANNER_SILENT.bat` on your PC (~7:35 AM local) still works if the cloud job is not deployed yet. Prefer cloud so the site does not depend on the PC being awake.

## EW overlay (separate from scans)

After the normal scanner refresh on your PC:

1. `python scanners/elliott_wave_overlay.py --upload`
2. Uploads `scanner/stock_scanner_ew_overlay.json` to the same GCS bucket (does not touch scan JSON).
3. Site reads it via `/api/scanner/ew` and shows small badges (`ew1`, `ew4`, `ewA`, etc.) next to picks.

Optional env override: `SCANNER_RESULTS_GCS_EW_OBJECT` (default `scanner/stock_scanner_ew_overlay.json`).

## FMP fundamentals screener (daily with scanner refresh)

During the 7:35 AM scanner refresh on your PC:

1. `open_stock_scanner.py` builds `fmp_growth_screener.json`.
2. `upload_scanner_assets.py --only daily` uploads it to `scanner/fmp_growth_screener.json`.
3. Site reads it via `/api/scanner/fundamentals` at **`/scanner/fundamentals`**.

Optional env override: `SCANNER_RESULTS_GCS_FMP_OBJECT` (default `scanner/fmp_growth_screener.json`).

**Deploy note:** The fundamentals page (`app/scanner/fundamentals/`, `app/api/scanner/fundamentals/`, `lib/scanner-fmp-data.ts`) must be committed and deployed — data upload alone does not create the route.

## Adaptive monitor (daily with scanner refresh)

During the 7:35 AM `REFRESH_STOCK_SCANNER_SILENT.bat` run on your PC:

1. `open_stock_scanner.py` runs one adaptive monitor cycle and writes `adaptive_monitor_dashboard.json`.
2. `upload_scanner_assets.py --only daily` uploads it to `scanner/adaptive_monitor_dashboard.json`.
3. Site reads it via `/api/scanner/monitor` at `/scanner/monitor`.

Optional env override: `SCANNER_RESULTS_GCS_MONITOR_OBJECT` (default `scanner/adaptive_monitor_dashboard.json`).

## Charts preview (beta, isolated route)

Daily chart JSON is built on your PC and uploaded separately from the main scanner bundle:

1. `python scanners/build_scanner_charts.py --upload` (or `morning_charts_refresh.py`)
2. Uploads `scanners/charts/*.json` to `scanner/charts/` on GCS (~700 tickers + manifest).
3. Site serves them at **`/scanner/charts`** via `/api/scanner/charts/*`.

**Isolation:** Charts live under `app/scanner/charts/` only — lazy-loaded client bundle, route `error.tsx`, and panel error boundary. A chart failure does not affect `/scanner` or other tools. Deploy chart routes separately if you want zero build risk to the main scanner page.

## Cursor Cloud deploy (no browser Google login)

Cloud agents cannot use your PC’s gcloud session. One-time:

1. On the Windows PC (gcloud already working): run `scripts\setup-cursor-deploy-sa.bat`
2. In [Cursor Cloud Agents secrets](https://cursor.com/dashboard/cloud-agents): add Runtime Secret `GCP_SA_KEY` (paste the JSON key) and `GCP_PROJECT_ID`=`onepersonempire`
3. Start a **new** cloud agent so secrets load

Then any cloud agent can deploy with:

```bash
bash scripts/deploy-cloud-run.sh
```

Prefer desktop Cursor on the PC when secrets are not set yet.

## Quick Path

1. Check only scanner files changed:
   `git status --short app/scanner app/api/scanner`
2. Lint scanner files:
   `npm run lint -- app/scanner/ScannerPageClient.tsx app/scanner/requests/ScannerRequestsClient.tsx app/scanner/requests/page.tsx app/api/scanner/requests/route.ts app/api/scanner/requests/results/route.ts app/api/scanner/ew/route.ts lib/scanner-ew-overlay.ts`
3. Build:
   `npm run build`
4. Stage only intended scanner files:
   `git add app/scanner/ScannerPageClient.tsx app/scanner/requests app/api/scanner/requests app/api/scanner/ew lib/scanner-ew-overlay.ts`
5. Commit:
   `git commit -m "Add scanner request board"`
6. Deploy from a clean worktree at the commit:
   `git worktree add ../onepersonempire-scanner-deploy HEAD`
   `cd ../onepersonempire-scanner-deploy`
   `gcloud run deploy onepersonempire --source . --region us-central1 --allow-unauthenticated`
7. Verify:
   `https://onepersonempire.web.app/scanner`
   `https://onepersonempire.web.app/scanner/requests`

## Rule

Do not deploy from a dirty working tree. If unrelated builder/site files are dirty, deploy from a clean worktree.
