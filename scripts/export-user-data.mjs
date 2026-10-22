#!/usr/bin/env node
import { createHash } from 'node:crypto';
import process from 'node:process';
import pg from 'pg';

const { Pool } = pg;

function usage(message) {
  if (message) console.error(`Error: ${message}`);
  console.error('Uso: export-user-data.mjs (--email EMAIL | --user-id UUID) [--pretty]');
  process.exit(2);
}

function parseArgs(argv) {
  const args = { pretty: false, email: null, userId: null };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--pretty') args.pretty = true;
    else if (value === '--email') args.email = argv[++i] || usage('Falta el email.');
    else if (value === '--user-id') args.userId = argv[++i] || usage('Falta el UUID.');
    else usage(`Argumento no reconocido: ${value}`);
  }
  if ((args.email ? 1 : 0) + (args.userId ? 1 : 0) !== 1) {
    usage('Indica exactamente --email o --user-id.');
  }
  return args;
}

function assertNoForbiddenFields(value) {
  const forbidden = [
    'passwordHash', 'guestTokenHash', 'stripeCustomerId', 'stripeSubscriptionId',
    'apiKey', 'apiKeyHash', 'tokenHash', 'codeHash', 'supportSessionId',
  ];
  const text = JSON.stringify(value);
  for (const field of forbidden) {
    if (text.includes(`"${field}"`)) throw new Error(`Campo prohibido detectado: ${field}`);
  }
}

function rows(result) {
  return result.rows;
}

const args = parseArgs(process.argv.slice(2));
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL es obligatorio.');

const pool = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 5_000 });
try {
  const client = await pool.connect();
  try {
    const selector = args.email
      ? { sql: 'select id, name, email, image, "careerProfile", "createdAt" from "user" where lower(email) = lower($1) limit 2', value: args.email }
      : { sql: 'select id, name, email, image, "careerProfile", "createdAt" from "user" where id = $1 limit 2', value: args.userId };
    const userResult = await client.query(selector.sql, [selector.value]);
    if (userResult.rowCount !== 1) throw new Error(userResult.rowCount === 0 ? 'No se encontró la cuenta.' : 'El selector devuelve más de una cuenta.');
    const user = userResult.rows[0];
    const userId = user.id;

    const cvs = rows(await client.query('select * from "cv" where "userId" = $1 order by "createdAt", id', [userId]));
    const offers = rows(await client.query('select * from "job_offer" where "userId" = $1 order by "createdAt", id', [userId]));
    const userCompanies = rows(await client.query('select * from "user_company" where "userId" = $1 order by "createdAt", "companyId"', [userId]));
    const companyNotes = rows(await client.query('select * from "company_note" where "userId" = $1 order by "createdAt", id', [userId]));
    const applicationViews = rows(await client.query('select * from "application_view" where "userId" = $1 order by "createdAt", id', [userId]));
    const researchRuns = rows(await client.query(
      `select * from "job_research_run" where "userId" = $1 and "status" not in ('queued', 'running') order by "createdAt", id`,
      [userId],
    ));
    const runIds = researchRuns.map((row) => row.id);
    const agentRuns = runIds.length
      ? rows(await client.query('select * from "job_research_agent_run" where "researchRunId" = any($1::uuid[]) order by "createdAt", id', [runIds]))
      : [];
    const agentRunIds = agentRuns.map((row) => row.id);
    const researchSources = runIds.length
      ? rows(await client.query('select * from "job_research_source" where "researchRunId" = any($1::uuid[]) order by "createdAt", id', [runIds]))
      : [];

    const companyIds = [...new Set([
      ...userCompanies.map((row) => row.companyId),
      ...companyNotes.map((row) => row.companyId),
      ...offers.map((row) => row.companyId).filter(Boolean),
    ])];
    const companies = companyIds.length
      ? rows(await client.query('select * from "company" where id = any($1::uuid[]) order by "nameNormalized", id', [companyIds]))
      : [];
    const companyIcons = companyIds.length
      ? rows(await client.query('select * from "company_icon" where "companyId" = any($1::uuid[]) order by "companyId"', [companyIds]))
      : [];

    // Optional versioned extension; older databases and package consumers remain usable.
    const continuityTables = await client.query("select to_regclass('public.cv_export') as exports, to_regclass('public.application_event') as events, to_regclass('public.profile_evidence') as evidence");
    const available = continuityTables.rows[0];
    const continuity = available.exports && available.events && available.evidence ? {
      version: 1,
      exports: rows(await client.query('select e.*, d.bytes from cv_export e join cv_export_data d on d."exportId" = e.id where e."userId" = $1 order by e."createdAt", e.id', [userId])),
      events: rows(await client.query('select * from application_event where "userId" = $1 order by "createdAt", id', [userId])),
      evidence: rows(await client.query('select * from profile_evidence where "userId" = $1 order by "createdAt", id', [userId])),
    } : undefined;

    const data = {
      format: 'matchply-user-data',
      version: 1,
      source: { sourceId: user.id, email: user.email, exportedAt: new Date().toISOString() },
      user,
      ...(continuity ? { continuity } : {}),
      cvs,
      companies,
      companyIcons,
      userCompanies,
      companyNotes,
      jobOffers: offers,
      applicationViews,
      jobResearchRuns: researchRuns,
      jobResearchAgentRuns: agentRuns,
      jobResearchSources: researchSources,
    };
    assertNoForbiddenFields(data);
    const payload = JSON.stringify(data);
    const payloadSha256 = createHash('sha256').update(payload).digest('hex');
    data.manifest = {
      payloadSha256,
      counts: Object.fromEntries([
        ['cvs', cvs.length], ['companies', companies.length], ['companyIcons', companyIcons.length],
        ['userCompanies', userCompanies.length], ['companyNotes', companyNotes.length],
        ['jobOffers', offers.length], ['applicationViews', applicationViews.length],
        ['jobResearchRuns', researchRuns.length], ['jobResearchAgentRuns', agentRuns.length],
        ['jobResearchSources', researchSources.length],
      ]),
      excluded: ['auth', 'billing', 'extension-secrets', 'support-sessions', 'audit-log', 'global-config', 'pending-jobs'],
    };
    const output = JSON.stringify(data, null, args.pretty ? 2 : 0);
    process.stdout.write(output + '\n');
    console.error(JSON.stringify({ email: user.email, sourceId: user.id, counts: data.manifest.counts, payloadSha256 }));
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}

