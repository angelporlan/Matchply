-- Upgrade only the original default bodies. Preserve edited copy and every
-- usage counter, and publish the copy change as a new experiment/config version.
WITH source AS (
  SELECT id, version, config AS previous,
    jsonb_set(jsonb_set(config, '{paywall,copy,a,es,body}',
      CASE WHEN config #>> '{paywall,copy,a,es,body}' = 'Conserva esta candidatura y prepara la siguiente. PRO incluye versiones de CV sin límite y {generalAiMonthly} acciones de IA al mes.'
        THEN to_jsonb('Conserva esta candidatura y prepara la siguiente. Con PRO puedes guardar {maxCvs} CVs y utilizar {generalAiMonthly} acciones de IA al mes.'::text)
        ELSE config #> '{paywall,copy,a,es,body}' END), '{paywall,copy,a,en,body}',
      CASE WHEN config #>> '{paywall,copy,a,en,body}' = 'Keep this application and prepare the next. PRO includes unlimited resume versions and {generalAiMonthly} AI actions per month.'
        THEN to_jsonb('Keep this application and prepare the next. With PRO, save {maxCvs} resumes and use {generalAiMonthly} AI actions per month.'::text)
        ELSE config #> '{paywall,copy,a,en,body}' END) AS revised
  FROM plan_config
  WHERE id = 1 AND (
    config #>> '{paywall,copy,a,es,body}' = 'Conserva esta candidatura y prepara la siguiente. PRO incluye versiones de CV sin límite y {generalAiMonthly} acciones de IA al mes.'
    OR config #>> '{paywall,copy,a,en,body}' = 'Keep this application and prepare the next. PRO includes unlimited resume versions and {generalAiMonthly} AI actions per month.'
  )
  FOR UPDATE
), updated AS (
  UPDATE plan_config target SET
    version = source.version + 1,
    config = jsonb_set(jsonb_set(source.revised, '{version}', to_jsonb(source.version + 1)),
      '{paywall,experimentVersion}', to_jsonb((source.previous #>> '{paywall,experimentVersion}')::integer + 1)),
    "updatedByUserId" = NULL,
    "updatedAt" = now()
  FROM source WHERE target.id = source.id
  RETURNING target.version, target.config, source.previous
), history AS (
  INSERT INTO plan_config_history (version, config, "updatedByUserId")
  SELECT version, config, NULL FROM updated
  RETURNING id
)
INSERT INTO audit_log (action, category, details)
SELECT 'plan_default_copy_repair', 'admin',
  jsonb_build_object('version', version, 'previous', previous, 'next', config)::text
FROM updated;
