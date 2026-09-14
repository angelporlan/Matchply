import {
  attachSkillEvidence,
  entriesOfKind,
  extractSkillsFromText,
  hasStructuredProfile,
  mergeSkills,
  normalizeProjects,
  normalizeSkills,
  skillsFromTechStack,
} from '@/lib/career-profile';
import {
  describeHardConstraintChips,
  type HardConstraints,
} from '@/lib/curation-constraints';

function asString(value: unknown, max = 400): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function compactSkills(profile: any, cvMarkdown: string): string {
  const skills = attachSkillEvidence(
    mergeSkills(normalizeSkills(profile?.skills), skillsFromTechStack(profile?.techStack)),
    normalizeProjects(profile?.keyProjects),
  );
  const fromCv = skills.length ? [] : extractSkillsFromText(cvMarkdown);
  const merged = skills.length ? skills : fromCv;
  if (!merged.length) return '';
  return merged.slice(0, 16).map((skill) => {
    const proof = skill.evidence ? ` · ${skill.evidence.slice(0, 80)}` : '';
    return `- ${skill.name} (${skill.proficiency})${proof}`;
  }).join('\n');
}

function compactExperience(profile: any): string {
  const projects = normalizeProjects(profile?.keyProjects);
  const jobs = entriesOfKind(projects, 'experience');
  const personal = entriesOfKind(projects, 'project');
  const lines = [...jobs.slice(0, 3), ...personal.slice(0, 2)].map((project) => {
    const stack = project.techStack ? ` (${project.techStack})` : '';
    const impact = project.impact ? ` → ${project.impact.slice(0, 80)}` : '';
    return `- ${project.title}${stack}: ${asString(project.description, 160)}${impact}`;
  });
  return lines.join('\n');
}

function cvSkillsDigest(markdown: string, maxChars = 600): string {
  if (!markdown.trim()) return '';
  const skillsMatch = markdown.match(/##[^\n]*(habilidades|skills|tecnolog)[^\n]*\n([\s\S]*?)(?=\n## |\n# |$)/i);
  const block = skillsMatch ? skillsMatch[0].replace(/\s+/g, ' ').trim() : '';
  if (block) return block.slice(0, maxChars);
  return markdown.replace(/\s+/g, ' ').trim().slice(0, Math.min(400, maxChars));
}

export function buildCandidateCard(
  profile: any,
  cvMarkdown: string,
  constraints: HardConstraints,
  maxChars = 2200,
): string {
  const parts: string[] = [];
  const structured = hasStructuredProfile(profile || {});
  const skills = compactSkills(profile, cvMarkdown);
  if (skills) parts.push(`Stack con evidencia:\n${skills}`);

  const experience = compactExperience(profile);
  if (experience) parts.push(`Experiencia:\n${experience}`);

  const prefs: string[] = [];
  if (Array.isArray(profile?.targetRoles) && profile.targetRoles.length) {
    prefs.push(`Roles objetivo: ${profile.targetRoles.filter((item: unknown) => typeof item === 'string').join(', ')}`);
  }
  if (profile?.experienceYears !== undefined && profile?.experienceYears !== null && profile?.experienceYears !== '') {
    prefs.push(`Años de experiencia: ${profile.experienceYears}`);
  }
  if (Array.isArray(profile?.preferredWorkplaces) && profile.preferredWorkplaces.length) {
    prefs.push(`Modalidad: ${profile.preferredWorkplaces.join(', ')}`);
  }
  if (asString(profile?.preferredLocations, 200)) prefs.push(`Ubicaciones: ${asString(profile.preferredLocations, 200)}`);
  if (profile?.salaryMin || profile?.salaryTarget) {
    prefs.push(`Salario: min ${profile.salaryMin || 'N/D'}€, objetivo ${profile.salaryTarget || 'N/D'}€`);
  }
  if (profile?.englishLevel) {
    prefs.push(`Inglés del candidato: ${profile.englishLevel}`);
  }
  if (prefs.length) parts.push(`Preferencias:\n${prefs.map((item) => `- ${item}`).join('\n')}`);

  const chips = describeHardConstraintChips(constraints);
  if (chips.length) parts.push(`Reglas duras (aplicadas en código):\n${chips.map((chip) => `- ${chip}`).join('\n')}`);

  const criteria = asString(profile?.curationCriteria, 400);
  if (criteria) parts.push(`Criterios del candidato:\n${criteria}`);

  if (!structured) {
    const digest = cvSkillsDigest(cvMarkdown);
    if (digest) parts.push(`CV (skills):\n${digest}`);
  } else {
    const master = asString(profile?.masterDocument, 400) || asString(profile?.bio, 280);
    if (master && !skills) parts.push(`Trayectoria:\n${master}`);
  }

  const output = parts.join('\n\n').trim();
  return (output || 'Perfil general de desarrollo de software.').slice(0, maxChars);
}
