import { normalizeProjects, normalizeSkills, skillsFromTechStack } from '@/lib/career-profile';
import { isLanguageRuleLine, type HardConstraints } from '@/lib/curation-constraints';
import { canonicalJson, evidenceHash } from './canonical';
import type { CandidateEvidence, EvidenceSource } from './types';

/** Facts only: generated summaries, cached constraints and modification dates are not inputs. */
export function candidateSourceFacts(profile: any, cvMarkdown: string, constraints: HardConstraints) {
  const source = profile && typeof profile === 'object' ? profile : {};
  return {
    preferences: {
      targetRoles: source.targetRoles ?? [],
      preferredWorkplaces: source.preferredWorkplaces ?? [],
      preferredLocations: source.preferredLocations ?? '',
      salaryMin: source.salaryMin ?? null,
      salaryTarget: source.salaryTarget ?? null,
      englishLevel: source.englishLevel ?? null,
      languages: source.languages ?? [],
      scoringPreferences: source.scoringPreferences ?? null,
      curationCriteria: source.curationCriteria ?? '',
      constraints,
    },
    experienceYears: source.experienceYears ?? null,
    skills: Array.isArray(source.skills) ? source.skills : skillsFromTechStack(source.techStack),
    techStack: source.techStack ?? {},
    experience: Array.isArray(source.keyProjects) ? source.keyProjects : [],
    bio: typeof source.bio === 'string' ? source.bio : '',
    masterDocument: typeof source.masterDocument === 'string' ? source.masterDocument : '',
    cvMarkdown: cvMarkdown || '',
  };
}

export function buildCandidateEvidence(
  profile: any,
  cvMarkdown: string,
  constraints: HardConstraints,
  maxChars = 18000,
): CandidateEvidence {
  const facts = candidateSourceFacts(profile, cvMarkdown, constraints);
  const sourceHash = evidenceHash(facts);
  const rawYears = facts.experienceYears;
  const years = typeof rawYears === 'number' ? rawYears
    : typeof rawYears === 'string' && /^\d+(?:\.\d+)?$/.test(rawYears.trim()) ? Number(rawYears.trim()) : NaN;
  const totalExperienceYears = Number.isFinite(years) && years >= 0 && years <= 80 ? years : null;
  // Preferences and explicit years have a reserved, independent budget, before narrative evidence.
  const criteria = String(facts.preferences.curationCriteria).split(/[.;\n]+|\s+(?:y|pero|and|but)\s+(?=prioriza|prefier|prefer|prioriti)/i)
    .filter((line) => !isLanguageRuleLine(line)).join('. ');
  const safeConstraints = { ...constraints } as Record<string, unknown>;
  delete safeConstraints.preferenceReviewRequired;
  const safePreferences = { ...facts.preferences, curationCriteria: criteria, scoringPreferences: undefined, constraints: safeConstraints };
  const protectedText = `Años de experiencia: ${totalExperienceYears ?? 'desconocido'}\nPreferencias activas (los ajustes se aplican en el host): ${canonicalJson(safePreferences)}`;
  const profileText = canonicalJson({
    experienceYears: totalExperienceYears,
    skills: facts.skills,
    techStack: facts.techStack,
    experience: facts.experience,
    bio: facts.bio,
    masterDocument: facts.masterDocument,
  });
  const budget = Math.max(0, maxChars - protectedText.length - 220);
  const hasCv = Boolean(facts.cvMarkdown.trim());
  const profileBudget = hasCv ? Math.min(profileText.length, Math.floor(budget * 0.55)) : budget;
  const cvBudget = Math.max(0, budget - Math.min(profileText.length, profileBudget));
  const sources: EvidenceSource[] = [
    { id: 'profile', text: profileText.slice(0, profileBudget) },
    { id: 'preferences', text: protectedText },
    ...(hasCv ? [{ id: 'cv', text: facts.cvMarkdown.slice(0, cvBudget) }] : []),
  ];
  const complete = profileText.length <= profileBudget && (!hasCv || facts.cvMarkdown.length <= cvBudget)
    && protectedText.length + 220 <= maxChars;
  const sufficient = normalizeSkills(facts.skills).length > 0 || skillsFromTechStack(facts.techStack).length > 0 || normalizeProjects(facts.experience).length > 0
    || facts.cvMarkdown.trim().length >= 80 || facts.bio.trim().length >= 80 || facts.masterDocument.trim().length >= 80;
  const card = [
    `candidate_source_hash:${sourceHash}`,
    `[fuente:preferences]\n${protectedText}`,
    `Fuentes completas: ${complete ? 'sí' : 'no; lo no visible es desconocido, no ausente'}`,
    ...sources.filter((source) => source.id !== 'preferences').map((source) => `[fuente:${source.id}]\n${source.text}`),
  ].join('\n\n');
  return { card, sourceHash, sources, complete, sufficient, totalExperienceYears };
}

export function buildCandidateCard(
  profile: any,
  cvMarkdown: string,
  constraints: HardConstraints,
  maxChars = 18000,
): string {
  return buildCandidateEvidence(profile, cvMarkdown, constraints, maxChars).card;
}
