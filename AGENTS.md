<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

This repo is a single Next.js 16 / React 19 app (package manager: **npm**, lockfile `package-lock.json`) that hosts two products behind one deployment, routed by host/path via `proxy.ts`:
- **OnePerson Empire** builder at `/` (and `/builder`) — AI landing-page builder + publishing.
- **Private Stock Scanner** at `/scanner` — Google-sign-in-gated market dashboard.

Standard commands (see `package.json` scripts and `README.md`):
- Dev server: `npm run dev` → http://localhost:3000 (Turbopack; boots in well under a minute).
- Lint: `npm run lint`  •  Tests: `npm test` (`node --test --experimental-strip-types` over `lib/**/*.test.ts`)  •  Build: `npm run build` (`next build --webpack`).

Non-obvious notes:
- The app boots and runs **with no env vars set** — external integrations degrade gracefully in dev, so you don't need secrets just to start it. There is no `.env.example` despite the README mentioning one; env vars come from `README.md`.
- Builder AI actions ("Build My Site", refine copy, image generation) require `GEMINI_API_KEY`. Without it, use the **"Load Demo Site (No AI)"** button on the home page to exercise the builder end-to-end offline.
- Publishing works fully offline in dev: `POST /api/publish` writes JSON to `data/published-sites/` (gitignored) and the live site is served at `/s/<slug>`. The pre-publish safety review calls Gemini and degrades to `needs_review` (still publishes) when `GEMINI_API_KEY` is missing. Local-file publishing only throws when `NODE_ENV=production`.
- The `/scanner` product is gated by Google OAuth + an email allowlist; to sign in you need `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_ID`, `SCANNER_AUTH_SECRET`, and your email in `SCANNER_ALLOWED_EMAILS`/`SCANNER_DEVELOPER_EMAILS`. Scanner data is produced by an external job and read from `scanner-data/`/`data/scanner/` or GCS; pages show a friendly "waiting for data" state when absent.
- Pre-existing (not environment) issues at HEAD, so don't treat them as setup failures: `npm run lint` reports errors in committed code, and `npm test` fails because `lib/builder/avatar-html.ts` imports `./page-templates` without a file extension, which `node --test --experimental-strip-types` cannot resolve.
