OnePersonEmpire Stock Scanner Review Pack
=========================================

This zip is for developer accounts reviewing scanner logic.

Purpose
-------
Check for look-ahead bias, data timing bugs, rebalance issues, and other
methodology problems. Email findings back to the person who granted access.

Contents
--------
- scanners/     one Python file per live dashboard scanner
- shared/       supporting backtest modules and FMP cache helpers
- setup/        REVIEW.txt checklist + optional env.example for local runs
- *.json        constituent ticker lists

Start here
----------
Read setup/REVIEW.txt for the checklist and how to report results.

Optional local run
------------------
If you want to execute code, not just read it:
1. Copy setup/env.example to .env and add your own FMP_API_KEY
2. pip install -r requirements.txt
3. Follow the cache + run steps in setup/REVIEW.txt

Not included: website secrets, cloud upload scripts, or owner credentials.
