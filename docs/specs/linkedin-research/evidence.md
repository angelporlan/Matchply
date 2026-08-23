# Verification evidence

## Static checks

- `npm run db:generate` — passed; generated migration `drizzle/0010_dusty_norrin_radd.sql`.
- `npx drizzle-kit check` — passed; migration journal and snapshots are internally consistent.
- `npm run typecheck` — passed after the Matchply and worker changes.
- `npm test` — passed: 3 contract tests (SSRF guard and score/confidence bounds).
- `npm run build` — passed with network access for the existing Google Fonts configuration; all new API/dashboard/worker imports compiled.
- `node --check` for `teng/extension/background.js`, `content.js`, and `popup.js` — passed.
- `python3 -m json.tool teng/extension/manifest.json` — passed.
- `npm run lint` — not executed to completion because this repository has no ESLint configuration and Next.js opened its interactive setup prompt; no configuration was created automatically.

## Contract tests

`npm test` covers public URL/SSRF validation and score/confidence bounds. Database-backed pairing, quota, lease, and end-to-end browser checks require a running PostgreSQL instance and a Chrome session and should be run in deployment staging.

## Deployment checks still required

1. Apply the expand-only migration with `npm run db:migrate` against staging. Local Docker verification was blocked because the Docker daemon was not running.
2. Configure `TAVILY_API_KEY`, `RESEARCH_PIPELINE_ENABLED`, and PRO model credentials.
3. Run the worker with the feature flag disabled, then enable it for a PRO test account.
4. Complete pairing → LinkedIn capture → queued run → worker → dashboard polling using a real Chrome profile.
