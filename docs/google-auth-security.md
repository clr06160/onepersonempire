# Google Auth Platform — branding + security checklist

Use the **same GCP project** as `GOOGLE_OAUTH_CLIENT_ID` / Cloud Run.

## A. Branding (clears “branding is not being shown”)

1. Open **Google Auth Platform → Branding**
2. Fill:
   - App name (e.g. Dream Tree Stocks)
   - User support email
   - Developer contact email
   - App logo (square, ≥120×120)
   - Application home page: `https://dreamtreestocks.com` or `https://onepersonempire.web.app`
   - Privacy Policy / Terms URLs if you have them
3. **Authorized domains** must include:
   - `dreamtreestocks.com`
   - `onepersonempire.web.app`
   - `onepersonempire.firebaseapp.com`
4. Click **Verify** / complete domain ownership (Search Console or DNS TXT as prompted)
5. Until domains verify, Google hides custom branding — that matches the warning you saw

**Data access:** “Verification is not required” is correct for email/profile only. Leave it.

## B. Secure sign-in (code — deployed with the app)

The scanner now:

- Issues a one-time **nonce ticket** (`/api/scanner/auth/google-nonce`)
- Passes `nonce` + FedCM button mode into Google Identity Services
- Rejects ID tokens whose `nonce` does not match

No Console toggle for this beyond keeping a **Web** OAuth client with correct JavaScript origins.

## C. Cross-Account Protection / RISC

### Console (once)

1. Enable **RISC API**: https://console.cloud.google.com/apis/library/risc.googleapis.com
2. Accept the RISC terms
3. **IAM → Service accounts → Create**
   - Name: `risc-config`
   - Role: **RISC Configuration Admin** (`roles/riscconfigs.admin`)
4. Create a **JSON key** for that SA (download once; do not commit)
5. Store the JSON in Cloud Run as secret/env `GOOGLE_RISC_SERVICE_ACCOUNT_JSON` (full JSON string)  
   Or set `GOOGLE_APPLICATION_CREDENTIALS` to a mounted key file on the machine that runs the register script

### Register the receiver

After deploy, from a machine with the SA credentials:

```powershell
cd C:\Users\CoryRoberts\onepersonempire
$env:GOOGLE_RISC_SERVICE_ACCOUNT_JSON = Get-Content -Raw path\to\risc-sa.json
$env:GOOGLE_OAUTH_CLIENT_ID = "<your web client id>"
node scripts/register-google-risc.mjs
```

Receiver URL registered:

`https://onepersonempire.web.app/api/scanner/auth/risc`

(Also registers dreamtreestocks if `RISC_RECEIVER_URL` is set.)

### What it does

Google POSTs security event tokens to that URL. On session/token revoke / account disabled events, we write Firestore `scannerAuthRevocations` and block login/session for that Google `sub` / email.

## D. Smoke test

1. Incognito → `/scanner` → Sign in with Google (should work)
2. Confirm nonce: login without ticket should fail (API only)
3. After RISC register, security overview “cross-account protection” should clear once Google detects a configured stream
