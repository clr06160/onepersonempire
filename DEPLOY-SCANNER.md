# Scanner Deploy Pipeline

Use this for scanner-only site updates so unrelated builder work does not get deployed by accident.

## EW overlay (separate from scans)

After the normal scanner refresh on your PC:

1. `python scanners/elliott_wave_overlay.py --upload`
2. Uploads `scanner/stock_scanner_ew_overlay.json` to the same GCS bucket (does not touch scan JSON).
3. Site reads it via `/api/scanner/ew` and shows small badges (`ew1`, `ew4`, `ewA`, etc.) next to picks.

Optional env override: `SCANNER_RESULTS_GCS_EW_OBJECT` (default `scanner/stock_scanner_ew_overlay.json`).

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
