import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { users } from '@/db/schema';
import { AgentApiError } from '@/lib/agent-api/errors';
import { asRecord, mergeCareerProfile } from '@/lib/agent-api/validate';
import { sanitizeDisplayName } from '@/lib/user-name';

export async function getAgentProfile(userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      subscriptionStatus: users.subscriptionStatus,
      careerProfile: users.careerProfile,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) throw new AgentApiError(404, 'not_found', 'No se ha encontrado el perfil.');
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    subscriptionStatus: row.subscriptionStatus,
    careerProfile: row.careerProfile ?? {},
  };
}

export async function updateAgentProfile(userId: string, body: unknown) {
  const record = asRecord(body);
  const hasName = 'name' in record;
  const hasProfile = 'careerProfile' in record;
  if (!hasName && !hasProfile) {
    throw new AgentApiError(400, 'empty_patch', 'Indica el nombre o el perfil que quieres guardar.');
  }

  const current = await getAgentProfile(userId);
  let name = current.name;
  let careerProfile = current.careerProfile;

  if (hasName) {
    const sanitized = sanitizeDisplayName(record.name);
    if (!sanitized) throw new AgentApiError(400, 'invalid_name', 'El nombre no es válido.');
    name = sanitized;
  }
  if (hasProfile) {
    careerProfile = mergeCareerProfile(current.careerProfile, record.careerProfile);
  }

  await db
    .update(users)
    .set({
      ...(hasName ? { name } : {}),
      ...(hasProfile ? { careerProfile } : {}),
    })
    .where(eq(users.id, userId));

  revalidatePath('/dashboard/profile');
  revalidatePath('/dashboard/applications');

  const profile = careerProfile && typeof careerProfile === 'object' ? careerProfile as Record<string, unknown> : {};
  return {
    data: {
      id: current.id,
      name,
      email: current.email,
      subscriptionStatus: current.subscriptionStatus,
      careerProfile,
    },
    audit: {
      hasName,
      hasBio: Boolean(profile.bio),
      skillsCount: Array.isArray(profile.skills) ? profile.skills.length : 0,
      projectsCount: Array.isArray(profile.keyProjects) ? profile.keyProjects.length : 0,
    },
  };
}
