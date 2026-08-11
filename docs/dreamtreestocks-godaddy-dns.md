# dreamtreestocks.com — GoDaddy DNS checklist

Keep nameservers on GoDaddy (`ns63` / `ns64.domaincontrol.com`). Do **not** move DNS for this pass.

## 1) Web (Firebase Hosting → Cloud Run)

Observed live DNS / status (as of setup):

| Type | Host | Value | Notes |
|------|------|-------|--------|
| A | `@` | `199.36.158.100` | Apex → Firebase Hosting |
| TXT | `@` | `hosting-site=onepersonempire` | Ownership proof |
| CNAME | `www` | **`onepersonempire.web.app`** | **Required.** Firebase wants this (do **not** point `www` at `@` / apex). |

### Fix www (SSL / 404 until this is done)

Firebase status now:

- `dreamtreestocks.com` → **HOST_ACTIVE** / **OWNERSHIP_ACTIVE**
- `www.dreamtreestocks.com` → **HOST_ACTIVE** / **OWNERSHIP_ACTIVE**, required DNS:

| Type | Host | Value | Action |
|------|------|-------|--------|
| CNAME | `www` | `onepersonempire.web.app` | ADD (replace old CNAME) |

1. GoDaddy → DNS for `dreamtreestocks.com`
2. Delete any `www` record that points at `dreamtreestocks.com`
3. Add **CNAME** Host=`www` → `onepersonempire.web.app`
4. Wait a few minutes; `https://www.dreamtreestocks.com/scanner` should match apex.

### Apex smoke (already working)

- `https://dreamtreestocks.com/` → jumps to `/scanner` (static handoff + proxy)
- `https://dreamtreestocks.com/scanner` → Dream Tree Stocks brochure / login
- `https://onepersonempire.web.app/` → builder (unchanged)

## 2) Mail (Resend → `alerts@dreamtreestocks.com`)

In [Resend](https://resend.com) → Domains → add **`dreamtreestocks.com`**, then add whatever rows Resend shows (typical):

| Type | Host | Value |
|------|------|-------|
| TXT | `@` or Resend host | SPF include for Resend |
| CNAME / TXT | Resend DKIM hosts | DKIM keys Resend gives you |
| TXT | `_dmarc` | `v=DMARC1; p=none;` (if Resend asks) |

Then on Cloud Run service **onepersonempire**:

```text
RESEND_API_KEY=<from Resend>
SCANNER_ALERT_FROM_EMAIL=Flight Deck <alerts@dreamtreestocks.com>
PRODUCT_BASE_URL=https://dreamtreestocks.com
NEXT_PUBLIC_PRODUCT_BASE_URL=https://dreamtreestocks.com
```

(`SCANNER_ALERT_FROM_EMAIL` and product URLs are already set; **`RESEND_API_KEY` is required** for branded From.)

## 3) Smoke test

1. Open `https://dreamtreestocks.com/scanner` → brochure + Google sign-in.
2. Sign in → Flight Deck.
3. First time only: onboarding panel → **Got it · turn alerts on**.
4. Second visit: no onboarding, straight to desk.
5. Alerts → **Send test** → inbox From `Flight Deck <alerts@dreamtreestocks.com>`, footer links to `https://dreamtreestocks.com/scanner/cockpit`.
