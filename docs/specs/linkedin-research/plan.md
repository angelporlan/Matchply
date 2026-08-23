# Implementation plan and traceability

| Area | Implementation | Verification |
|---|---|---|
| Pairing | `/api/extension/pairings`, `/api/extension/pair/claim`, revocation, hashed sessions | `src/lib/extension-auth.ts`, route checks, manual Chrome flow |
| Direct ingestion | `/api/extension/linkedin/ingest`, normalized payload, idempotent external identity | `src/lib/extension-service.ts`, external API compatibility |
| Persistence | Drizzle schema + migration `0010_dusty_norrin_radd.sql` | `npm run db:generate`, `npm run db:migrate` in a database |
| Queue | PostgreSQL rows, lease, retry/backoff, worker service | `scripts/research-worker.ts` and Docker compose configuration |
| Research | Tavily search, safe fetch, five agents, JSON synthesis, projections | `src/lib/research/*`, contract tests |
| Dashboard | Integrations pairing/usage and offer Investigation tab | `LinkedInExtensionConsole`, `ResearchPanel` |
| MCP | `investigar_oferta` and `consultar_investigacion` | `/api/mcp` tool list/call |
| Migration | JSON/JSONL legacy importer through external API without auto-research | `scripts/migrate-legacy-linkedin.ts` |
