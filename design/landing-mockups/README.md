# Landing page mockups

## IMPORTANT — two different "landing pages" (don't conflate)

1. **OPE's own homepage** — one page, lives at root domain, sells the builder to any visitor. Cannot be personalized per anonymous user. Still needs its own (non-trade-specific) design.
2. **The contractor's generated site** — what the builder OUTPUTS. The truck / cleaning / landscaping designs belong HERE as templates, not as OPE's marketing homepage.

**Vertical marketing = routing, not detection.** Don't try to show different homepages to different anonymous users. Instead: trade-specific ad → trade-specific URL (`/trades`, `/cleaning`, `/landscaping`) → same builder underneath. Root homepage can show a rotating *showcase* of vertical designs so everyone sees their trade.

**One asset, three jobs:** each vertical hero (e.g. truck) works as (a) a builder template/output, (b) a showcase example on the root homepage, (c) the hero of its `/vertical` ad landing page.

Open question (user skipped, revisit): design OPE's own homepage vs. wire these as builder templates vs. build a `/trades` ad page first.

---

## Chosen direction (saved for homepage)

**Metaphor over slogan — show the trade is understood, never say it out loud.**
Direction rule: no tacky emotional copy ("we know you love your truck"). Use a symbol of quality + restrained type. One small subtle line max ("for contractors who take pride in their work").

NOTE: the truck/vertical heroes below are best used as **builder templates / output + vertical ad pages**, not necessarily OPE's root homepage (see two-page note above).

| File | Role | Notes |
|------|------|-------|
| [`../../assets/ope-meta-truck-cinematic.png`](../../assets/ope-meta-truck-cinematic.png) | **Lead hero** — "Built to be seen." | Cinematic rim-lit blacked-out lifted truck on pure black. Hairline call-outs map truck parts to features (site / best work / quotes & invoices / text to update). 4-up feature row below. |
| [`../../assets/ope-meta-level-bubble.png`](../../assets/ope-meta-level-bubble.png) | **Clean alt** — "Dialed in." | Spirit-level bubble dead-center as precision symbol. Most subtle/restrained. Phone-frame, site preview card below. |

**When implementing the truck hero:** keep the cinematic high-contrast image, single emerald accent, oversized serif headline. On mobile, stack the truck above a labeled feature list instead of keeping pointer lines (lines get cramped at phone width — see mobile frame in cinematic-v2). Builder textarea stays below the fold.

---

## Good — keep for reference

### Metaphor round (show-don't-tell explorations)

| File | Concept |
|------|---------|
| [`../../assets/ope-meta-truck-cinematic-v2.png`](../../assets/ope-meta-truck-cinematic-v2.png) | Most badass truck — 3/4 front, LED bar, wet asphalt. Mobile already stacks labels cleanly. Alt to lead hero. |
| [`../../assets/ope-meta-truck-system.png`](../../assets/ope-meta-truck-system.png) | Original concept — illustrated service-body truck, parts → features (too "fleet"). |
| [`../../assets/ope-meta-tight-joint.png`](../../assets/ope-meta-tight-joint.png) | "Tight work speaks for itself" — flawless miter joint quality cue + review card. |
| [`../../assets/ope-meta-organized-rig.png`](../../assets/ope-meta-organized-rig.png) | "Run it like your rig" — immaculate van upfit = all-in-one tidy system (slightly literal). |

### Formula generalizes beyond trades (proof the niche isn't truck-only)

Same dark editorial + symbol-of-pride formula, no truck. Use as vertical templates / `/cleaning`, `/landscaping` ad pages.

| File | Vertical / headline |
|------|---------------------|
| [`../../assets/ope-meta-cleaning.png`](../../assets/ope-meta-cleaning.png) | Cleaning (woman-owned) — "Spotless, end to end." Pristine sunlit room. Mobile stacks labels cleanly. |
| [`../../assets/ope-meta-landscaping.png`](../../assets/ope-meta-landscaping.png) | Landscaping — "Sharp lines. Clean reputation." Striped lawn at golden hour. |

### Nike editorial (prior pick, now reference)

| File | Notes |
|------|--------|
| [`../../assets/ope-a-nike-editorial-bold.png`](../../assets/ope-a-nike-editorial-bold.png) | Bold editorial, trades pride, forest green. Superseded by metaphor truck hero. |

### Interactive A / B / C

| File | Concept |
|------|---------|
| [`public/landing-mockups.html`](../../public/landing-mockups.html) | Full browser tabs — `npm run dev` → http://localhost:3000/landing-mockups.html |
| Cursor canvas `ope-landing-mockups.canvas.tsx` | Same three in IDE |

- **A · Field Phone** — contractor ops hero (positioning baseline)
- **B · No Dashboard** — SMS Care thread visual
- **C · Estimate First** — painter pilot page

### A polish round (Carrd-level experiments)

| File | Direction |
|------|-----------|
| [`../../assets/ope-landing-a-v2-light-carrd-polish.png`](../../assets/ope-landing-a-v2-light-carrd-polish.png) | Light, airy + phone SMS |
| [`../../assets/ope-landing-a-v3-dark-premium.png`](../../assets/ope-landing-a-v3-dark-premium.png) | Dark + browser/phone previews |
| [`../../assets/ope-landing-a-v4-carrd-center-preview.png`](../../assets/ope-landing-a-v4-carrd-center-preview.png) | Centered hero + site preview |

---

## Rejected (creative inspiration round only)

Apple, Stripe, Linear, Swiss/Bauhaus, Airbnb comps — user pass. **Nike editorial from that round is the keeper** (see top).

---

## Notes when revisiting

- **Homepage lead:** Nike editorial energy + **A** copy/structure from HTML mockup
- **Section steal:** B’s SMS thread below hero
- **Subpage:** C for painter pilot (`/painters`)
