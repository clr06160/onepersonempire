export type InstructionSection = {
  id: string;
  title: string;
  subtitle?: string;
  backtest?: string;
  body: string[];
  steps?: string[];
  cautions?: string[];
};

export const sharedConcepts: InstructionSection[] = [
  {
    id: 'how-to-read-scanner',
    title: 'How to read the scanner dashboard',
    body: [
      'Each system shows a **Top Names** list — that is the basket you hold for the active rebalance cadence right now.',
      'Raw PowerTrend systems also show **Weekly Basket If PowerTrend ON**. That second list is what you trade when the badge says POWER TREND ON.',
      'The **Saved rebalance date** is the last schedule date the scan used to rank names. It is not necessarily “trade today”; it tells you how fresh the basket is.',
      'When the scan is **live**, the badge shows POWER TREND ON or OFF from yesterday’s completed QQQ signal (no lookahead).',
    ],
  },
  {
    id: 'equal-weight',
    title: 'Position sizing (equal weight)',
    body: [
      'Every system uses **equal weight** across its picks unless noted otherwise.',
      'Top 10 → target ~10% of *invested* capital per name. Top 5 → ~20% per name.',
      'On rebalance day: sell names that dropped out, buy new names, bring everyone back to equal weight.',
      'Between rebalance dates: hold unchanged unless you use a separate exposure overlay (QQQ200 half) described below.',
    ],
  },
  {
    id: 'qqq200-half',
    title: 'QQQ SMA half exposure (core, QQQ50, ML)',
    body: [
      'Used by: Core, Monthly Core, QQQ50 Quality, ML Mixed RF.',
      'Rule: **100% invested** when QQQ is above its SMA; **50% invested** when at or below. Production scanner uses the **200-day SMA**.',
      '**Timing (important):** the signal uses **yesterday’s completed QQQ close** vs yesterday’s SMA. That prior-bar state sets **today’s** exposure. You cannot use today’s live QQQ close intraday and match the backtest.',
      'Example: if QQQ closed above its 200MA yesterday → today you run **100%** of the basket. If it closed at or below → **50%** (each of 10 names ≈ 5% of total equity, not 10%).',
      'The overlay can change daily without waiting for the next stock rebalance. Stock picks still change only on that system’s rebalance schedule (monthly or two-month).',
    ],
  },
  {
    id: 'learned-pain-overlay',
    title: 'Learned pain overlay — core only (LEARNED PAIN - CORE)',
    body: [
      'Daily overlay trained on the **core quality book only** (IWM top 10 · quality · 2-month · QQQ200 half). It estimates the chance of a **>8% drawdown in the next 20 trading days** and scales **total book size** — it does **not** change which stocks are picked.',
      'Badge on the Picks page: **LEARNED PAIN - CORE** with action **FULL GO / HALF SIZE / GO CASH**.',
      '**Thresholds:** pain risk ≥ 79% → CASH (0%) · 32–79% → HALF (50%) · below 32% → FULL (100%).',
      '**Stacking with QQQ200 half:** core already runs 100% or 50% from QQQ200. Learned pain **multiplies on top**. Example: QQQ200 half (50%) × learned HALF (50%) ≈ **25%** effective size. Learned CASH always forces **0%** regardless of QQQ200.',
      'Uses prior-day QQQ momentum, volatility, distance from MAs, and **book drawdown** features. Refreshes daily with the scanner.',
      'Honest walk-forward backtest on core ledger: ~56–59% CAGR / ~−15% max DD vs core ~64% / −26% — you trade return for smoother drawdown.',
    ],
    steps: [
      'Check **LEARNED PAIN - CORE** on the Picks page each weekday (regime bar or system badge).',
      'Apply FULL / HALF / CASH to **total position size** on the core basket — not per-stock exits.',
      'For **Core + Learned Regime** or **Core + Learned + Sharp Stack**, this overlay is built into the system dropdown.',
      'On non-core scans, the footer is optional reference only — ignore unless you explicitly want core-style scaling.',
    ],
    cautions: [
      'Backtested on core quality only — not validated on raw, EMA10, or QQQ scans.',
      'When learned says CASH and sharp pause says CLEAR, learned wins for sizing (unless you use the stack system, where sharp overrides on crash days).',
    ],
  },
  {
    id: 'sharp-day-pause',
    title: 'Sharp day pause overlay',
    body: [
      'If QQQ fell **≥ 3.5%** on the **prior completed day**, go to **100% cash for 7 trading days** (no new risk). Badge: **SHARP PAUSE: CASH** or **SHARP PAUSE: CLEAR**.',
      'When CLEAR, use normal core exposure (including QQQ200 half). When CASH, scale total book to **0%** until days remaining hits zero.',
      'Backtest on core quality: ~70% CAGR / ~−18% max DD — higher return than learned-only, simpler rule.',
    ],
    steps: [
      'Check **Sharp day** on the regime bar each weekday before adding size.',
      'CASH (red): stay flat; do not add until the 7-day window ends.',
      'CLEAR (green): apply normal QQQ200 half sizing to the core book.',
    ],
    cautions: ['Daily refresh only; uses prior completed QQQ bar. ~20 trigger events in 2021–2026 backtest.'],
  },
  {
    id: 'ma-overlay-research',
    title: 'Short SMA overlay research (QQQ 5-day — not adopted)',
    body: [
      'Jun 2026 matrix tests suggested a **5-day QQQ SMA half** overlay looked much better than 200-day in a fast unified tester (e.g. ~113% / −13% IWM quality vs ~46% / −28% at 200d).',
      '**Audit (Jun 2026):** that unified engine was applying same-day QQQ vs SMA to the same day’s return — **lookahead**. After fixing to the **prior-bar rule** (same as production), short-MA numbers collapsed.',
      '**Production validation** (`iwm_powertrend_hybrid_quality_runner`, IWM200 quality 2mo): **QQQ200 half 64.15% / −25.91% / 0 loss years** vs **QQQ5 half 42.94% / −31.13% / 1 loss year**. Shorter SMA is **worse**, not better, on the real engine.',
      '**Verdict:** keep **QQQ200 half** on the live scanner. Do not switch to 5-day or 10-day overlays based on the matrix sweep alone.',
      'Audit files: `reports/qqq_ma_half_audit_2026-06-19_*`, `reports/iwm_ma_half_production_sweep_2026-06-19_qqq5_*`.',
    ],
  },
  {
    id: 'powertrend',
    title: 'PowerTrend ON / OFF (raw aggressive systems)',
    body: [
      'Used by: Raw Top10, Raw Top5, and 191–197% Raw Top5 Quarterly.',
      'PowerTrend is a **QQQ market regime filter**, not a stock pick. It chooses **how often you rebalance** and **which basket list** is active.',
      '**POWER TREND ON** → trade the **weekly** basket (right column on the scanner). Rebalance on the **first trading day of each ISO week** (usually Monday).',
      '**POWER TREND OFF** → trade the **Top Names** basket on the slower cadence (monthly for Raw10/Raw5, quarterly offset for 191–197%).',
      'Signal uses **prior completed day** QQQ data. The scanner badge reflects that rule.',
      'PowerTrend ON requires QQQ to pass several trend checks (price above EMA21 and SMA50, rising EMA21/SMA50, SMA10 above EMA21, and most recent lows holding above EMA21). When the market loses that structure, the model drops to the slower cadence.',
      'These raw systems do **not** use the quality filter or QQQ200 half — full exposure to the raw acceleration basket whenever you are in the market.',
    ],
  },
  {
    id: 'rebalance-calendars',
    title: 'Rebalance calendars (live scanner schedules)',
    body: [
      '**Weekly** — first trading day of each ISO week.',
      '**Monthly** — first trading day of each calendar month.',
      '**Two-month (core)** — first trading day of Jan, Mar, May, Jul, Sep, Nov.',
      '**Quarterly offset1 (191–197% only, when PowerTrend OFF)** — first trading day of Feb, May, Aug, Nov.',
      'Rankings use prices and fundamentals available through the rebalance date (no future data in the backtest).',
    ],
  },
  {
    id: 'acceleration-quality',
    title: 'Acceleration vs quality filter',
    body: [
      '**Acceleration** ranks stocks by positive second-derivative / momentum acceleration in the eligible universe (IWM top 200, QQQ full list, or QQQ top 50).',
      '**Quality filter** (core systems): keep names with **sales growth > 0** and **EBITDA margin > 0** from the latest fundamental data accepted on or before the rebalance date. Then rank by acceleration within survivors.',
      '**Raw** systems skip quality — pure acceleration only, usually more volatile.',
    ],
  },
];

export const systemInstructions: InstructionSection[] = [
  {
    id: 'core',
    title: 'Core: IWM Quality 2-Month',
    subtitle: 'Best core candidate · 64.15% CAGR · −25.91% max DD',
    backtest: 'IWM top 200 → quality → top 10 accel · QQQ200 half · rebalance every 2 months',
    body: [
      'This is the primary “investable” recipe: small/mid-cap IWM liquidity leaders, filtered for basic quality, with a market overlay to cut exposure when QQQ is below its 200-day average.',
    ],
    steps: [
      'On each **two-month** rebalance date (Jan/Mar/May/Jul/Sep/Nov month-open): buy the **Top Names** list, equal weight within invested capital.',
      'Between rebalances: hold those names; do not rotate early unless you choose to manually.',
      '**Daily or weekly:** apply **QQQ200 half** — scale total equity exposure to 100% or 50% based on **yesterday’s** QQQ close vs its 200-day SMA (prior completed bar).',
      'Universe refreshes over time (IWM top 200 by dollar volume); expect some turnover every rebalance.',
    ],
    cautions: [
      'Smaller names than QQQ50 — wider spreads; use limit orders.',
      'Two-month cadence beat monthly core in backtests (~64% vs ~45% CAGR). Do not confuse with monthly QQQ50.',
      'Optional overlays: **Core + Learned + Sharp Stack** (~56% / −14% DD) for best risk-adjusted core variant.',
    ],
  },
  {
    id: 'core-learned-regime',
    title: 'Core + Learned Regime (59% / −15.5% DD)',
    subtitle: 'Smoothest core variant · learned pain built in',
    backtest: 'Same core picks · daily learned FULL/HALF/CASH · QQQ200 half in base ledger',
    body: [
      'Same **Top Names** as Core — this system only changes **how much capital** is deployed via the learned pain model.',
      'Check **LEARNED PAIN - CORE** each weekday. Scale total book: FULL 100% · HALF 50% · CASH 0%.',
    ],
    steps: [
      'Two-month rebalance: update basket to **Top Names**, equal weight within invested capital.',
      'Daily: multiply **total book size** by today’s learned scale (see Learned pain overlay section).',
      'If CASH, hold flat or flatten per your rule — do not add risk until FULL returns.',
    ],
    cautions: [
      'Lower CAGR than plain core in backtest; you are buying shallower drawdown.',
      'Overlay module line on Picks shows when the model last ran vs pick dates.',
    ],
  },
  {
    id: 'core-sharp-day-pause',
    title: 'Core + Sharp Day Pause (70% / −18% DD)',
    subtitle: 'Best single-overlay CAGR on core',
    backtest: 'Same core picks · QQQ −3.5% prior day → 7-day cash pause · QQQ200 half when CLEAR',
    body: [
      'Same **Top Names** as Core plus a **crash pause**: after a sharp QQQ down day, go flat for 7 sessions.',
    ],
    steps: [
      'Two-month rebalance: update basket first.',
      'Daily: if **SHARP PAUSE: CASH**, scale total book to 0%. If **CLEAR**, apply QQQ200 half (100% or 50%).',
    ],
    cautions: ['Higher backtest CAGR than learned-only; slightly deeper DD than learned + sharp stack.'],
  },
  {
    id: 'core-learned-sharp-stack',
    title: 'Core + Learned + Sharp Stack (56% / −14% DD)',
    subtitle: 'Best risk-adjusted core overlay',
    backtest: 'Learned daily scale × sharp pause override to cash on crash days',
    body: [
      'Both overlays on the same core book: **Layer 1** learned pain (FULL/HALF/CASH) · **Layer 2** sharp pause (forces 0% on crash days).',
      'Effective scale = learned scale when sharp is CLEAR; **0% when sharp pause is active** (sharp wins).',
      'Badge shows **STACK: FULL / HALF / CASH** with effective book %.',
    ],
    steps: [
      'Two-month rebalance: same Top Names as Core.',
      'Daily: read **STACK** badge — apply effective book % to total capital.',
      'If STACK: CASH from sharp pause, stay flat even if learned would say FULL or HALF.',
    ],
    cautions: [
      'Lower CAGR than sharp-only (~56% vs ~70%) but best max DD in stack tests (~−14%).',
      'Recommended primary system if you want core quality with both defense layers.',
    ],
  },
  {
    id: 'monthly-core',
    title: 'Prior Core: IWM Quality Monthly',
    subtitle: 'Benchmark · 45.38% CAGR · −26.05% max DD',
    backtest: 'Same as core but monthly rebalance',
    body: [
      'Identical stock logic to core (IWM top 200, quality, top 10 acceleration) and the same QQQ200 half overlay.',
      'Only difference: **monthly** rebalance (first trading day of each month) instead of every two months.',
    ],
    steps: [
      'Month-open: rebalance to **Top Names**, equal weight.',
      'Apply QQQ200 half exposure rule continuously.',
    ],
    cautions: ['Kept as a benchmark; core 2-month superseded it on return with similar drawdown.'],
  },
  {
    id: 'qqq50-quality-qqq200',
    title: 'Large-Cap: QQQ50 Quality + QQQ200 Half',
    subtitle: 'Large-cap quality sleeve · 61.87% CAGR · −24.74% max DD',
    backtest: 'QQQ top 50 liquidity → quality → top 10 · QQQ200 half · monthly',
    body: [
      'Same philosophy as core — quality plus acceleration plus QQQ200 half — but restricted to the **50 most liquid Nasdaq-100 names**.',
      'Easier to trade (AMAT, MU, NVDA-tier liquidity) with backtest return nearly matching core and similar drawdown.',
    ],
    steps: [
      '**Monthly** rebalance: buy **Top Names**, equal weight within invested capital.',
      'Apply **QQQ200 half** daily: 100% if **yesterday’s** QQQ close was above the 200-day SMA, else 50%.',
      'No PowerTrend switch — one cadence, one list.',
    ],
    cautions: [
      'One loss year in backtest vs zero for IWM core — not strictly “safer” on every metric, but names are more liquid.',
      'Monthly, not two-month — do not use core’s Jan/Mar/May calendar for this system.',
    ],
  },
  {
    id: 'ml-mixed-rf-qqq200',
    title: 'Research: ML Accel + RF + QQQ200 Half',
    subtitle: 'Best ML backtest · 90.31% CAGR · −44.81% max DD',
    backtest: 'IWM50 + QQQ50 universe · 50/50 accel z-score + RF 21d forecast · QQQ200 half · monthly',
    body: [
      'Research sleeve — highest return in the ML stack but **much** deeper drawdown than core (−45% vs −26%).',
      'Universe is **IWM top 50 + QQQ top 50** by liquidity. Ranking blends classical acceleration with a walk-forward random-forest 21-day return forecast.',
      'Uses QQQ200 half like core. **Not** quality-filtered.',
    ],
    steps: [
      '**Monthly** rebalance to **Top Names**, equal weight within invested capital.',
      'Apply QQQ200 half overlay daily.',
      'Cadence note from Jun 2026 tests: **2-month vs monthly barely changes** this ML stack (~1 pt CAGR) — unlike IWM quality core, where 2-month mattered a lot.',
    ],
    cautions: [
      'Treat as research / small sleeve size unless you accept −45% historical drawdown.',
      'Live ML ranking can fail if model cache is stale; scanner may fall back to saved rebalance CSV.',
    ],
  },
  {
    id: 'raw10',
    title: 'Aggressive: Raw PowerTrend Top10',
    subtitle: 'Aggressive sleeve · 131.35% CAGR · −38.97% max DD',
    backtest: 'IWM top 200 raw accel top 10 · PowerTrend ON = weekly, OFF = monthly · full exposure',
    body: [
      'Pure acceleration on IWM top 200 — **no quality filter, no QQQ200 half**.',
      'PowerTrend chooses between **weekly** and **monthly** cadence.',
    ],
    steps: [
      'Check scanner badge: **POWER TREND ON** or **OFF**.',
      'If **ON**: hold **Weekly Basket If PowerTrend ON** (right column). Rebalance **weekly** (first trading day of the week). Ignore the monthly Top Names until PowerTrend turns OFF.',
      'If **OFF**: hold **Top Names** (left column). Rebalance **monthly** (first trading day of the month). Ignore the weekly basket until PowerTrend turns ON.',
      'Equal weight across 10 names at full exposure (100% in stocks).',
      'When PowerTrend flips: switch to the other list at the **next rebalance date for that cadence** (next week-start if turning ON, next month-start if turning OFF). The backtest switches return streams daily; practically, align on the next scheduled rebalance for the mode you entered.',
    ],
    cautions: ['High return, high drawdown. Best as a smaller sleeve alongside core.'],
  },
  {
    id: 'raw5',
    title: 'Rocket: Raw PowerTrend Top5',
    subtitle: 'Competition-style · 160.83% CAGR · −58.67% max DD',
    backtest: 'IWM top 200 raw accel top 5 · PowerTrend ON = weekly, OFF = monthly',
    body: [
      'Same PowerTrend hybrid as Raw Top10 but only **5 names** (~20% each at full exposure).',
      'Even more concentrated — competition-style risk.',
    ],
    steps: [
      'Same ON/OFF rules as Raw Top10: weekly basket + weekly rebalance when ON; Top Names + monthly when OFF.',
      'Equal weight across **5** tickers.',
    ],
    cautions: ['Historical max drawdown near −59%. One loss year in backtest.'],
  },
  {
    id: 'raw5-quarterly',
    title: '191–197% Test: Raw Top5 PowerTrend / Quarterly',
    subtitle: 'Highest-return raw hybrid · 197.06% CAGR · −56.67% max DD',
    backtest: 'IWM top 200 raw top 5 · PowerTrend ON = weekly · PowerTrend OFF = quarterly offset1',
    body: [
      'This answers the common question: **No, it is not weekly-only.**',
      'It is a **hybrid**: aggressive weekly rotation when the market is in PowerTrend ON, and a **slow quarterly** hold when PowerTrend is OFF.',
      'That OFF-mode quarterly cadence is what drives the eye-catching ~191–197% backtest CAGR — you trade less often in weak regimes but still jump to weekly when trend is strong.',
    ],
    steps: [
      'Check PowerTrend badge first.',
      '**POWER TREND ON** → trade **Weekly Basket If PowerTrend ON** (5 names). Rebalance **every week** (first trading day of the week). This is the only time you are on weekly rotation.',
      '**POWER TREND OFF** → trade **Top Names** (5 names). Rebalance **quarterly on offset1 calendar**: first trading day of **February, May, August, November** only.',
      'Between quarterly rebalances while OFF: **hold the same 5 names** — do not monthly rotate.',
      'Full exposure (100% in the 5 stocks); no QQQ200 half, no quality filter.',
      'Equal weight: ~20% per name when fully invested.',
    ],
    cautions: [
      'Despite the name, this is **not** a core-style system — drawdown near −57% in backtest.',
      'Do not use monthly Top Names from Raw Top5 for this system when OFF — this variant uses **quarterly** only.',
      'Research / competition use; size accordingly.',
    ],
  },
  {
    id: 'qqq',
    title: 'QQQ Pure Acceleration',
    subtitle: 'Large-cap growth · 31.62% CAGR · −48.23% max DD',
    backtest: 'Full Nasdaq-100 universe · top 10 raw accel · monthly · full exposure',
    body: [
      'Simplest large-cap sleeve: entire QQQ constituent set, top 10 by raw acceleration, monthly rebalance.',
      'No quality filter, no QQQ200 half, no PowerTrend switch.',
    ],
    steps: [
      '**Monthly** rebalance: **Top Names**, equal weight (10% each).',
      'Hold between month-open dates.',
    ],
    cautions: [
      'Weaker risk-adjusted history than IWM quality systems in this research.',
      'Two loss years in backtest.',
    ],
  },
];

export const quickReference: { system: string; when: string; basket: string; sizing: string }[] = [
  {
    system: 'Core 2-month',
    when: 'Jan/Mar/May/Jul/Sep/Nov month-open',
    basket: 'Top Names',
    sizing: 'Equal 10 + QQQ200 half daily',
  },
  {
    system: 'Core + Learned Regime',
    when: '2-month basket · daily learned scale',
    basket: 'Top Names (same as core)',
    sizing: 'Equal 10 × learned FULL/HALF/CASH',
  },
  {
    system: 'Core + Sharp Pause',
    when: '2-month basket · daily pause check',
    basket: 'Top Names (same as core)',
    sizing: 'QQQ200 half when CLEAR; 0% when CASH',
  },
  {
    system: 'Core + Learned + Sharp',
    when: '2-month basket · both overlays daily',
    basket: 'Top Names (same as core)',
    sizing: 'STACK effective % (sharp overrides)',
  },
  {
    system: 'Monthly core',
    when: 'Every month-open',
    basket: 'Top Names',
    sizing: 'Equal 10 + QQQ200 half daily',
  },
  {
    system: 'QQQ50 quality',
    when: 'Every month-open',
    basket: 'Top Names',
    sizing: 'Equal 10 + QQQ200 half daily',
  },
  {
    system: 'ML mixed RF',
    when: 'Every month-open',
    basket: 'Top Names',
    sizing: 'Equal 10 + QQQ200 half daily',
  },
  {
    system: 'Raw Top10',
    when: 'Weekly if PT ON · monthly if PT OFF',
    basket: 'Weekly column if ON else Top Names',
    sizing: 'Equal 10, full exposure',
  },
  {
    system: 'Raw Top5',
    when: 'Weekly if PT ON · monthly if PT OFF',
    basket: 'Weekly column if ON else Top Names',
    sizing: 'Equal 5, full exposure',
  },
  {
    system: '191–197% Raw Top5',
    when: 'Weekly if PT ON · Feb/May/Aug/Nov if PT OFF',
    basket: 'Weekly column if ON else Top Names',
    sizing: 'Equal 5, full exposure',
  },
  {
    system: 'QQQ pure accel',
    when: 'Every month-open',
    basket: 'Top Names',
    sizing: 'Equal 10, full exposure',
  },
];
