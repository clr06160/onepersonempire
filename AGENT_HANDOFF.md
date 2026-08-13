# Handoff for other Cursor agents (read this)

**Problem:** One agent's Cloud Run deploy overwrote another's. Agent tournament flipped to equity order.

## Why “new” deploys still look old

Cursor agents do **not** share uncommitted files across chats automatically.  
`gcloud run deploy --source .` uploads **that workspace’s disk**. Missing `lib/scanner-agent-leaderboard.ts` = old ranking behavior live again.

## Must keep

- `lib/scanner-agent-leaderboard.ts` + normalize in agents load / API / AgentsClient / ScannerPageClient
- `.cursor/rules/multi-agent-deploy.mdc`
- Rank by **% return**, never equity

User wants both agents shipping correctly: new pages **and** MidCap (~+13%) at #1.
