OnePersonEmpire Stock Scanner Code Pack
======================================

This zip is for developer accounts only.

Layout
------
- scanners/     one Python file per dashboard scanner
- shared/       shared backtest modules imported by the scanners
- dashboard/    local HTML dashboard + cloud upload helpers
- manifest.json scanner list used by the website download button

Setup
-----
1. Unzip anywhere on your machine.
2. Create a Python env and install requirements.txt packages.
3. Put cached price/fundamental data where shared/quality_regime_router_runner.py expects it,
   or run from your existing stocks research project root.
4. Run a scanner file directly, for example:
   python scanners/core_iwm_quality_2month.py

Dashboard scanner IDs
---------------------
See manifest.json for the mapping between website dropdown IDs and Python files.

Notes
-----
- No API keys, .env files, or local cache directories are included.
- Add your own .env for FMP/cloud upload using dashboard/.env.example.
- When a new scanner is added to the website, drop a new file in scanners/
  and update manifest.json before redeploying the site.
