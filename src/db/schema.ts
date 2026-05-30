import { pgTable, text, timestamp, boolean, uuid, doublePrecision, index } from 'drizzle-orm/pg-core';
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
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});

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
  key: text('key').default('optimize_cv').notNull(), // Clave de la función asociada (ej. 'optimize_cv')
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
}));

export const cvsRelations = relations(cvs, ({ one, many }) => ({
  user: one(users, { fields: [cvs.userId], references: [users.id] }),
  jobOffers: many(jobOffers),
}));

export const jobOffersRelations = relations(jobOffers, ({ one }) => ({
  user: one(users, { fields: [jobOffers.userId], references: [users.id] }),
  cv: one(cvs, { fields: [jobOffers.cvId], references: [cvs.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type CV = typeof cvs.$inferSelect;
export type JobOffer = typeof jobOffers.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type Prompt = typeof prompts.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

