-- Activation funnel from audit_log (Drizzle name: auditLogs).
-- The physical table is audit_log. Columns are camelCase and must be quoted.
-- A successful claim copies audit_log."userId" (and actor/affected ids) from
-- the guest onto the new account before the guest row is deleted. Without
-- that copy, onDelete set null would drop optimize and download from the user.
-- Optimize and download can precede user_register. Activation is both events
-- within 5 minutes, counted among registered users.
--
-- Local only (docker compose maps Postgres to 127.0.0.1:5433):
--   psql "postgresql://postgres@127.0.0.1:5433/nextprof_db" -f scripts/activation-funnel.sql
-- Do not run this against production.

WITH registers AS (
  SELECT "userId", MIN("createdAt") AS registered_at
  FROM audit_log
  WHERE action = 'user_register' AND "userId" IS NOT NULL
  GROUP BY "userId"
),
optimizes AS (
  SELECT "userId", MIN("createdAt") AS optimized_at
  FROM audit_log
  WHERE action = 'cv_optimize_ai' AND "userId" IS NOT NULL
  GROUP BY "userId"
),
downloads AS (
  SELECT "userId", MIN("createdAt") AS downloaded_at
  FROM audit_log
  WHERE action = 'cv_download_pdf' AND "userId" IS NOT NULL
  GROUP BY "userId"
),
funnel AS (
  SELECT
    (SELECT COUNT(*) FROM registers) AS registered,
    (SELECT COUNT(*) FROM registers r JOIN optimizes o ON o."userId" = r."userId") AS optimized,
    (SELECT COUNT(*) FROM registers r
       JOIN optimizes o ON o."userId" = r."userId"
       JOIN downloads d ON d."userId" = r."userId") AS downloaded,
    (SELECT COUNT(*) FROM registers r
       JOIN optimizes o ON o."userId" = r."userId"
       JOIN downloads d ON d."userId" = r."userId"
       WHERE d.downloaded_at >= o.optimized_at
         AND d.downloaded_at - o.optimized_at < interval '5 minutes') AS activated_within_5_min
)
SELECT
  registered,
  optimized,
  downloaded,
  activated_within_5_min,
  CASE
    WHEN registered = 0 THEN 0
    ELSE round(100.0 * activated_within_5_min / registered, 1)
  END AS activated_pct
FROM funnel;
