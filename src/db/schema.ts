import { pgTable, text, timestamp, boolean, uuid, doublePrecision, index, uniqueIndex, jsonb, integer, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Tabla de Usuarios (Compatible con NextAuth)
export const users = pgTable('user', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  passwordHash: text('passwordHash'),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  stripeCustomerId: text('stripeCustomerId').unique(),
  stripeSubscriptionId: text('stripeSubscriptionId'),
  subscriptionStatus: text('subscriptionStatus').default('none').notNull(), // Stripe status, or 'none' before subscribing.
  role: text('role').default('user').notNull(), // 'user' o 'admin'
  accountStatus: text('accountStatus').default('active').notNull(), // 'active' | 'suspended'
  suspensionReason: text('suspensionReason'),
  suspendedAt: timestamp('suspendedAt', { mode: 'date' }),
  suspendedByUserId: uuid('suspendedByUserId'),
  lastLoginAt: timestamp('lastLoginAt', { mode: 'date' }),
  lastSeenAt: timestamp('lastSeenAt', { mode: 'date' }),
  proGrantedUntil: timestamp('proGrantedUntil', { mode: 'date' }),
  proGrantedReason: text('proGrantedReason'),
  proGrantedByUserId: uuid('proGrantedByUserId'),
  isGuest: boolean('isGuest').default(false).notNull(),
  guestTokenHash: text('guestTokenHash').unique(),
  guestExpiresAt: timestamp('guestExpiresAt', { mode: 'date' }),
  careerProfile: jsonb('careerProfile'),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  createdIdIdx: index('user_created_id_idx').on(table.createdAt, table.id),
  lastSeenIdx: index('user_last_seen_idx').on(table.lastSeenAt),
  lastLoginIdx: index('user_last_login_idx').on(table.lastLoginAt),
  accountStatusIdx: index('user_account_status_idx').on(table.accountStatus),
  guestCreatedIdx: index('user_guest_created_idx').on(table.isGuest, table.createdAt),
  roleIdx: index('user_role_idx').on(table.role),
  proGrantedIdx: index('user_pro_granted_idx').on(table.proGrantedUntil),
}));

// Tabla de Currículums
export const cvs = pgTable('cv', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('userId').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(), // Contenido en Markdown
  isBase: boolean('isBase').default(false).notNull(), // true = CV Base real del usuario
  isPrincipal: boolean('isPrincipal').default(false).notNull(), // true = CV Principal predeterminado para generación rápida
  templateName: text('templateName').default('harvard').notNull(), // 'harvard'
  accentColor: text('accentColor').default('#000000'),
  fontFamily: text('fontFamily').default('helvetica'),
  pageMargin: doublePrecision('pageMargin').default(36),
  scale: doublePrecision('scale').default(1.0),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  userIdIdx: index('cv_user_id_idx').on(table.userId),
  // Dashboard listing: ORDER BY isPrincipal DESC, updatedAt DESC per user.
  userUpdatedIdx: index('cv_user_updated_idx').on(table.userId, table.updatedAt),
  // Base CV lookup for AI: ORDER BY isBase DESC, isPrincipal DESC LIMIT 1 per user.
  userBasePrincipalIdx: index('cv_user_base_principal_idx').on(table.userId, table.isBase, table.isPrincipal),
}));

// Catálogo compartido de empresas. Nombre, web, ubicación, sector e icono son comunes a todos los usuarios.
// El nombre visible también se denormaliza en job_offer.company. Notas y postulaciones siguen siendo por usuario.
export const companies = pgTable('company', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  nameNormalized: text('nameNormalized').notNull(),
  website: text('website'),
  location: text('location'),
  sector: text('sector'),
  iconHash: text('iconHash'),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  nameIdx: uniqueIndex('company_name_normalized_idx').on(table.nameNormalized),
}));

// Relación usuario ↔ empresa (CRM personal). Borrar aquí no borra la ficha compartida.
export const userCompanies = pgTable('user_company', {
  userId: uuid('userId').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  companyId: uuid('companyId').references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.companyId] }),
  companyIdx: index('user_company_company_id_idx').on(table.companyId),
}));

// Icono pequeño (PNG/WebP/ICO, ≤ 8 KB). No seleccionar en listados; servir con iconHash.
export const companyIcons = pgTable('company_icon', {
  companyId: uuid('companyId').primaryKey().references(() => companies.id, { onDelete: 'cascade' }),
  mime: text('mime').notNull(),
  bytes: text('bytes').notNull(), // base64
  byteSize: integer('byteSize').notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});

// Tabla de Ofertas de Trabajo y Seguimiento (Candidaturas)
export const jobOffers = pgTable('job_offer', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('userId').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  cvId: uuid('cvId').references(() => cvs.id, { onDelete: 'set null' }), // CV enlazado a esta oferta
  title: text('title').notNull(), // Puesto: ej. Frontend Developer
  company: text('company').notNull(), // Empresa: ej. Stripe (denormalizado desde company.name)
  companyId: uuid('companyId').references(() => companies.id, { onDelete: 'set null' }),
  url: text('url'), // URL de la oferta
  platform: text('platform').default('linkedin').notNull(), // 'linkedin', 'infojobs', 'indeed', 'other'
  description: text('description'), // Descripción completa copiada de la oferta para optimización
  status: text('status').default('interested').notNull(), // 'interested', 'applied', 'interview', 'offer', 'rejected', 'archived'
  
  // Pipeline / Scraping
  source: text('source'), // ej. 'ashby', 'greenhouse', 'linkedin'
  externalSource: text('externalSource'), // Integración estable, ej. 'local_job_archive'
  externalId: text('externalId'), // ID estable dentro de la integración externa
  livenessStatus: text('livenessStatus').default('active'), // 'active' | 'expired'
  sourceMetadata: jsonb('sourceMetadata'), // Payload normalizado y metadatos visibles de la fuente
  
  // Evaluación de IA (match candidato–oferta, 0-100)
  scoreOverall: doublePrecision('scoreOverall'),
  scoreBreakdown: jsonb('scoreBreakdown'), // tech_stack, experience_fit, work_mode, salary_fit, career_alignment
  matchInputHash: text('matchInputHash'),
  matchKind: text('matchKind'), // 'triage' | 'deep'
  matchEvidence: jsonb('matchEvidence'), // Versioned scoring snapshot; detail queries only
  matchDetails: jsonb('matchDetails'), // Explanation bound to the scoring input hash
  matchEvaluatedAt: timestamp('matchEvaluatedAt', { mode: 'date' }), // Request generation
  tldr: text('tldr'), // Resumen ejecutivo
  redFlags: jsonb('redFlags'), // Array de alertas/riesgos
  legitimacyTier: text('legitimacyTier'), // Ghost job detection tier
  rawReport: text('rawReport'), // Reporte completo markdown
  
  // CV y Adaptación
  targetProofPoints: jsonb('targetProofPoints'), // Logros sugeridos a enfatizar
  
  // Outreach y Estrategia
  coverLetter: text('coverLetter'), // Carta de presentación
  outreachMessage: text('outreachMessage'), // Mensaje de contacto
  interviewQuestions: jsonb('interviewQuestions'), // Preguntas probables de entrevista
  
  // Seguimiento y Analíticas
  nextFollowupDate: timestamp('nextFollowupDate', { mode: 'date' }), // Cuándo contactar
  rejectionPatternTags: jsonb('rejectionPatternTags'), // Etiquetas de rechazo
  
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  externalIdentityIdx: uniqueIndex('job_offer_external_identity_idx')
    .on(table.userId, table.externalSource, table.externalId),
  userUpdatedIdx: index('job_offer_user_updated_idx').on(table.userId, table.updatedAt),
  userStatusIdx: index('job_offer_user_status_idx').on(table.userId, table.status),
  userCompanyIdx: index('job_offer_user_company_id_idx').on(table.userId, table.companyId),
  // Dedupe on upsert from the extension / import (findExisting by URL).
  userUrlIdx: index('job_offer_user_url_idx').on(table.userId, table.url),
  // Dedupe fallback by title + company, and dashboard "latest offer per CV".
  userTitleCompanyIdx: index('job_offer_user_title_company_idx').on(table.userId, table.title, table.company),
  cvIdx: index('job_offer_cv_id_idx').on(table.cvId),
}));

export const companyNotes = pgTable('company_note', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('companyId').references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('userId').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  companyCreatedIdx: index('company_note_company_created_idx').on(table.companyId, table.createdAt),
  userIdx: index('company_note_user_id_idx').on(table.userId),
}));

// Códigos de un solo uso para vincular la extensión de Chrome.
export const extensionPairingCodes = pgTable('extension_pairing_code', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('userId').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  codeHash: text('codeHash').notNull().unique(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  expiresAt: timestamp('expiresAt', { mode: 'date' }).notNull(),
  consumedAt: timestamp('consumedAt', { mode: 'date' }),
}, (table) => ({
  userStatusIdx: index('extension_pairing_code_user_status_idx').on(table.userId, table.expiresAt, table.consumedAt),
}));

// Sesiones limitadas de la extensión. Nunca se almacena el token en claro.
export const extensionInstallations = pgTable('extension_installation', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('userId').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: text('tokenHash').notNull().unique(),
  tokenPrefix: text('tokenPrefix').notNull(),
  extensionVersion: text('extensionVersion'),
  status: text('status').default('active').notNull(), // active | revoked | expired
  lastSeenAt: timestamp('lastSeenAt', { mode: 'date' }),
  lastCaptureAt: timestamp('lastCaptureAt', { mode: 'date' }),
  expiresAt: timestamp('expiresAt', { mode: 'date' }).notNull(),
  revokedAt: timestamp('revokedAt', { mode: 'date' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('extension_installation_user_idx').on(table.userId),
  statusIdx: index('extension_installation_status_idx').on(table.status, table.expiresAt),
}));

// Vistas guardadas de la tabla de postulaciones (columnas, filtros y orden).
export const applicationViews = pgTable('application_view', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('userId').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  isDefault: boolean('isDefault').default(false).notNull(),
  config: jsonb('config').notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('application_view_user_idx').on(table.userId),
  userNameIdx: uniqueIndex('application_view_user_name_idx').on(table.userId, table.name),
}));

// Fuente de verdad de la cola de investigación PostgreSQL.
export const jobResearchRuns = pgTable('job_research_run', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('userId').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  jobOfferId: uuid('jobOfferId').references(() => jobOffers.id, { onDelete: 'cascade' }).notNull(),
  status: text('status').default('queued').notNull(),
  trigger: text('trigger').default('extension_capture').notNull(),
  attempt: integer('attempt').default(0).notNull(),
  leaseUntil: timestamp('leaseUntil', { mode: 'date' }),
  nextAttemptAt: timestamp('nextAttemptAt', { mode: 'date' }),
  quotaPeriodStart: timestamp('quotaPeriodStart', { mode: 'date' }).notNull(),
  engineVersion: text('engineVersion').default('linkedin-research-v1').notNull(),
  lastError: text('lastError'),
  scoreOverall: doublePrecision('scoreOverall'),
  confidence: doublePrecision('confidence'),
  report: jsonb('report'),
  startedAt: timestamp('startedAt', { mode: 'date' }),
  completedAt: timestamp('completedAt', { mode: 'date' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  queueIdx: index('job_research_run_queue_idx').on(table.status, table.nextAttemptAt, table.leaseUntil),
  offerIdx: index('job_research_run_offer_idx').on(table.jobOfferId, table.createdAt),
  userIdx: index('job_research_run_user_idx').on(table.userId, table.createdAt),
  quotaOfferIdx: uniqueIndex('job_research_run_quota_offer_idx').on(table.userId, table.quotaPeriodStart, table.jobOfferId),
}));

export const jobResearchAgentRuns = pgTable('job_research_agent_run', {
  id: uuid('id').defaultRandom().primaryKey(),
  researchRunId: uuid('researchRunId').references(() => jobResearchRuns.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').notNull(),
  provider: text('provider'),
  model: text('model'),
  status: text('status').default('queued').notNull(),
  result: jsonb('result'),
  error: text('error'),
  startedAt: timestamp('startedAt', { mode: 'date' }),
  completedAt: timestamp('completedAt', { mode: 'date' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  runRoleIdx: uniqueIndex('job_research_agent_run_role_idx').on(table.researchRunId, table.role),
}));

export const jobResearchSources = pgTable('job_research_source', {
  id: uuid('id').defaultRandom().primaryKey(),
  researchRunId: uuid('researchRunId').references(() => jobResearchRuns.id, { onDelete: 'cascade' }).notNull(),
  agentRunId: uuid('agentRunId').references(() => jobResearchAgentRuns.id, { onDelete: 'set null' }),
  url: text('url').notNull(),
  canonicalUrl: text('canonicalUrl').notNull(),
  title: text('title'),
  domain: text('domain'),
  sourceType: text('sourceType').default('web').notNull(),
  publishedAt: timestamp('publishedAt', { mode: 'date' }),
  retrievedAt: timestamp('retrievedAt', { mode: 'date' }).defaultNow().notNull(),
  excerpt: text('excerpt'),
  contentHash: text('contentHash').notNull(),
  confidence: doublePrecision('confidence'),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  runCanonicalIdx: uniqueIndex('job_research_source_run_canonical_idx').on(table.researchRunId, table.canonicalUrl),
  runIdx: index('job_research_source_run_idx').on(table.researchRunId),
}));

export const researchQuotaPeriods = pgTable('research_quota_period', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('userId').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  periodStart: timestamp('periodStart', { mode: 'date' }).notNull(),
  usedOffers: integer('usedOffers').default(0).notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  userPeriodIdx: uniqueIndex('research_quota_period_user_period_idx').on(table.userId, table.periodStart),
}));

// Tabla de Configuración de la Aplicación (Configuración de IA)
export const settings = pgTable('setting', {
  key: text('key').primaryKey(), // 'free_provider', 'free_model', 'pro_provider', 'pro_model'
  value: text('value').notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});

// Tabla de Prompts Dinámicos
export const prompts = pgTable('prompt', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(), // Ej: "Optimización Estilo Harvard"
  nameEn: text('nameEn'), // Nombre descriptivo en inglés (opcional)
  key: text('key').default('optimize_cv').notNull(), // Clave de la función asociada (ej. 'optimize_cv')
  description: text('description'), // Descripción del modo para mostrarle al usuario
  descriptionEn: text('descriptionEn'), // Descripción en inglés (opcional)
  color: text('color'), // Color hexadecimal asociado al modo (ej. '#8b5cf6')
  systemPrompt: text('systemPrompt').notNull(),
  userPrompt: text('userPrompt').notNull(), // Template con variables {{cv}} y {{job}}
  isActive: boolean('isActive').default(false).notNull(),
  isArchived: boolean('isArchived').default(false).notNull(), // Para archivar prompts
  isStrict: boolean('isStrict').default(false).notNull(), // Regra superestricta para formato .MD
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  keyArchivedIdx: index('prompt_key_archived_idx').on(table.key, table.isArchived),
}));

// Tabla de Auditoría (Logs de Actividad)
export const auditLogs = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('userId').references(() => users.id, { onDelete: 'set null' }),
  userEmail: text('userEmail'),
  action: text('action').notNull(), // e.g. 'user_register', 'user_login', 'cv_create_manual', 'cv_optimize_ai', 'cv_delete', etc.
  details: text('details'), // JSON string con detalles descriptivos del evento
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  actorUserId: uuid('actorUserId').references(() => users.id, { onDelete: 'set null' }),
  affectedUserId: uuid('affectedUserId').references(() => users.id, { onDelete: 'set null' }),
  supportSessionId: uuid('supportSessionId'),
  requestId: text('requestId'),
  category: text('category').default('ordinary').notNull(), // 'ordinary' | 'admin'
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('audit_log_user_id_idx').on(table.userId),
  actionIdx: index('audit_log_action_idx').on(table.action),
  createdAtIdx: index('audit_log_created_at_idx').on(table.createdAt),
  // Admin "today" counters: WHERE action = ? AND createdAt >= ?
  actionCreatedIdx: index('audit_log_action_created_idx').on(table.action, table.createdAt),
  actorCreatedIdx: index('audit_log_actor_created_idx').on(table.actorUserId, table.createdAt),
  affectedCreatedIdx: index('audit_log_affected_created_idx').on(table.affectedUserId, table.createdAt),
  categoryCreatedIdx: index('audit_log_category_created_idx').on(table.category, table.createdAt),
}));

export const supportSessions = pgTable('support_session', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorUserId: uuid('actorUserId').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  targetUserId: uuid('targetUserId').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: text('tokenHash').notNull().unique(),
  reason: text('reason').notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  expiresAt: timestamp('expiresAt', { mode: 'date' }).notNull(),
  revokedAt: timestamp('revokedAt', { mode: 'date' }),
  endedAt: timestamp('endedAt', { mode: 'date' }),
}, (table) => ({
  actorIdx: index('support_session_actor_idx').on(table.actorUserId, table.createdAt),
  targetIdx: index('support_session_target_idx').on(table.targetUserId, table.createdAt),
  expiresIdx: index('support_session_expires_idx').on(table.expiresAt, table.revokedAt),
}));

export const aiRuntimeConfigs = pgTable('ai_runtime_config', {
  id: integer('id').primaryKey().default(1),
  version: integer('version').notNull().default(1),
  config: jsonb('config').notNull(),
  updatedByUserId: uuid('updatedByUserId').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});

export const aiRuntimeConfigHistory = pgTable('ai_runtime_config_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  version: integer('version').notNull(),
  config: jsonb('config').notNull(),
  updatedByUserId: uuid('updatedByUserId').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  versionIdx: uniqueIndex('ai_runtime_config_history_version_idx').on(table.version),
  createdIdx: index('ai_runtime_config_history_created_idx').on(table.createdAt),
}));

export const aiRunStats = pgTable('ai_run_stat', {
  id: uuid('id').defaultRandom().primaryKey(),
  functionKey: text('functionKey').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  plan: text('plan').notNull(),
  success: boolean('success').notNull(),
  latencyMs: integer('latencyMs'),
  inputTokens: integer('inputTokens'),
  outputTokens: integer('outputTokens'),
  estimatedCostUsd: doublePrecision('estimatedCostUsd'),
  errorCode: text('errorCode'),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  createdIdx: index('ai_run_stat_created_idx').on(table.createdAt),
  functionCreatedIdx: index('ai_run_stat_function_created_idx').on(table.functionKey, table.createdAt),
  providerCreatedIdx: index('ai_run_stat_provider_created_idx').on(table.provider, table.createdAt),
}));

export const aiJobs = pgTable('ai_job', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('userId').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  initiatedByUserId: uuid('initiatedByUserId').references(() => users.id, { onDelete: 'set null' }),
  kind: text('kind').notNull(),
  status: text('status').default('queued').notNull(),
  attempt: integer('attempt').default(0).notNull(),
  leaseUntil: timestamp('leaseUntil', { mode: 'date' }),
  nextAttemptAt: timestamp('nextAttemptAt', { mode: 'date' }),
  payload: jsonb('payload').notNull(),
  result: jsonb('result'),
  resolvedAiConfig: jsonb('resolvedAiConfig'),
  lastError: text('lastError'),
  startedAt: timestamp('startedAt', { mode: 'date' }),
  completedAt: timestamp('completedAt', { mode: 'date' }),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  queueIdx: index('ai_job_queue_idx').on(table.status, table.nextAttemptAt, table.leaseUntil),
  userIdx: index('ai_job_user_idx').on(table.userId, table.createdAt),
  initiatedByIdx: index('ai_job_initiated_by_idx').on(table.initiatedByUserId, table.createdAt),
}));

// Definición de Relaciones para Drizzle
export const usersRelations = relations(users, ({ many }) => ({
  cvs: many(cvs),
  userCompanies: many(userCompanies),
  companyNotes: many(companyNotes),
  jobOffers: many(jobOffers),
  auditLogs: many(auditLogs),
  extensionPairingCodes: many(extensionPairingCodes),
  extensionInstallations: many(extensionInstallations),
  applicationViews: many(applicationViews),
  jobResearchRuns: many(jobResearchRuns),
  researchQuotaPeriods: many(researchQuotaPeriods),
  aiJobs: many(aiJobs),
  supportSessionsAsActor: many(supportSessions, { relationName: 'supportSessionActor' }),
  supportSessionsAsTarget: many(supportSessions, { relationName: 'supportSessionTarget' }),
}));

export const cvsRelations = relations(cvs, ({ one, many }) => ({
  user: one(users, { fields: [cvs.userId], references: [users.id] }),
  jobOffers: many(jobOffers),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  jobOffers: many(jobOffers),
  notes: many(companyNotes),
  memberships: many(userCompanies),
  icon: one(companyIcons, { fields: [companies.id], references: [companyIcons.companyId] }),
}));

export const userCompaniesRelations = relations(userCompanies, ({ one }) => ({
  user: one(users, { fields: [userCompanies.userId], references: [users.id] }),
  company: one(companies, { fields: [userCompanies.companyId], references: [companies.id] }),
}));

export const companyIconsRelations = relations(companyIcons, ({ one }) => ({
  company: one(companies, { fields: [companyIcons.companyId], references: [companies.id] }),
}));

export const companyNotesRelations = relations(companyNotes, ({ one }) => ({
  company: one(companies, { fields: [companyNotes.companyId], references: [companies.id] }),
  user: one(users, { fields: [companyNotes.userId], references: [users.id] }),
}));

export const jobOffersRelations = relations(jobOffers, ({ one }) => ({
  user: one(users, { fields: [jobOffers.userId], references: [users.id] }),
  cv: one(cvs, { fields: [jobOffers.cvId], references: [cvs.id] }),
  companyRecord: one(companies, { fields: [jobOffers.companyId], references: [companies.id] }),
}));

export const extensionPairingCodesRelations = relations(extensionPairingCodes, ({ one }) => ({
  user: one(users, { fields: [extensionPairingCodes.userId], references: [users.id] }),
}));

export const extensionInstallationsRelations = relations(extensionInstallations, ({ one }) => ({
  user: one(users, { fields: [extensionInstallations.userId], references: [users.id] }),
}));

export const applicationViewsRelations = relations(applicationViews, ({ one }) => ({
  user: one(users, { fields: [applicationViews.userId], references: [users.id] }),
}));

export const jobResearchRunsRelations = relations(jobResearchRuns, ({ one, many }) => ({
  user: one(users, { fields: [jobResearchRuns.userId], references: [users.id] }),
  jobOffer: one(jobOffers, { fields: [jobResearchRuns.jobOfferId], references: [jobOffers.id] }),
  agentRuns: many(jobResearchAgentRuns),
  sources: many(jobResearchSources),
}));

export const jobResearchAgentRunsRelations = relations(jobResearchAgentRuns, ({ one, many }) => ({
  researchRun: one(jobResearchRuns, { fields: [jobResearchAgentRuns.researchRunId], references: [jobResearchRuns.id] }),
  sources: many(jobResearchSources),
}));

export const jobResearchSourcesRelations = relations(jobResearchSources, ({ one }) => ({
  researchRun: one(jobResearchRuns, { fields: [jobResearchSources.researchRunId], references: [jobResearchRuns.id] }),
  agentRun: one(jobResearchAgentRuns, { fields: [jobResearchSources.agentRunId], references: [jobResearchAgentRuns.id] }),
}));

export const researchQuotaPeriodsRelations = relations(researchQuotaPeriods, ({ one }) => ({
  user: one(users, { fields: [researchQuotaPeriods.userId], references: [users.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
  actor: one(users, { fields: [auditLogs.actorUserId], references: [users.id], relationName: 'auditActor' }),
  affected: one(users, { fields: [auditLogs.affectedUserId], references: [users.id], relationName: 'auditAffected' }),
}));

export const supportSessionsRelations = relations(supportSessions, ({ one }) => ({
  actor: one(users, { fields: [supportSessions.actorUserId], references: [users.id], relationName: 'supportSessionActor' }),
  target: one(users, { fields: [supportSessions.targetUserId], references: [users.id], relationName: 'supportSessionTarget' }),
}));

export const aiJobsRelations = relations(aiJobs, ({ one }) => ({
  user: one(users, { fields: [aiJobs.userId], references: [users.id] }),
  initiatedBy: one(users, { fields: [aiJobs.initiatedByUserId], references: [users.id], relationName: 'aiJobInitiator' }),
}));

export type User = typeof users.$inferSelect;
export type CV = typeof cvs.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type UserCompany = typeof userCompanies.$inferSelect;
export type CompanyIcon = typeof companyIcons.$inferSelect;
export type CompanyNote = typeof companyNotes.$inferSelect;
export type JobOffer = typeof jobOffers.$inferSelect;
export type ExtensionPairingCode = typeof extensionPairingCodes.$inferSelect;
export type ExtensionInstallation = typeof extensionInstallations.$inferSelect;
export type ApplicationView = typeof applicationViews.$inferSelect;
export type JobResearchRun = typeof jobResearchRuns.$inferSelect;
export type JobResearchAgentRun = typeof jobResearchAgentRuns.$inferSelect;
export type JobResearchSource = typeof jobResearchSources.$inferSelect;
export type ResearchQuotaPeriod = typeof researchQuotaPeriods.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type Prompt = typeof prompts.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type SupportSession = typeof supportSessions.$inferSelect;
export type AiRuntimeConfigRow = typeof aiRuntimeConfigs.$inferSelect;
export type AiRuntimeConfigHistoryRow = typeof aiRuntimeConfigHistory.$inferSelect;
export type AiRunStat = typeof aiRunStats.$inferSelect;
export type AiJob = typeof aiJobs.$inferSelect;
