<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Products (same Cloud Run service)

| Product | URL | Code |
|---|---|---|
| Stock scanner (Dream Tree) | https://dreamtreestocks.com | `app/scanner/`, `app/api/scanner/`, `lib/scanner-*` |
| Website builder | https://onepersonempire.web.app/ | builder / `components/builder/` |

## Cursor Cloud — deploy without browser login

Desktop agents on Cory’s Windows PC used an already-logged-in `gcloud`. Cloud VMs do **not** inherit that. Do **not** run `gcloud auth login` in a browser.

**After one-time setup** (Cory runs `scripts/setup-cursor-deploy-sa.bat` on PC, then adds Cursor Secrets `GCP_SA_KEY` + `GCP_PROJECT_ID`):

```bash
bash scripts/deploy-cloud-run.sh
```

That activates the service account from secrets and deploys `onepersonempire` to `us-central1`.

If `GCP_SA_KEY` is missing, tell Cory to finish the bat + Secrets steps — do not invent Google login flows.
