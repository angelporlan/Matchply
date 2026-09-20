import { and, desc, eq, gte, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { cvs, jobOffers, users } from '@/db/schema';
import { getEffectivePlanSource } from '@/lib/subscription';
import { parseAdminUserListQuery } from '@/lib/admin/user-list-query';
import { cvMetaColumns, applicationSummaryColumns } from '@/lib/job-offer-queries';

const listColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  subscriptionStatus: users.subscriptionStatus,
  accountStatus: users.accountStatus,
  proGrantedUntil: users.proGrantedUntil,
  lastLoginAt: users.lastLoginAt,
  lastSeenAt: users.lastSeenAt,
  createdAt: users.createdAt,
  stripeCustomerId: users.stripeCustomerId,
};

function planPredicate(plan: string, now: Date): SQL | undefined {
  const grantActive = sql`${users.proGrantedUntil} is not null and ${users.proGrantedUntil} > ${now}`;
  const stripePaid = sql`${users.subscriptionStatus} in ('active', 'trialing')`;
  if (plan === 'pro') return sql`(${stripePaid} or ${grantActive})`;
  if (plan === 'stripe') return sql`${users.subscriptionStatus} = 'active'`;
  if (plan === 'trialing') return sql`${users.subscriptionStatus} = 'trialing'`;
  if (plan === 'granted') return sql`${grantActive} and not ${stripePaid}`;
  if (plan === 'free') return sql`not ${stripePaid} and not ${grantActive}`;
  return undefined;
}

export async function listAdminUsers(searchParams: Record<string, string | string[] | undefined>, now = new Date()) {
  const query = parseAdminUserListQuery(searchParams, now);
  const filters: SQL[] = [eq(users.isGuest, false)];

  if (query.q) {
    const like = `%${query.q}%`;
    filters.push(or(
      ilike(users.name, like),
      ilike(users.email, like),
      sql`cast(${users.id} as text) ilike ${like}`,
    )!);
  }
  if (query.role !== 'all') filters.push(eq(users.role, query.role));
  if (query.status !== 'all') filters.push(eq(users.accountStatus, query.status));
  if (query.createdRange) {
    filters.push(gte(users.createdAt, query.createdRange.start));
    filters.push(sql`${users.createdAt} < ${query.createdRange.end}`);
  }
  const planFilter = planPredicate(query.plan, now);
  if (planFilter) filters.push(planFilter);
  if (query.activity === 'none') {
    filters.push(isNull(users.lastSeenAt));
  } else if (query.activityRange) {
    filters.push(gte(users.lastSeenAt, query.activityRange.start));
    filters.push(sql`${users.lastSeenAt} < ${query.activityRange.end}`);
  }

  const where = and(...filters);
  const sortColumn = {
    createdAt: users.createdAt,
    lastSeenAt: users.lastSeenAt,
    lastLoginAt: users.lastLoginAt,
    email: users.email,
    name: users.name,
  }[query.sort];
  const order = query.dir === 'asc'
    ? [sql`${sortColumn} ASC NULLS LAST`, users.id]
    : [sql`${sortColumn} DESC NULLS LAST`, desc(users.id)];

  const offset = (query.page - 1) * query.pageSize;
  const [countRow] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(users).where(where);
  const total = Number(countRow?.count || 0);
  const rows = await db
    .select(listColumns)
    .from(users)
    .where(where)
    .orderBy(...order)
    .limit(query.pageSize)
    .offset(offset);

  return {
    query,
    total,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
    rows: rows.map((row) => ({
      ...row,
      planSource: getEffectivePlanSource(row),
    })),
  };
}

export async function getAdminUserRecord(userId: string) {
  const [user] = await db
    .select({
      ...listColumns,
      image: users.image,
      isGuest: users.isGuest,
      stripeSubscriptionId: users.stripeSubscriptionId,
      suspensionReason: users.suspensionReason,
      suspendedAt: users.suspendedAt,
      proGrantedReason: users.proGrantedReason,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user || null;
}

export async function getAdminUserDetail(userId: string, page = 1, pageSize = 25) {
  const user = await getAdminUserRecord(userId);
  if (!user) return null;

  const offset = (Math.max(1, page) - 1) * pageSize;
  const [[cvCount], [offerCount], cvRows, offerRows] = await Promise.all([
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(cvs).where(eq(cvs.userId, userId)),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(jobOffers).where(eq(jobOffers.userId, userId)),
    db.select(cvMetaColumns).from(cvs).where(eq(cvs.userId, userId)).orderBy(desc(cvs.updatedAt), desc(cvs.id)).limit(pageSize).offset(offset),
    db.select(applicationSummaryColumns).from(jobOffers).where(eq(jobOffers.userId, userId)).orderBy(desc(jobOffers.updatedAt), desc(jobOffers.id)).limit(pageSize).offset(offset),
  ]);

  return {
    user: { ...user, planSource: getEffectivePlanSource(user) },
    cvCount: Number(cvCount?.count || 0),
    offerCount: Number(offerCount?.count || 0),
    cvs: cvRows,
    offers: offerRows,
  };
}

export async function getAdminSummaryCounts(now = new Date()) {
  const grantActive = sql`${users.proGrantedUntil} is not null and ${users.proGrantedUntil} > ${now}`;
  const [[registered], [guests], [cvsCount], [offersCount], [stripePro], [grantedPro], [suspended]] = await Promise.all([
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(users).where(eq(users.isGuest, false)),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(users).where(eq(users.isGuest, true)),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(cvs).innerJoin(users, eq(cvs.userId, users.id)).where(eq(users.isGuest, false)),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(jobOffers).innerJoin(users, eq(jobOffers.userId, users.id)).where(eq(users.isGuest, false)),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(users).where(and(eq(users.isGuest, false), sql`${users.subscriptionStatus} in ('active', 'trialing')`)),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(users).where(and(eq(users.isGuest, false), grantActive, sql`${users.subscriptionStatus} not in ('active', 'trialing')`)),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(users).where(and(eq(users.isGuest, false), eq(users.accountStatus, 'suspended'))),
  ]);

  return {
    totalUsers: Number(registered?.count || 0),
    totalGuests: Number(guests?.count || 0),
    totalCvs: Number(cvsCount?.count || 0),
    totalOffers: Number(offersCount?.count || 0),
    stripePro: Number(stripePro?.count || 0),
    grantedPro: Number(grantedPro?.count || 0),
    suspended: Number(suspended?.count || 0),
  };
}
