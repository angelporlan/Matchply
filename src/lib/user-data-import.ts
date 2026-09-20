import { createHash, randomUUID } from 'node:crypto';
import { and, eq, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  applicationViews,
  companyIcons,
  companies,
  companyNotes,
  cvs,
  jobOffers,
  jobResearchAgentRuns,
  jobResearchRuns,
  jobResearchSources,
  userCompanies,
  users,
} from '@/db/schema';
import { insertCriticalAuditLog } from '@/lib/audit';

type AnyRow = Record<string, any>;

export class UserDataImportError extends Error {
  status: 400 | 409 = 400;
}

const MAX_ITEMS = {
  cvs: 100,
  companies: 2_000,
  companyIcons: 2_000,
  userCompanies: 2_000,
  companyNotes: 5_000,
  jobOffers: 10_000,
  applicationViews: 100,
  jobResearchRuns: 10_000,
  jobResearchAgentRuns: 30_000,
  jobResearchSources: 50_000,
};

const FORBIDDEN_KEYS = new Set([
  'passwordHash',
  'guestTokenHash',
  'stripeCustomerId',
  'stripeSubscriptionId',
  'apiKey',
  'apiKeyHash',
  'tokenHash',
  'codeHash',
  'supportSessionId',
]);

const CV_FIELDS = ['id', 'title', 'content', 'isBase', 'isPrincipal', 'templateName', 'accentColor', 'fontFamily', 'pageMargin', 'scale', 'createdAt', 'updatedAt'];
const COMPANY_FIELDS = ['id', 'name', 'nameNormalized', 'website', 'location', 'sector', 'iconHash', 'createdAt', 'updatedAt'];
const NOTE_FIELDS = ['id', 'companyId', 'content', 'createdAt', 'updatedAt'];
const VIEW_FIELDS = ['id', 'name', 'isDefault', 'config', 'createdAt', 'updatedAt'];
const OFFER_FIELDS = [
  'id', 'title', 'company', 'url', 'platform', 'description', 'status', 'source', 'externalSource', 'externalId',
  'livenessStatus', 'sourceMetadata', 'scoreOverall', 'scoreBreakdown', 'matchInputHash', 'matchKind', 'matchEvidence',
  'matchDetails', 'matchEvaluatedAt', 'tldr', 'redFlags', 'legitimacyTier', 'rawReport', 'targetProofPoints',
  'coverLetter', 'outreachMessage', 'interviewQuestions', 'nextFollowupDate', 'rejectionPatternTags', 'createdAt', 'updatedAt',
];
const RESEARCH_FIELDS = [
  'id', 'jobOfferId', 'status', 'trigger', 'attempt', 'leaseUntil', 'nextAttemptAt', 'quotaPeriodStart', 'engineVersion',
  'lastError', 'scoreOverall', 'confidence', 'report', 'startedAt', 'completedAt', 'createdAt', 'updatedAt',
];
const AGENT_FIELDS = ['id', 'researchRunId', 'role', 'provider', 'model', 'status', 'result', 'error', 'startedAt', 'completedAt', 'createdAt'];
const SOURCE_FIELDS = ['id', 'researchRunId', 'agentRunId', 'url', 'canonicalUrl', 'title', 'domain', 'sourceType', 'publishedAt', 'retrievedAt', 'excerpt', 'contentHash', 'confidence', 'createdAt'];

function fail(message: string, status: 400 | 409 = 400): never {
  const error = new UserDataImportError(message);
  error.status = status;
  throw error;
}

function object(value: unknown, label: string): AnyRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} debe ser un objeto.`);
  return value as AnyRow;
}

function string(value: unknown, label: string): string;
function string(value: unknown, label: string, options: { nullable: true }): string | null;
function string(value: unknown, label: string, options: { nullable?: boolean } = {}) {
  if (value == null && options.nullable) return null;
  if (typeof value !== 'string' || value.length > 2_000_000) fail(`${label} no es válido.`);
  return value;
}

function uuid(value: unknown, label: string) {
  const result = string(value, label);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) fail(`${label} no es un UUID.`);
  return result;
}

function date(value: unknown, label: string): Date | null;
function date(value: unknown, label: string, nullable: false): Date;
function date(value: unknown, label: string, nullable: true): Date | null;
function date(value: unknown, label: string, nullable = true): Date | null {
  if (value == null && nullable) return null;
  if (typeof value !== 'string' && !(value instanceof Date)) fail(`${label} no es una fecha.`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) fail(`${label} no es una fecha válida.`);
  return parsed;
}

function rows(value: unknown, label: string, max: number): AnyRow[] {
  if (!Array.isArray(value)) fail(`${label} debe ser una lista.`);
  if (value.length > max) fail(`${label} supera el límite permitido.`);
  return value.map((item, index) => object(item, `${label}[${index}]`));
}

function walkKeys(value: unknown) {
  if (Array.isArray(value)) {
    value.forEach(walkKeys);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) fail(`El paquete contiene el campo prohibido ${key}.`);
    walkKeys(child);
  }
}

function pick(row: AnyRow, fields: string[], label: string) {
  const result: AnyRow = {};
  for (const field of fields) {
    if (field in row) result[field] = row[field];
  }
  if ('id' in result) result.id = uuid(result.id, `${label}.id`);
  return result;
}

function dates(row: AnyRow, fields: string[], label: string) {
  const result = { ...row };
  for (const field of fields) {
    if (field in result) result[field] = date(result[field], `${label}.${field}`);
  }
  return result;
}

function without(row: AnyRow, fields: string[]) {
  const result = { ...row };
  for (const field of fields) delete result[field];
  return result;
}

export function normalizeUserDataPackage(input: unknown) {
  const payload = object(input, 'payload');
  walkKeys(payload);
  if (payload.format !== 'matchply-user-data' || payload.version !== 1) fail('Formato de paquete no compatible.');

  const source = object(payload.source, 'source');
  const sourceId = uuid(source.sourceId, 'source.sourceId');
  const sourceEmail = string(source.email, 'source.email').trim().toLowerCase();
  if (!sourceEmail.includes('@')) fail('El email de origen no es válido.');
  const user = object(payload.user, 'user');
  if (uuid(user.id, 'user.id') !== sourceId || string(user.email, 'user.email').trim().toLowerCase() !== sourceEmail) {
    fail('La identidad del paquete no coincide.');
  }
  const manifest = object(payload.manifest, 'manifest');
  const payloadSha256 = string(manifest.payloadSha256, 'manifest.payloadSha256');
  if (!/^[0-9a-f]{64}$/i.test(payloadSha256)) fail('El hash del paquete no es válido.');

  const withoutManifest = { ...payload };
  delete withoutManifest.manifest;
  const computed = createHash('sha256').update(JSON.stringify(withoutManifest)).digest('hex');
  if (computed !== payloadSha256) fail('El hash del paquete no coincide.');

  const lists = {
    cvs: rows(payload.cvs, 'cvs', MAX_ITEMS.cvs),
    companies: rows(payload.companies, 'companies', MAX_ITEMS.companies),
    companyIcons: rows(payload.companyIcons, 'companyIcons', MAX_ITEMS.companyIcons),
    userCompanies: rows(payload.userCompanies, 'userCompanies', MAX_ITEMS.userCompanies),
    companyNotes: rows(payload.companyNotes, 'companyNotes', MAX_ITEMS.companyNotes),
    jobOffers: rows(payload.jobOffers, 'jobOffers', MAX_ITEMS.jobOffers),
    applicationViews: rows(payload.applicationViews, 'applicationViews', MAX_ITEMS.applicationViews),
    jobResearchRuns: rows(payload.jobResearchRuns, 'jobResearchRuns', MAX_ITEMS.jobResearchRuns),
    jobResearchAgentRuns: rows(payload.jobResearchAgentRuns, 'jobResearchAgentRuns', MAX_ITEMS.jobResearchAgentRuns),
    jobResearchSources: rows(payload.jobResearchSources, 'jobResearchSources', MAX_ITEMS.jobResearchSources),
  };
  if (lists.jobResearchRuns.some((run) => ['queued', 'running'].includes(string(run.status, 'jobResearchRuns.status')))) {
    fail('El paquete contiene trabajos de investigación pendientes.');
  }
  for (const [name, list] of Object.entries(lists)) {
    const expected = manifest.counts?.[name];
    if (expected !== list.length) fail(`El recuento de ${name} no coincide.`);
  }

  return { sourceId, sourceEmail, user, ...lists, payloadSha256 };
}

async function existingById<T extends AnyRow>(tx: any, table: T, tableName: string, id: string) {
  const result = await tx.select().from(table).where(eq(table.id, id)).limit(1);
  if (result[0] && tableName === 'owned' && result[0].userId) return result[0];
  return result[0] ?? null;
}

function requiredDateFields(row: AnyRow, fields: string[], label: string) {
  return dates(row, fields, label);
}

export async function importUserData(input: unknown) {
  const payload = normalizeUserDataPackage(input);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`matchply-user-import:${payload.sourceEmail}`}))`);

    const [byEmail] = await tx
      .select({ id: users.id, email: users.email, role: users.role, accountStatus: users.accountStatus })
      .from(users)
      .where(sql`lower(${users.email}) = ${payload.sourceEmail}`)
      .for('update')
      .limit(1);
    const [byId] = await tx.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, payload.sourceId)).limit(1);
    if (byEmail && byEmail.email.toLowerCase() !== payload.sourceEmail) fail('La cuenta destino tiene un email incompatible.', 409);
    if (byId && byId.email.toLowerCase() !== payload.sourceEmail) fail('El UUID de origen colisiona con otra cuenta.', 409);

    const destinationUserId = byEmail?.id ?? byId?.id ?? payload.sourceId;
    if (byEmail?.role === 'admin' || byEmail?.accountStatus === 'suspended') {
      // Importar datos de trabajo está permitido, pero nunca cambia el rol o el estado de la cuenta.
    }
    if (!byEmail && !byId) {
      await tx.insert(users).values({
        id: destinationUserId,
        email: payload.sourceEmail,
        name: payload.user.name ?? null,
        image: payload.user.image ?? null,
        careerProfile: payload.user.careerProfile ?? null,
        createdAt: date(payload.user.createdAt, 'user.createdAt', false)!,
      });
    } else {
      await tx.update(users).set({
        name: payload.user.name ?? null,
        image: payload.user.image ?? null,
        careerProfile: payload.user.careerProfile ?? null,
      }).where(eq(users.id, destinationUserId));
    }

    const cvIds = new Map<string, string>();
    for (const sourceRow of payload.cvs) {
      const id = uuid(sourceRow.id, 'cv.id');
      const existing = await existingById(tx, cvs, 'owned', id);
      if (existing && existing.userId !== destinationUserId) fail('Un CV pertenece a otra cuenta.', 409);
      const values = requiredDateFields(pick(sourceRow, CV_FIELDS, 'cv'), ['createdAt', 'updatedAt'], 'cv');
      values.id = id;
      values.userId = destinationUserId;
      if (existing) {
        await tx.update(cvs).set(without(values, ['id', 'userId', 'createdAt'])).where(eq(cvs.id, id));
      } else {
        await tx.insert(cvs).values(values as any);
      }
      cvIds.set(id, id);
    }

    const companyIds = new Map<string, string>();
    for (const sourceRow of payload.companies) {
      const sourceCompanyId = uuid(sourceRow.id, 'company.id');
      const name = string(sourceRow.name, 'company.name');
      const nameNormalized = string(sourceRow.nameNormalized, 'company.nameNormalized');
      const [byNameRow] = await tx.select().from(companies).where(eq(companies.nameNormalized, nameNormalized)).limit(1);
      const byName = byNameRow as AnyRow | undefined;
      let destinationCompanyId: string | undefined = byName?.id;
      if (!destinationCompanyId) {
        const [byId] = await tx.select().from(companies).where(eq(companies.id, sourceCompanyId)).limit(1);
        if (byId && byId.nameNormalized !== nameNormalized) destinationCompanyId = cryptoRandomUuid();
        else destinationCompanyId = sourceCompanyId;
        await tx.insert(companies).values({
          ...requiredDateFields(pick(sourceRow, COMPANY_FIELDS, 'company'), ['createdAt', 'updatedAt'], 'company'),
          id: destinationCompanyId,
          name,
          nameNormalized,
        } as any);
      } else if (byName && destinationCompanyId) {
        const patch: AnyRow = {};
        for (const field of ['website', 'location', 'sector', 'iconHash']) {
          if (!byName[field] && sourceRow[field]) patch[field] = sourceRow[field];
        }
        if (Object.keys(patch).length) await tx.update(companies).set(patch).where(eq(companies.id, destinationCompanyId));
      }
      if (!destinationCompanyId) fail('No se pudo resolver la empresa.');
      companyIds.set(sourceCompanyId, destinationCompanyId);
    }

    for (const sourceRow of payload.companyIcons) {
      const sourceCompanyId = uuid(sourceRow.companyId, 'companyIcon.companyId');
      const destinationCompanyId = companyIds.get(sourceCompanyId);
      if (!destinationCompanyId) fail('El icono referencia una empresa no incluida.');
      const byteSize = Number(sourceRow.byteSize);
      if (!Number.isInteger(byteSize) || byteSize < 0 || byteSize > 8192) fail('El icono supera el límite permitido.');
      const iconBytes = string(sourceRow.bytes, 'companyIcon.bytes');
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(iconBytes) || Buffer.from(iconBytes, 'base64').byteLength !== byteSize) {
        fail('El contenido del icono no es válido.');
      }
      const [existing] = await tx.select({ companyId: companyIcons.companyId }).from(companyIcons).where(eq(companyIcons.companyId, destinationCompanyId)).limit(1);
      if (!existing) {
        await tx.insert(companyIcons).values({
          companyId: destinationCompanyId,
          mime: string(sourceRow.mime, 'companyIcon.mime'),
          bytes: iconBytes,
          byteSize,
          updatedAt: date(sourceRow.updatedAt, 'companyIcon.updatedAt', false)!,
        });
      }
    }

    for (const sourceRow of payload.userCompanies) {
      const destinationCompanyId = companyIds.get(uuid(sourceRow.companyId, 'userCompany.companyId'));
      if (!destinationCompanyId) fail('Una membresía referencia una empresa no incluida.');
      await tx.insert(userCompanies).values({
        userId: destinationUserId,
        companyId: destinationCompanyId,
        createdAt: date(sourceRow.createdAt, 'userCompany.createdAt', false)!,
      }).onConflictDoNothing();
    }

    for (const sourceRow of payload.companyNotes) {
      const id = uuid(sourceRow.id, 'companyNote.id');
      const destinationCompanyId = companyIds.get(uuid(sourceRow.companyId, 'companyNote.companyId'));
      if (!destinationCompanyId) fail('Una nota referencia una empresa no incluida.');
      const existing = await existingById(tx, companyNotes, 'owned', id);
      if (existing && existing.userId !== destinationUserId) fail('Una nota pertenece a otra cuenta.', 409);
      const values = requiredDateFields(pick(sourceRow, NOTE_FIELDS, 'companyNote'), ['createdAt', 'updatedAt'], 'companyNote');
      values.id = id;
      values.companyId = destinationCompanyId;
      values.userId = destinationUserId;
      if (existing) await tx.update(companyNotes).set(without(values, ['id', 'userId', 'createdAt'])).where(eq(companyNotes.id, id));
      else await tx.insert(companyNotes).values(values as any);
    }

    for (const sourceRow of payload.applicationViews) {
      const id = uuid(sourceRow.id, 'applicationView.id');
      const name = string(sourceRow.name, 'applicationView.name');
      const matches = await tx.select().from(applicationViews).where(or(
        eq(applicationViews.id, id),
        and(eq(applicationViews.userId, destinationUserId), eq(applicationViews.name, name)),
      )).limit(2);
      if (matches.length > 1) fail('Una vista colisiona por UUID y nombre.', 409);
      const existing = matches[0] ?? null;
      if (existing && existing.userId !== destinationUserId) fail('Una vista pertenece a otra cuenta.', 409);
      const values = requiredDateFields(pick(sourceRow, VIEW_FIELDS, 'applicationView'), ['createdAt', 'updatedAt'], 'applicationView');
      values.id = existing?.id ?? id;
      values.userId = destinationUserId;
      if (existing) await tx.update(applicationViews).set(without(values, ['id', 'userId', 'createdAt'])).where(eq(applicationViews.id, existing.id));
      else await tx.insert(applicationViews).values(values as any);
    }

    const offerIds = new Map<string, string>();
    for (const sourceRow of payload.jobOffers) {
      const sourceOfferId = uuid(sourceRow.id, 'jobOffer.id');
      const sourceCvId = sourceRow.cvId == null ? null : uuid(sourceRow.cvId, 'jobOffer.cvId');
      const sourceCompanyId = sourceRow.companyId == null ? null : uuid(sourceRow.companyId, 'jobOffer.companyId');
      const cvId = sourceCvId == null ? null : cvIds.get(sourceCvId);
      const companyId = sourceCompanyId == null ? null : companyIds.get(sourceCompanyId);
      if (sourceCvId && !cvId) fail('Una oferta referencia un CV no incluido.');
      if (sourceCompanyId && !companyId) fail('Una oferta referencia una empresa no incluida.');
      const conditions: any[] = [eq(jobOffers.id, sourceOfferId)];
      if (sourceRow.externalSource && sourceRow.externalId) {
        conditions.push(and(
          eq(jobOffers.userId, destinationUserId),
          eq(jobOffers.externalSource, string(sourceRow.externalSource, 'jobOffer.externalSource')),
          eq(jobOffers.externalId, string(sourceRow.externalId, 'jobOffer.externalId')),
        ));
      }
      const matches = await tx.select().from(jobOffers).where(or(...conditions)).limit(2);
      if (matches.length > 1) fail('Una oferta colisiona por UUID e identidad externa.', 409);
      const existing = matches[0] ?? null;
      if (existing && existing.userId !== destinationUserId) fail('Una oferta pertenece a otra cuenta.', 409);
      const destinationOfferId = existing?.id ?? sourceOfferId;
      const values = requiredDateFields(pick(sourceRow, OFFER_FIELDS, 'jobOffer'), ['matchEvaluatedAt', 'nextFollowupDate', 'createdAt', 'updatedAt'], 'jobOffer');
      values.id = destinationOfferId;
      values.userId = destinationUserId;
      values.cvId = cvId;
      values.companyId = companyId;
      if (existing) await tx.update(jobOffers).set(without(values, ['id', 'userId', 'createdAt'])).where(eq(jobOffers.id, destinationOfferId));
      else await tx.insert(jobOffers).values(values as any);
      offerIds.set(sourceOfferId, destinationOfferId);
    }

    const researchIds = new Map<string, string>();
    for (const sourceRow of payload.jobResearchRuns) {
      const sourceRunId = uuid(sourceRow.id, 'jobResearchRun.id');
      const sourceOfferId = uuid(sourceRow.jobOfferId, 'jobResearchRun.jobOfferId');
      const jobOfferId = offerIds.get(sourceOfferId);
      if (!jobOfferId) fail('Una investigación referencia una oferta no incluida.');
      const quotaPeriodStart = date(sourceRow.quotaPeriodStart, 'jobResearchRun.quotaPeriodStart', false)!;
      const conditions: any[] = [eq(jobResearchRuns.id, sourceRunId)];
      conditions.push(and(eq(jobResearchRuns.userId, destinationUserId), eq(jobResearchRuns.jobOfferId, jobOfferId), eq(jobResearchRuns.quotaPeriodStart, quotaPeriodStart)));
      const matches = await tx.select().from(jobResearchRuns).where(or(...conditions)).limit(2);
      if (matches.length > 1) fail('Una investigación colisiona por UUID y por oferta.', 409);
      const existing = matches[0] ?? null;
      if (existing && existing.userId !== destinationUserId) fail('Una investigación pertenece a otra cuenta.', 409);
      const destinationRunId = existing?.id ?? sourceRunId;
      const values = requiredDateFields(pick(sourceRow, RESEARCH_FIELDS, 'jobResearchRun'), ['leaseUntil', 'nextAttemptAt', 'quotaPeriodStart', 'startedAt', 'completedAt', 'createdAt', 'updatedAt'], 'jobResearchRun');
      values.id = destinationRunId;
      values.userId = destinationUserId;
      values.jobOfferId = jobOfferId;
      if (existing) await tx.update(jobResearchRuns).set(without(values, ['id', 'userId', 'createdAt'])).where(eq(jobResearchRuns.id, destinationRunId));
      else await tx.insert(jobResearchRuns).values(values as any);
      researchIds.set(sourceRunId, destinationRunId);
    }

    const agentIds = new Map<string, string>();
    for (const sourceRow of payload.jobResearchAgentRuns) {
      const sourceId = uuid(sourceRow.id, 'jobResearchAgentRun.id');
      const researchRunId = researchIds.get(uuid(sourceRow.researchRunId, 'jobResearchAgentRun.researchRunId'));
      if (!researchRunId) fail('Un agente referencia una investigación no incluida.');
      const role = string(sourceRow.role, 'jobResearchAgentRun.role');
      const matches = await tx.select().from(jobResearchAgentRuns).where(or(
        eq(jobResearchAgentRuns.id, sourceId),
        and(eq(jobResearchAgentRuns.researchRunId, researchRunId), eq(jobResearchAgentRuns.role, role)),
      )).limit(2);
      if (matches.length > 1) fail('Un agente colisiona por UUID y por rol.', 409);
      const existing = matches[0] ?? null;
      if (existing && existing.researchRunId !== researchRunId) fail('Un agente pertenece a otra investigación.', 409);
      const destinationId = existing?.id ?? sourceId;
      const values = requiredDateFields(pick(sourceRow, AGENT_FIELDS, 'jobResearchAgentRun'), ['startedAt', 'completedAt', 'createdAt'], 'jobResearchAgentRun');
      values.id = destinationId;
      values.researchRunId = researchRunId;
      if (existing) await tx.update(jobResearchAgentRuns).set(without(values, ['id', 'researchRunId', 'createdAt'])).where(eq(jobResearchAgentRuns.id, destinationId));
      else await tx.insert(jobResearchAgentRuns).values(values as any);
      agentIds.set(sourceId, destinationId);
    }

    for (const sourceRow of payload.jobResearchSources) {
      const sourceId = uuid(sourceRow.id, 'jobResearchSource.id');
      const researchRunId = researchIds.get(uuid(sourceRow.researchRunId, 'jobResearchSource.researchRunId'));
      if (!researchRunId) fail('Una fuente referencia una investigación no incluida.');
      const agentRunId = sourceRow.agentRunId == null ? null : agentIds.get(uuid(sourceRow.agentRunId, 'jobResearchSource.agentRunId'));
      if (sourceRow.agentRunId && !agentRunId) fail('Una fuente referencia un agente no incluido.');
      const canonicalUrl = string(sourceRow.canonicalUrl, 'jobResearchSource.canonicalUrl');
      const matches = await tx.select().from(jobResearchSources).where(or(
        eq(jobResearchSources.id, sourceId),
        and(eq(jobResearchSources.researchRunId, researchRunId), eq(jobResearchSources.canonicalUrl, canonicalUrl)),
      )).limit(2);
      if (matches.length > 1) fail('Una fuente colisiona por UUID y URL canónica.', 409);
      const existing = matches[0] ?? null;
      if (existing && existing.researchRunId !== researchRunId) fail('Una fuente pertenece a otra investigación.', 409);
      const destinationId = existing?.id ?? sourceId;
      const values = requiredDateFields(pick(sourceRow, SOURCE_FIELDS, 'jobResearchSource'), ['publishedAt', 'retrievedAt', 'createdAt'], 'jobResearchSource');
      values.id = destinationId;
      values.researchRunId = researchRunId;
      values.agentRunId = agentRunId;
      if (existing) await tx.update(jobResearchSources).set(without(values, ['id', 'researchRunId', 'createdAt'])).where(eq(jobResearchSources.id, destinationId));
      else await tx.insert(jobResearchSources).values(values as any);
    }

    const counts = {
      cvs: payload.cvs.length,
      companies: payload.companies.length,
      companyIcons: payload.companyIcons.length,
      userCompanies: payload.userCompanies.length,
      companyNotes: payload.companyNotes.length,
      jobOffers: payload.jobOffers.length,
      applicationViews: payload.applicationViews.length,
      jobResearchRuns: payload.jobResearchRuns.length,
      jobResearchAgentRuns: payload.jobResearchAgentRuns.length,
      jobResearchSources: payload.jobResearchSources.length,
    };
    await insertCriticalAuditLog(tx as any, {
      action: 'user_data_import',
      userId: null,
      userEmail: payload.sourceEmail,
      actorUserId: null,
      affectedUserId: destinationUserId,
      details: { sourceEmail: payload.sourceEmail, sourceId: payload.sourceId, payloadSha256: payload.payloadSha256, counts },
      category: 'admin',
    });
    return { destinationUserId, email: payload.sourceEmail, payloadSha256: payload.payloadSha256, counts };
  });
}

function cryptoRandomUuid() {
  return randomUUID();
}
