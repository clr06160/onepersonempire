OnePersonEmpire Stock Scanner Review Pack
=========================================

Main contents
-------------
- scanners/     6 Python files (one per live scanner on the website)
- shared/       helper Python modules the scanners import
- setup/env.example   blank FMP API template (they add their own key)

The JSON files are NOT the database
-----------------------------------
These are just ticker lists — which symbols belong to each universe:
- russell_clean_2026-04-02.json        IWM / Russell names
- nasdaq100_constituents_2026-06-08.json   QQQ / Nasdaq-100 names
- sp500_constituents_2026-06-08.json       SPY / S&P 500 names

They are not price history or fundamentals. Think of them as "who is in the index."

The real data (prices + fundamentals) comes from FMP
----------------------------------------------------
Developers use their own FMP API key (setup/env.example -> .env) and run:
  shared/price_cache.py
  shared/fundamentals_cache.py

That downloads data into a local data/cache/ folder on their machine.
First download can take a while; after that runs are incremental.

Run one scanner
---------------
  PYTHONPATH=shared python scanners/core_iwm_quality_2month.py

Review goal
-----------
Check for look-ahead bias, timing bugs, and methodology issues.
Email findings back to the person who granted developer access.

Not included: your API keys, website secrets, or cloud upload tools.
