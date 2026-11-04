import { formatCareerProfileContext } from '@/lib/career-profile';

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map(item => item.trim()) : [];
}

export function profileGoalOffer(careerProfile: unknown) {
  const profile = careerProfile && typeof careerProfile === 'object' ? careerProfile as Record<string, unknown> : {};
  const transition = profile.targetTransition && typeof profile.targetTransition === 'object'
    ? profile.targetTransition as Record<string, unknown>
    : {};
  const targetRoles = stringList(profile.targetRoles);
  const workplaces = stringList(profile.preferredWorkplaces);
  const targetRole = typeof transition.targetRole === 'string' ? transition.targetRole.trim() : '';
  const jobTitle = targetRoles[0] || targetRole || 'Perfil profesional';
  const company = workplaces[0] || 'Objetivo profesional';
  const factual = formatCareerProfileContext(profile).trim();
  const location = typeof profile.preferredLocations === 'string' ? profile.preferredLocations.trim() : '';
  const jobDescription = factual || [
    targetRoles.length ? `Roles: ${targetRoles.join(', ')}` : '',
    location ? `Ubicación: ${location}` : '',
    workplaces.length ? `Modalidad: ${workplaces.join(', ')}` : '',
    typeof profile.bio === 'string' ? profile.bio.trim() : '',
  ].filter(Boolean).join('\n') || 'Objetivo profesional del perfil.';
  return {
    jobTitle,
    company,
    jobDescription,
    url: null as string | null,
    platform: 'other' as const,
    addToApplications: false as const,
  };
}

export function agentResearchAdmission(input: { sufficient: boolean; hasDescribedOffer: boolean }): 'PROFILE_REQUIRED' | 'SCOUT_REQUIRED' | null {
  if (!input.sufficient) return 'PROFILE_REQUIRED';
  if (!input.hasDescribedOffer) return 'SCOUT_REQUIRED';
  return null;
}

export function scoutSearchQuery(careerProfile: unknown): string {
  const profile = careerProfile && typeof careerProfile === 'object' ? careerProfile as Record<string, unknown> : {};
  const roles = stringList(profile.targetRoles).slice(0, 3).join(' ');
  const location = typeof profile.preferredLocations === 'string' ? profile.preferredLocations.trim() : '';
  return [roles, location, 'job vacancy'].filter(Boolean).join(' ');
}
