export type SkillProficiency = 'used' | 'solid' | 'core';
export type SkillCategory =
  | 'frontend'
  | 'backend'
  | 'ai_ml'
  | 'cloud_devops'
  | 'database'
  | 'other';

export type ProfileSkill = {
  name: string;
  category: SkillCategory;
  proficiency: SkillProficiency;
  evidence?: string;
};

export type ProfileEntryKind = 'experience' | 'project';

export type KeyProject = {
  title: string;
  role?: string;
  techStack?: string;
  description: string;
  impact?: string;
  kind?: ProfileEntryKind;
  period?: string;
};

export type TechStackCategories = {
  frontend?: string[];
  backend?: string[];
  ai_ml?: string[];
  cloud_devops?: string[];
  database?: string[];
};

export type ProfileCompletenessItem = {
  label: string;
  boost: number;
  section: string;
};

export type ProfileCompleteness = {
  score: number;
  level: string;
  missingItems: ProfileCompletenessItem[];
};

const SKILL_CATEGORIES: SkillCategory[] = [
  'frontend',
  'backend',
  'ai_ml',
  'cloud_devops',
  'database',
  'other',
];

const PROFICIENCIES: SkillProficiency[] = ['used', 'solid', 'core'];

const PROFICIENCY_RANK: Record<SkillProficiency, number> = {
  used: 1,
  solid: 2,
  core: 3,
};

type CatalogEntry = {
  name: string;
  category: SkillCategory;
  pattern: RegExp;
};

const SKILL_CATALOG: CatalogEntry[] = [
  { name: 'TypeScript', category: 'frontend', pattern: /\bTypeScript\b|\bTSX\b/i },
  { name: 'JavaScript', category: 'frontend', pattern: /\bJavaScript\b|\bES6\+?\b/i },
  { name: 'React', category: 'frontend', pattern: /\bReact(?:\.js)?\b/i },
  { name: 'Next.js', category: 'frontend', pattern: /\bNext\.?js\b/i },
  { name: 'Angular', category: 'frontend', pattern: /\bAngular\b/i },
  { name: 'Vue', category: 'frontend', pattern: /\bVue(?:\.js)?\b/i },
  { name: 'HTML', category: 'frontend', pattern: /\bHTML5?\b/i },
  { name: 'CSS', category: 'frontend', pattern: /\bCSS3?\b/i },
  { name: 'Tailwind', category: 'frontend', pattern: /\bTailwind(?:CSS)?\b/i },
  { name: 'Node.js', category: 'backend', pattern: /\bNode(?:\.js)?\b/i },
  { name: 'Express', category: 'backend', pattern: /\bExpress(?:\.js)?\b/i },
  { name: 'NestJS', category: 'backend', pattern: /\bNest\.?js\b/i },
  { name: 'PHP', category: 'backend', pattern: /\bPHP\b/i },
  { name: 'Laravel', category: 'backend', pattern: /\bLaravel\b/i },
  { name: 'Python', category: 'backend', pattern: /\bPython\b/i },
  { name: 'Django', category: 'backend', pattern: /\bDjango\b/i },
  { name: 'Java', category: 'backend', pattern: /\bJava\b(?!Script)/i },
  { name: 'Spring Boot', category: 'backend', pattern: /\bSpring(?:\s*Boot)?\b/i },
  { name: 'Go', category: 'backend', pattern: /\bGolang\b|\bGo\s*(?:lang)?\b/i },
  { name: 'REST APIs', category: 'backend', pattern: /\bAPIs?\s+REST(?:ful)?\b|\bREST(?:ful)?\s+APIs?\b|\bAPIs?\s+RESTful\b/i },
  { name: 'GraphQL', category: 'backend', pattern: /\bGraphQL\b/i },
  { name: 'Stripe', category: 'backend', pattern: /\bStripe\b/i },
  { name: 'LLM', category: 'ai_ml', pattern: /\bLLMs?\b|\bmodelos?\s+de\s+lenguaje\b/i },
  { name: 'OpenAI', category: 'ai_ml', pattern: /\bOpenAI\b/i },
  { name: 'ChatGPT', category: 'ai_ml', pattern: /\bChatGPT\b/i },
  { name: 'Gemini', category: 'ai_ml', pattern: /\bGemini\b/i },
  { name: 'Claude', category: 'ai_ml', pattern: /\bClaude\b/i },
  { name: 'GitHub Copilot', category: 'ai_ml', pattern: /\bGitHub\s+Copilot\b|\bCopilot\b/i },
  { name: 'Cursor', category: 'ai_ml', pattern: /\bCursor\b/i },
  { name: 'LangChain', category: 'ai_ml', pattern: /\bLangChain\b/i },
  { name: 'RAG', category: 'ai_ml', pattern: /\bRAG\b/i },
  { name: 'Docker', category: 'cloud_devops', pattern: /\bDocker(?:\s+Compose)?\b/i },
  { name: 'Kubernetes', category: 'cloud_devops', pattern: /\bKubernetes\b|\bK8s\b/i },
  { name: 'CI/CD', category: 'cloud_devops', pattern: /\bCI\/CD\b/i },
  { name: 'AWS', category: 'cloud_devops', pattern: /\bAWS\b|\bAmazon Web Services\b/i },
  { name: 'GCP', category: 'cloud_devops', pattern: /\bGCP\b|\bGoogle Cloud\b/i },
  { name: 'Azure', category: 'cloud_devops', pattern: /\bAzure\b/i },
  { name: 'Linux', category: 'cloud_devops', pattern: /\bLinux\b/i },
  { name: 'Git', category: 'cloud_devops', pattern: /\bGit\b|\bGitHub\b/i },
  { name: 'PostgreSQL', category: 'database', pattern: /\bPostgreSQL\b|\bPostgres\b/i },
  { name: 'MySQL', category: 'database', pattern: /\bMySQL\b/i },
  { name: 'MongoDB', category: 'database', pattern: /\bMongoDB\b/i },
  { name: 'Redis', category: 'database', pattern: /\bRedis\b/i },
  { name: 'SQL', category: 'database', pattern: /\bSQL\b/i },
  { name: 'Jest', category: 'other', pattern: /\bJest\b/i },
  { name: 'PHPUnit', category: 'other', pattern: /\bPHPUnit\b/i },
  { name: 'Camunda', category: 'other', pattern: /\bCamunda\b/i },
];

const MAX_SKILLS = 40;
const MAX_PROJECTS = 16;

function asString(value: unknown, max = 500) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function isCategory(value: unknown): value is SkillCategory {
  return typeof value === 'string' && SKILL_CATEGORIES.includes(value as SkillCategory);
}

function isProficiency(value: unknown): value is SkillProficiency {
  return typeof value === 'string' && PROFICIENCIES.includes(value as SkillProficiency);
}

export function normalizeSkill(raw: unknown): ProfileSkill | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const name = asString(item.name, 60);
  if (name.length < 2) return null;
  return {
    name,
    category: isCategory(item.category) ? item.category : 'other',
    proficiency: isProficiency(item.proficiency) ? item.proficiency : 'solid',
    evidence: asString(item.evidence, 160) || undefined,
  };
}

export function normalizeSkills(raw: unknown): ProfileSkill[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const skills: ProfileSkill[] = [];
  for (const item of raw) {
    const skill = normalizeSkill(item);
    if (!skill) continue;
    const key = skill.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    skills.push(skill);
    if (skills.length >= MAX_SKILLS) break;
  }
  return skills;
}

export function normalizeProject(raw: unknown): KeyProject | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const title = asString(item.title, 120);
  const description = asString(item.description, 600);
  const impact = asString(item.impact, 240);
  if (!title && !description) return null;
  const kind = item.kind === 'experience' || item.kind === 'project' ? item.kind : undefined;
  return {
    title: title || (kind === 'experience' ? 'Puesto' : 'Proyecto'),
    role: asString(item.role, 80) || undefined,
    techStack: asString(item.techStack, 200) || undefined,
    description,
    impact: impact || undefined,
    kind,
    period: asString(item.period, 80) || undefined,
  };
}

export function normalizeProjects(raw: unknown): KeyProject[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const projects: KeyProject[] = [];
  for (const item of raw) {
    const project = normalizeProject(item);
    if (!project) continue;
    const key = `${project.kind || 'project'}:${project.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    projects.push(project);
    if (projects.length >= MAX_PROJECTS) break;
  }
  return projects;
}

export function skillsFromTechStack(techStack: unknown): ProfileSkill[] {
  if (!techStack || typeof techStack !== 'object') return [];
  const skills: ProfileSkill[] = [];
  for (const [category, values] of Object.entries(techStack as Record<string, unknown>)) {
    if (!Array.isArray(values)) continue;
    const resolvedCategory = isCategory(category) ? category : 'other';
    for (const value of values) {
      const name = asString(value, 60);
      if (name.length < 2) continue;
      skills.push({
        name,
        category: resolvedCategory,
        proficiency: 'solid',
      });
    }
  }
  return normalizeSkills(skills);
}

export function techStackFromSkills(skills: ProfileSkill[]): TechStackCategories {
  const stack: TechStackCategories = {
    frontend: [],
    backend: [],
    ai_ml: [],
    cloud_devops: [],
    database: [],
  };
  for (const skill of skills) {
    if (skill.category === 'other') continue;
    const bucket = stack[skill.category] || [];
    if (!bucket.some((name) => name.toLowerCase() === skill.name.toLowerCase())) {
      bucket.push(skill.name);
    }
    stack[skill.category] = bucket;
  }
  return stack;
}

export function mergeSkills(current: ProfileSkill[], incoming: ProfileSkill[]): ProfileSkill[] {
  const map = new Map<string, ProfileSkill>();
  for (const skill of current) {
    const key = skill.name.toLowerCase();
    if (!map.has(key)) map.set(key, skill);
  }
  for (const skill of incoming) {
    const key = skill.name.toLowerCase();
    const prev = map.get(key);
    if (!prev) {
      if (map.size >= MAX_SKILLS) continue;
      map.set(key, skill);
      continue;
    }
    map.set(key, {
      name: prev.name,
      category: prev.category === 'other' && skill.category !== 'other' ? skill.category : prev.category,
      proficiency:
        PROFICIENCY_RANK[skill.proficiency] > PROFICIENCY_RANK[prev.proficiency]
          ? skill.proficiency
          : prev.proficiency,
      evidence: prev.evidence || skill.evidence,
    });
  }
  return Array.from(map.values());
}

export function addUniqueSkill(current: ProfileSkill[], incoming: ProfileSkill): ProfileSkill[] {
  const skill = normalizeSkill(incoming);
  if (!skill) return current;
  if (current.some((item) => item.name.toLowerCase() === skill.name.toLowerCase())) return current;
  return [...current, skill].slice(0, MAX_SKILLS);
}

export function resolveEntryKind(entry: KeyProject): ProfileEntryKind {
  if (entry.kind === 'experience' || entry.kind === 'project') return entry.kind;
  if (/\s·\s/.test(entry.title || '')) return 'experience';
  if (/\b(business school|universidad|university|s\.l\.|inc\.|ltd|gmbh|consultor)/i.test(entry.title || '')) {
    return 'experience';
  }
  if (/\b(saas|plataforma|proyecto propio|side project)\b/i.test(`${entry.title} ${entry.description}`)) {
    return 'project';
  }
  return 'project';
}

function titlesOverlap(left: string, right: string) {
  const a = left.toLowerCase().trim();
  const b = right.toLowerCase().trim();
  if (!a || !b) return false;
  if (a === b) return true;
  const aTail = a.split(' · ').pop() || a;
  const bTail = b.split(' · ').pop() || b;
  return a.includes(b) || b.includes(a) || aTail === bTail;
}

export function assignEntryKinds(entries: KeyProject[], extracted: KeyProject[] = []): KeyProject[] {
  return entries.map((entry) => {
    if (entry.kind === 'experience' || entry.kind === 'project') return entry;
    const match = extracted.find((item) => titlesOverlap(item.title, entry.title) || titlesOverlap(item.role || '', entry.title));
    return { ...entry, kind: match ? resolveEntryKind(match) : resolveEntryKind(entry) };
  });
}

export function entriesOfKind(entries: KeyProject[], kind: ProfileEntryKind): KeyProject[] {
  return entries.filter((entry) => resolveEntryKind(entry) === kind);
}

export function mergeProjects(current: KeyProject[], incoming: KeyProject[]): KeyProject[] {
  const map = new Map<string, KeyProject>();
  for (const project of [...current, ...incoming]) {
    const key = `${resolveEntryKind(project)}:${project.title.toLowerCase()}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, project);
      continue;
    }
    map.set(key, {
      title: prev.title,
      role: prev.role || project.role,
      techStack: prev.techStack || project.techStack,
      description: prev.description.length >= project.description.length ? prev.description : project.description,
      impact: prev.impact || project.impact,
      kind: prev.kind || project.kind,
      period: prev.period || project.period,
    });
  }
  return Array.from(map.values()).slice(0, MAX_PROJECTS);
}

function countSkillMentions(text: string, skill: CatalogEntry) {
  const matches = text.match(new RegExp(skill.pattern.source, 'gi'));
  return matches?.length || 0;
}

function findEvidence(skillName: string, projects: KeyProject[], fallback?: string) {
  const needle = skillName.toLowerCase();
  const project = projects.find((item) =>
    `${item.title} ${item.role || ''} ${item.techStack || ''} ${item.description} ${item.impact || ''}`
      .toLowerCase()
      .includes(needle),
  );
  if (project) return project.title;
  return fallback;
}

export function extractSkillsFromText(text: string, projects: KeyProject[] = []): ProfileSkill[] {
  const source = text || '';
  if (!source.trim()) return [];
  const skills: ProfileSkill[] = [];
  for (const entry of SKILL_CATALOG) {
    const mentions = countSkillMentions(source, entry);
    if (!mentions) continue;
    const specialized = new RegExp(
      `(especializad[oa]|s[oó]lid[oa]|n[uú]cleo|core).{0,40}${entry.pattern.source}|${entry.pattern.source}.{0,40}(especializad[oa]|s[oó]lid[oa])`,
      'i',
    ).test(source);
    const proficiency: SkillProficiency = specialized || mentions >= 3 ? 'core' : mentions >= 2 ? 'solid' : 'used';
    skills.push({
      name: entry.name,
      category: entry.category,
      proficiency,
      evidence: findEvidence(entry.name, projects, mentions ? 'Trayectoria' : undefined),
    });
  }
  return normalizeSkills(skills);
}

function impactFromLines(lines: string[]) {
  const withMetric = lines.find((line) => /\d/.test(line) && /(%|horas?|registros?|usuarios?|€|\$|cobertura)/i.test(line));
  return withMetric ? asString(withMetric.replace(/^[\s*\-•]+/, ''), 240) : undefined;
}

export function extractProjectsFromMarkdown(markdown: string): KeyProject[] {
  if (!markdown?.trim()) return [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  type Block = { heading: string; section: string; lines: string[] };
  const blocks: Block[] = [];
  let section = '';
  let current: Block | null = null;

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) {
      if (current) blocks.push(current);
      current = null;
      section = h2[1].trim();
      continue;
    }
    const h3 = line.match(/^###\s+(.+)/);
    if (h3) {
      if (current) blocks.push(current);
      current = { heading: h3[1].trim(), section, lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) blocks.push(current);

  const projects: KeyProject[] = [];
  for (const block of blocks) {
    if (/educaci[oó]n|education|habilidad|skills/i.test(block.section)) continue;
    const isExperience = /experiencia|experience|historial/i.test(block.section);
    const isProject = /proyecto|project/i.test(block.section);
    if (!isExperience && !isProject) continue;

    const companyMatch = block.lines.map((line) => line.match(/\*\*([^*]+)\*\*/)).find(Boolean);
    const company = companyMatch?.[1]?.trim() || '';
    const periodMatch = block.lines
      .map((line) => line.match(/\|\s*\*([^*]+)\*/) || line.match(/\*([^*]*(?:–|-|Presente|Present|actualidad)[^*]*)\*/i))
      .find(Boolean);
    const bodyLines = block.lines
      .map((line) => line.replace(/^[\s>*]+/, '').trim())
      .filter((line) => line && !/^\*\*[^*]+\*\*/.test(line) && !/^[\d/|*\sA-Za-záéíóúÁÉÍÓÚ.-]+–/.test(line));
    const bullets = bodyLines
      .filter((line) => /^[-*•]/.test(line))
      .map((line) => line.replace(/^[-*•]\s*/, ''));
    const prose = bodyLines.filter((line) => !/^[-*•]/.test(line)).join(' ');
    const description = asString(prose || bullets.slice(0, 2).join(' '), 600);
    const title = isProject ? block.heading : (company || block.heading);
    const detectedSkills = extractSkillsFromText(`${block.heading}\n${block.lines.join('\n')}`);
    projects.push({
      title,
      role: isExperience ? block.heading : undefined,
      techStack: detectedSkills.map((skill) => skill.name).slice(0, 8).join(', ') || undefined,
      description,
      impact: impactFromLines(bullets),
      kind: isExperience ? 'experience' : 'project',
      period: asString(periodMatch?.[1], 80) || undefined,
    });
  }

  return normalizeProjects(projects);
}

export function attachSkillEvidence(skills: ProfileSkill[], projects: KeyProject[]): ProfileSkill[] {
  return skills.map((skill) => ({
    ...skill,
    evidence: skill.evidence || findEvidence(skill.name, projects),
  }));
}

export function detectStructuredProfile(input: {
  bio?: string;
  masterDocument?: string;
  techStack?: unknown;
  keyProjects?: unknown;
  skills?: unknown;
  cvMarkdown?: string;
}) {
  const fromCv = extractProjectsFromMarkdown(input.cvMarkdown || '');
  const projects = assignEntryKinds(
    mergeProjects(normalizeProjects(input.keyProjects), fromCv),
    fromCv,
  );
  const corpus = [
    input.masterDocument || '',
    input.bio || '',
    input.cvMarkdown || '',
    projects.map((project) => `${project.title} ${project.description} ${project.impact || ''}`).join('\n'),
  ].join('\n');
  const detectedSkills = mergeSkills(
    normalizeSkills(input.skills),
    mergeSkills(skillsFromTechStack(input.techStack), extractSkillsFromText(corpus, projects)),
  );
  return {
    skills: attachSkillEvidence(detectedSkills, projects),
    projects,
  };
}

export function hydrateStructuredProfile(
  profile: Record<string, any> | null | undefined,
  extras: { cvMarkdown?: string; bio?: string; masterDocument?: string } = {},
) {
  const source = profile && typeof profile === 'object' ? profile : {};
  const detected = detectStructuredProfile({
    bio: extras.bio ?? source.bio,
    masterDocument: extras.masterDocument ?? source.masterDocument,
    techStack: source.techStack,
    keyProjects: source.keyProjects,
    skills: source.skills,
    cvMarkdown: extras.cvMarkdown,
  });
  return {
    skills: detected.skills,
    keyProjects: detected.projects,
    techStack: techStackFromSkills(detected.skills),
  };
}

export function hasStructuredProfile(profile: { skills?: unknown; keyProjects?: unknown; techStack?: unknown }) {
  return (
    normalizeSkills(profile.skills).length > 0
    || normalizeProjects(profile.keyProjects).length > 0
    || skillsFromTechStack(profile.techStack).length > 0
  );
}

export function computeProfileCompleteness(input: {
  bio?: string;
  masterDocument?: string;
  curationCriteria?: string;
  skills?: ProfileSkill[];
  keyProjects?: KeyProject[];
  preferredLocations?: string;
  companyPreferences?: string;
  salaryMin?: number | '' | null;
  preferredWorkplaces?: string[];
}): ProfileCompleteness {
  let score = 0;
  const missing: ProfileCompletenessItem[] = [];

  if ((input.bio || '').trim().length >= 80) score += 15;
  else missing.push({ label: '+15% Pega tu experiencia', boost: 15, section: 'dump' });

  if ((input.masterDocument || '').trim().length >= 120) score += 15;
  else missing.push({ label: '+15% Documento maestro', boost: 15, section: 'master' });

  const skills = input.skills || [];
  const withEvidence = skills.filter((skill) => (skill.evidence || '').trim().length >= 2);
  if (skills.length >= 5) score += 20;
  else missing.push({ label: '+20% Añade tu stack (mín. 5)', boost: 20, section: 'skills' });

  if (withEvidence.length >= 3) score += 15;
  else missing.push({ label: '+15% Enlaza skills a un logro', boost: 15, section: 'skills' });

  const projects = (input.keyProjects || []).filter(
    (project) => (project.title || '').trim() && ((project.description || '').trim() || (project.impact || '').trim()),
  );
  if (projects.length >= 1) score += 15;
  else missing.push({ label: '+15% Añade un puesto o un proyecto', boost: 15, section: 'experience' });

  if ((input.curationCriteria || '').trim().length >= 20) score += 10;
  else missing.push({ label: '+10% Reglas de puntuación', boost: 10, section: 'criteria' });

  const hasPreferences = Boolean(
    (input.preferredLocations || '').trim()
    || (input.companyPreferences || '').trim()
    || (typeof input.salaryMin === 'number' && input.salaryMin > 0)
    || (input.preferredWorkplaces || []).length > 0,
  );
  if (hasPreferences) score += 10;
  else missing.push({ label: '+10% Ubicación, modalidad o salario', boost: 10, section: 'criteria' });

  let level = 'Básico';
  if (score >= 80) level = 'Listo para la IA';
  else if (score >= 50) level = 'A medio camino';

  return { score, level, missingItems: missing };
}

function compactProjects(projects: KeyProject[], limit = 3) {
  return projects.slice(0, limit).map((project) => {
    const impact = project.impact ? ` [Impacto: ${project.impact}]` : '';
    const stack = project.techStack ? ` (${project.techStack})` : '';
    return `- ${project.title}${stack}: ${asString(project.description, 220)}${impact}`;
  }).join('\n');
}

function compactSkills(skills: ProfileSkill[], limit = 16) {
  return skills.slice(0, limit).map((skill) => {
    const proof = skill.evidence ? ` · prueba: ${skill.evidence}` : '';
    return `- ${skill.name} (${skill.proficiency}${skill.category !== 'other' ? `, ${skill.category}` : ''})${proof}`;
  }).join('\n');
}

export function formatCareerProfileContext(profile: any, maxChars = 3200): string {
  if (!profile || typeof profile !== 'object') return '';
  const skills = attachSkillEvidence(
    mergeSkills(normalizeSkills(profile.skills), skillsFromTechStack(profile.techStack)),
    normalizeProjects(profile.keyProjects),
  );
  const projects = normalizeProjects(profile.keyProjects);
  const master = asString(profile.masterDocument, 2500);
  const bio = asString(profile.bio, 1200);
  const chunks: string[] = [];

  if (master) chunks.push(master);
  else if (bio) chunks.push(`Trayectoria:\n${bio}`);

  if (skills.length) chunks.push(`Stack con evidencia:\n${compactSkills(skills)}`);
  const jobs = entriesOfKind(projects, 'experience');
  const personal = entriesOfKind(projects, 'project');
  if (jobs.length) chunks.push(`Experiencia profesional:\n${compactProjects(jobs)}`);
  if (personal.length) chunks.push(`Proyectos personales:\n${compactProjects(personal)}`);

  const prefs: string[] = [];
  if (Array.isArray(profile.targetRoles) && profile.targetRoles.length) {
    prefs.push(`Roles objetivo: ${profile.targetRoles.filter((item: unknown) => typeof item === 'string').join(', ')}`);
  }
  if (profile.experienceYears !== undefined && profile.experienceYears !== null && profile.experienceYears !== '') {
    prefs.push(`Años de experiencia: ${profile.experienceYears}`);
  }
  if (Array.isArray(profile.preferredWorkplaces) && profile.preferredWorkplaces.length) {
    prefs.push(`Modalidad: ${profile.preferredWorkplaces.join(', ')}`);
  }
  if (asString(profile.preferredLocations, 200)) prefs.push(`Ubicaciones: ${asString(profile.preferredLocations, 200)}`);
  if (asString(profile.companyPreferences, 220)) prefs.push(`Empresas: ${asString(profile.companyPreferences, 220)}`);
  if (profile.salaryMin || profile.salaryTarget) {
    prefs.push(`Salario: min ${profile.salaryMin || 'N/D'}€, objetivo ${profile.salaryTarget || 'N/D'}€`);
  }
  if (prefs.length) chunks.push(`Preferencias:\n${prefs.map((item) => `- ${item}`).join('\n')}`);

  if (asString(profile.curationCriteria, 1500)) {
    chunks.push(`Criterios de puntuación:\n${asString(profile.curationCriteria, 1500)}`);
  }

  let output = chunks.join('\n\n').trim();
  if (output.length <= maxChars) return output;

  const keepOrder = chunks.filter((chunk) => !chunk.startsWith('Trayectoria') && chunk !== master);
  const trimmedMaster = master ? master.slice(0, Math.max(400, maxChars - keepOrder.join('\n\n').length - 20)) : '';
  output = [trimmedMaster, ...keepOrder].filter(Boolean).join('\n\n').trim();
  return output.slice(0, maxChars);
}

export function normalizeCareerProfileFields(profile: Record<string, any>): Record<string, any> {
  const keyProjects = assignEntryKinds(normalizeProjects(profile.keyProjects));
  const skills = attachSkillEvidence(
    mergeSkills(normalizeSkills(profile.skills), skillsFromTechStack(profile.techStack)),
    keyProjects,
  );
  return {
    ...profile,
    skills,
    keyProjects,
    techStack: techStackFromSkills(skills),
  };
}

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  ai_ml: 'IA',
  cloud_devops: 'Cloud / DevOps',
  database: 'Datos',
  other: 'Otra',
};

export const SKILL_PROFICIENCY_LABELS: Record<SkillProficiency, string> = {
  used: 'Usada',
  solid: 'Sólida',
  core: 'Núcleo',
};

export const EMPTY_ENTRY: KeyProject = {
  title: '',
  role: '',
  techStack: '',
  description: '',
  impact: '',
  period: '',
};

export const EMPTY_PROJECT: KeyProject = {
  ...EMPTY_ENTRY,
  kind: 'project',
};

export const EMPTY_EXPERIENCE: KeyProject = {
  ...EMPTY_ENTRY,
  kind: 'experience',
};
