import { pgTable, text, timestamp, boolean, uuid, doublePrecision } from 'drizzle-orm/pg-core';
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
  subscriptionStatus: text('subscriptionStatus').default('none').notNull(), // 'active', 'none', 'canceled'
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
});

// Tabla de Currículums
export const cvs = pgTable('cv', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('userId').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(), // Contenido en Markdown
  isBase: boolean('isBase').default(false).notNull(), // true = CV Base real del usuario
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

// Definición de Relaciones para Drizzle
export const usersRelations = relations(users, ({ many }) => ({
  cvs: many(cvs),
  jobOffers: many(jobOffers),
}));

export const cvsRelations = relations(cvs, ({ one, many }) => ({
  user: one(users, { fields: [cvs.userId], references: [users.id] }),
  jobOffers: many(jobOffers),
}));

export const jobOffersRelations = relations(jobOffers, ({ one }) => ({
  user: one(users, { fields: [jobOffers.userId], references: [users.id] }),
  cv: one(cvs, { fields: [jobOffers.cvId], references: [cvs.id] }),
}));
export type User = typeof users.$inferSelect;
export type CV = typeof cvs.$inferSelect;
export type JobOffer = typeof jobOffers.$inferSelect;
