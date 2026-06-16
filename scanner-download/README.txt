OnePersonEmpire Stock Scanner Code Pack
======================================

Developer download: raw Python only.

What is included
----------------
- scanners/   one Python file per dashboard scanner
- shared/     shared modules imported by those scanners
- manifest.json   maps website scanner IDs to Python files

What is NOT included
--------------------
- No .env files, API keys, or cloud upload scripts
- No HTML dashboard or website upload tooling
- No price/fundamental cache data (bring your own)

Setup
-----
1. Unzip anywhere on your machine.
2. Create a Python environment and install packages from requirements.txt.
3. Point the shared modules at your own local price and fundamentals data,
   or run from your own research project root with these files on PYTHONPATH.
4. Run a scanner directly, for example:
   python scanners/core_iwm_quality_2month.py

Scanner list
------------
See manifest.json for the mapping between website dropdown IDs and Python files.
