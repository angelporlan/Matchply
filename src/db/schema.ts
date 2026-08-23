import { pgTable, text, timestamp, boolean, uuid, doublePrecision, index, uniqueIndex, jsonb, integer } from 'drizzle-orm/pg-core';
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
  apiKey: text('apiKey').unique(), // Personal API Key for external integrations (e.g. Career-Ops)
  isGuest: boolean('isGuest').default(false).notNull(),
  guestTokenHash: text('guestTokenHash').unique(),
  guestExpiresAt: timestamp('guestExpiresAt', { mode: 'date' }),
  mcpProfile: jsonb('mcpProfile'),
  mcpCvId: uuid('mcpCvId'),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
});

// Tabla de Currículums
export const cvs = pgTable('cv', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('userId').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(), // Contenido en Markdown
  isBase: boolean('isBase').default(false).notNull(), // true = CV Base real del usuario
  isPrincipal: boolean('isPrincipal').default(false).notNull(), // true = CV Principal predeterminado para generación rápida
  templateName: text('templateName').default('harvard').notNull(), // 'harvard', 'modern', 'minimal', 'creative', 'swiss'
  accentColor: text('accentColor').default('#000000'),
  fontFamily: text('fontFamily').default('helvetica'),
  pageMargin: doublePrecision('pageMargin').default(36),
  scale: doublePrecision('scale').default(1.0),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
});

// Tabla de Ofertas de Trabajo y Seguimiento (Candidaturas)
export const jobOffers = pgTable('job_offer', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('userId').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  cvId: uuid('cvId').references(() => cvs.id, { onDelete: 'set null' }), // CV enlazado a esta oferta
  title: text('title').notNull(), // Puesto: ej. Frontend Developer
  company: text('company').notNull(), // Empresa: ej. Stripe
  url: text('url'), // URL de la oferta
  platform: text('platform').default('linkedin').notNull(), // 'linkedin', 'infojobs', 'indeed', 'other'
  description: text('description'), // Descripción completa copiada de la oferta para optimización
  status: text('status').default('interested').notNull(), // 'interested', 'applied', 'interview', 'offer', 'rejected'
  
  // Pipeline / Scraping
  source: text('source'), // ej. 'ashby', 'greenhouse', 'linkedin'
  externalSource: text('externalSource'), // Integración estable, ej. 'local_job_archive'
  externalId: text('externalId'), // ID estable dentro de la integración externa
  livenessStatus: text('livenessStatus').default('active'), // 'active' | 'expired'
  sourceMetadata: jsonb('sourceMetadata'), // Payload normalizado y metadatos visibles de la fuente
  
  // Evaluación de IA
  scoreOverall: doublePrecision('scoreOverall'), // ej. 4.4
  scoreBreakdown: jsonb('scoreBreakdown'), // Puntuaciones específicas (Tech, Salario, etc.)
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
  interviewStories: jsonb('interviewStories'), // Historias STAR recomendadas
  
  // Seguimiento y Analíticas
  nextFollowupDate: timestamp('nextFollowupDate', { mode: 'date' }), // Cuándo contactar
  rejectionPatternTags: jsonb('rejectionPatternTags'), // Etiquetas de rechazo
  
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  externalIdentityIdx: uniqueIndex('job_offer_external_identity_idx')
    .on(table.userId, table.externalSource, table.externalId),
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
});

// Tabla de Auditoría (Logs de Actividad)
export const auditLogs = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('userId').references(() => users.id, { onDelete: 'set null' }),
  userEmail: text('userEmail'),
  action: text('action').notNull(), // e.g. 'user_register', 'user_login', 'cv_create_manual', 'cv_optimize_ai', 'cv_delete', etc.
  details: text('details'), // JSON string con detalles descriptivos del evento
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('audit_log_user_id_idx').on(table.userId),
  actionIdx: index('audit_log_action_idx').on(table.action),
  createdAtIdx: index('audit_log_created_at_idx').on(table.createdAt),
}));

// Definición de Relaciones para Drizzle
export const usersRelations = relations(users, ({ many }) => ({
  cvs: many(cvs),
  jobOffers: many(jobOffers),
  auditLogs: many(auditLogs),
  extensionPairingCodes: many(extensionPairingCodes),
  extensionInstallations: many(extensionInstallations),
  jobResearchRuns: many(jobResearchRuns),
  researchQuotaPeriods: many(researchQuotaPeriods),
}));

export const cvsRelations = relations(cvs, ({ one, many }) => ({
  user: one(users, { fields: [cvs.userId], references: [users.id] }),
  jobOffers: many(jobOffers),
}));

export const jobOffersRelations = relations(jobOffers, ({ one }) => ({
  user: one(users, { fields: [jobOffers.userId], references: [users.id] }),
  cv: one(cvs, { fields: [jobOffers.cvId], references: [cvs.id] }),
}));

export const extensionPairingCodesRelations = relations(extensionPairingCodes, ({ one }) => ({
  user: one(users, { fields: [extensionPairingCodes.userId], references: [users.id] }),
}));

export const extensionInstallationsRelations = relations(extensionInstallations, ({ one }) => ({
  user: one(users, { fields: [extensionInstallations.userId], references: [users.id] }),
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
}));

export type User = typeof users.$inferSelect;
export type CV = typeof cvs.$inferSelect;
export type JobOffer = typeof jobOffers.$inferSelect;
export type ExtensionPairingCode = typeof extensionPairingCodes.$inferSelect;
export type ExtensionInstallation = typeof extensionInstallations.$inferSelect;
export type JobResearchRun = typeof jobResearchRuns.$inferSelect;
export type JobResearchAgentRun = typeof jobResearchAgentRuns.$inferSelect;
export type JobResearchSource = typeof jobResearchSources.$inferSelect;
export type ResearchQuotaPeriod = typeof researchQuotaPeriods.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type Prompt = typeof prompts.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
