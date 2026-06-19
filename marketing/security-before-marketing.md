# Security Before Marketing Checklist

Short answer: private feedback testing can start now, but broad public marketing should wait until the basic security checklist is done.

## Private Testers

For 5-10 known testers, it is acceptable to proceed if:

- Do not collect Stripe, PayPal, bank, or card credentials.
- Use only owner-provided Venmo phone numbers or public checkout links.
- Do not promise permanent hosting yet.
- Keep tester links limited to people you know or directly invite.
- Watch for weird generated content before sharing a site publicly.

## Public Marketing

Before posting widely or inviting strangers, tighten these areas.

### 1. Secrets And Environment

- Confirm `.env.local` and service-account keys are not committed.
- Confirm production uses real secret values, not defaults.
- Confirm Firebase/Firestore permissions are least-privilege.
- Confirm Stripe webhook secrets are required in production.

### 2. Publishing Safety

- Rate-limit `/api/publish` so strangers cannot spam generated sites.
- Add abuse protection for slugs and published assets.
- Ensure production does not fall back to local file storage.
- Add a basic takedown/delete path for bad tester sites.

### 3. Generated HTML Safety

- Continue stripping arbitrary scripts from generated HTML.
- Confirm published HTML cannot execute unexpected AI-generated scripts.
- Keep payment buttons limited to safe attributes and owner-provided links.
- Validate external checkout links before saving.

### 4. Payment Safety

- Do not store Stripe/PayPal credentials in the lite version.
- Make it clear that checkout links belong to the business owner.
- Open checkout links externally instead of handling card data.
- Avoid wording that implies OnePerson Empire processes customer payments.

### 5. SMS / CMS Editing

- Require a strong `SMS_CMS_SECRET` in production.
- Do not expose edit endpoints without a secret or owner verification.
- Keep automatic SMS delivery off until Twilio compliance is ready.
- Log or review SMS-based edits during early testing.

### 6. Invoices

- Make invoice links hard to guess.
- Avoid exposing private customer info in public URLs.
- Make payment instructions configurable and owner-owned.
- Do not send automatic invoices until delivery and abuse controls are ready.

### 7. Basic App Protections

- Add rate limits to AI generation endpoints.
- Add size limits to prompts and uploaded/remote image inputs.
- Add error logging that does not leak secrets.
- Add a simple admin-only way to inspect/remove published sites.

## Minimum Before Broad Launch

Do these before real public marketing:

1. Rate-limit publish and AI endpoints.
2. Confirm no local storage fallback in production.
3. Require production secrets for SMS/webhooks.
4. Validate checkout links and keep credentials out of the app.
5. Add a simple removal/takedown process for published sites.

## Practical Recommendation

Start with private tester outreach now. Do not run ads or post widely until the minimum checklist is complete.
