# Scanner Deploy Pipeline

Use this for scanner-only site updates so unrelated builder work does not get deployed by accident.

## Quick Path

1. Check only scanner files changed:
   `git status --short app/scanner app/api/scanner`
2. Lint scanner files:
   `npm run lint -- app/scanner/ScannerPageClient.tsx app/scanner/requests/ScannerRequestsClient.tsx app/scanner/requests/page.tsx app/api/scanner/requests/route.ts app/api/scanner/requests/results/route.ts`
3. Build:
   `npm run build`
4. Stage only intended scanner files:
   `git add app/scanner/ScannerPageClient.tsx app/scanner/requests app/api/scanner/requests`
5. Commit:
   `git commit -m "Add scanner request board"`
6. Deploy from a clean worktree at the commit:
   `git worktree add ../onepersonempire-scanner-deploy HEAD`
   `cd ../onepersonempire-scanner-deploy`
   `gcloud run deploy onepersonempire --source . --region us-central1 --allow-unauthenticated`
7. Verify:
   `https://onepersonempire.web.app/scanner`
   `https://onepersonempire.web.app/scanner/requests`

## Rule

Do not deploy from a dirty working tree. If unrelated builder/site files are dirty, deploy from a clean worktree.
