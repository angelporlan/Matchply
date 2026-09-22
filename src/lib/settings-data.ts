import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { cvs, users } from '@/db/schema';
import { baseCvForAiColumns, cvListColumns } from '@/lib/job-offer-queries';
import { listExtensionInstallations } from '@/lib/extension-auth';
import { getResearchQuota } from '@/lib/research/queue';
import { hasProAccess } from '@/lib/subscription';
import type { SessionUser } from '@/lib/session';

export type SettingsCvMeta = {
  id: string;
  title: string;
  isBase: boolean;
  isPrincipal: boolean;
};

export type AccountSettingsPayload = {
  tab: 'account';
  user: { name: string; email: string; image?: string | null };
  isPremium: boolean;
  memberSince: string | null;
};

export type ProfileSettingsPayload = {
  tab: 'profile';
  careerProfile: unknown;
  userCvs: SettingsCvMeta[];
  baseCvContent: string;
};

export type IntegrationsSettingsPayload = {
  tab: 'integrations';
  isPremium: boolean;
  installations: Awaited<ReturnType<typeof listExtensionInstallations>>;
  quota: { used: number; limit: number };
};

export type SettingsTabPayload =
  | AccountSettingsPayload
  | ProfileSettingsPayload
  | IntegrationsSettingsPayload;

export async function loadAccountSettings(user: SessionUser): Promise<AccountSettingsPayload> {
  const [row] = await db
    .select({ createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  return {
    tab: 'account',
    user: {
      name: user.name || '',
      email: user.email || '',
      image: user.image,
    },
    isPremium: hasProAccess(user),
    memberSince: row?.createdAt ? row.createdAt.toISOString() : null,
  };
}

export async function loadProfileSettings(userId: string): Promise<ProfileSettingsPayload> {
  const [[profileRow], userCvs, [baseCv]] = await Promise.all([
    db
      .select({ careerProfile: users.careerProfile })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select(cvListColumns)
      .from(cvs)
      .where(eq(cvs.userId, userId))
      .orderBy(desc(cvs.createdAt)),
    db
      .select(baseCvForAiColumns)
      .from(cvs)
      .where(eq(cvs.userId, userId))
      .orderBy(desc(cvs.isBase), desc(cvs.isPrincipal), desc(cvs.updatedAt))
      .limit(1),
  ]);

  return {
    tab: 'profile',
    careerProfile: profileRow?.careerProfile ?? null,
    userCvs: userCvs.map((cv) => ({
      id: cv.id,
      title: cv.title,
      isBase: cv.isBase,
      isPrincipal: cv.isPrincipal,
    })),
    baseCvContent: baseCv?.content || '',
  };
}

export async function loadIntegrationsSettings(user: SessionUser): Promise<IntegrationsSettingsPayload> {
  const isPremium = hasProAccess(user);
  const [installations, quota] = isPremium
    ? await Promise.all([listExtensionInstallations(user.id), getResearchQuota(user.id)])
    : [[], { used: 0, limit: 10, periodStart: new Date() }];
  return {
    tab: 'integrations',
    isPremium,
    installations,
    quota: { used: quota.used, limit: quota.limit },
  };
}
