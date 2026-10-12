-- Introduce a separate delivery allowance; historical research usage and all
-- existing reservations retain their original accounting. New research uses general AI.
WITH source AS (
  SELECT id, version, config AS previous,
    replace(replace(replace(config::text,
      '{researchMonthly} investigaciones profundas', '{discoveryMonthly} candidaturas encontradas por IA'),
      '{researchMonthly} deep research reports', '{discoveryMonthly} jobs found by AI'),
      '{researchMonthly}', '{discoveryMonthly}')::jsonb AS renamed
  FROM plan_config
  WHERE id = 1 AND NOT (config->'free' ? 'discoveryMonthly')
  FOR UPDATE
), limits AS (
  SELECT *, jsonb_set(jsonb_set(jsonb_set(renamed,
    '{free}', ((previous->'free') - 'researchMonthly') || '{"discoveryMonthly":10}'::jsonb),
    '{pro}', ((previous->'pro') - 'researchMonthly') || '{"discoveryMonthly":100}'::jsonb),
    '{guest}', ((previous->'guest') - 'researchMonthly') || '{"discoveryMonthly":10}'::jsonb) AS revised
  FROM source
), updated AS (
  UPDATE plan_config target SET
    version = limits.version + 1,
    config = jsonb_set(jsonb_set(limits.revised, '{version}', to_jsonb(limits.version + 1)),
      '{paywall,experimentVersion}', to_jsonb((limits.previous #>> '{paywall,experimentVersion}')::integer + 1)),
    "updatedByUserId" = NULL, "updatedAt" = now()
  FROM limits WHERE target.id = limits.id
  RETURNING target.version, target.config, limits.previous
), history AS (
  INSERT INTO plan_config_history (version, config, "updatedByUserId")
  SELECT version, config, NULL FROM updated
  RETURNING id
)
INSERT INTO audit_log (action, category, details)
SELECT 'plan_discovery_allowance_migration', 'admin',
  jsonb_build_object('version', version, 'previous', previous, 'next', config)::text
FROM updated;
