import { normalizedEvidenceText } from './canonical';
import { extractSkillsFromText } from '@/lib/career-profile';
import { computeOverall, isCanonicalMatchBreakdown } from './rubric';
import { MATCH_DIMENSION_KEYS, MATCH_EXPLANATION_VERSION, MATCH_PROMPT_VERSION, MatchValidationError, type CandidateEvidence, type EvidenceQuote, type MatchAdjustment, type MatchBreakdown, type MatchDetails, type MatchEvidenceSnapshot, type MatchOfferCard, type MatchRequirement } from './types';

const KINDS = ['skill', 'experience', 'seniority', 'language', 'other'];
const STATUSES = ['met', 'missing', 'partial', 'unknown'];
const OPTIONAL = /\b(?:preferred|desirable|nice.to.have|a plus|optional|not required|no (?:se )?requiere|deseable|valorable|se valorar|un plus|opcional)\b/i;
const MANDATORY = /\b(?:must|required|mandatory|essential|indispensable|obligatori[oa]|imprescindible|requerid[oa]|requisitos? indispensables|exige)\b/i;

function record(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;
}
function text(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function quote(value: unknown, sources: Array<{ id: string; text: string }>): EvidenceQuote | null {
  const raw = record(value);
  if (!raw || typeof raw.quote !== 'string' || raw.quote.trim().length < 4 || raw.quote.length > 1500) return null;
  const source = sources.find((item) => item.id === raw.sourceId);
  if (!source || !normalizedEvidenceText(source.text).includes(normalizedEvidenceText(raw.quote))) return null;
  return { sourceId: source.id, quote: raw.quote.trim() };
}
function skillPresent(name: string, corpus: string): boolean {
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (/^(?:go|golang)$/i.test(name)) {
    // “go to the office” is an English verb, not evidence of a programming language.
    return /\bgolang\b/i.test(corpus)
      || /\bGo\b(?!\s+(?:to|home|back|out|ahead|through|away|on)\b)/.test(corpus)
      || /\bgo\s+(?:lang(?:uage)?|programming|developer|development|backend|microservices?|engineer)\b/i.test(corpus)
      || /["']go["']/i.test(corpus);
  }
  const aliases: Record<string, string[]> = { 'node.js': ['node.js', 'nodejs', 'node'], 'typescript': ['typescript'] };
  return (aliases[name.toLowerCase()] ?? [name]).some((alias) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(alias)}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(corpus));
}
function mandatoryEvidence(requirement: MatchRequirement, offer: MatchOfferCard): boolean {
  const evidence = requirement.offerEvidence.quote;
  if (OPTIONAL.test(evidence)) return false;
  if (MANDATORY.test(evidence)) return true;
  const index = offer.sourceText.indexOf(evidence);
  if (index < 0) return false;
  let mandatory = false;
  for (const line of offer.sourceText.slice(0, index).split('\n')) {
    const heading = line.replace(new RegExp('^[^\\p{L}\\p{N}]+', 'u'), '').replace(/[*_#]/g, '').trim();
    if (heading.length > 120) continue;
    if (/^(?:requirements|minimum qualifications|required qualifications|qualifications|requisitos|must.haves|perfil buscado|what we are looking for)\b/i.test(heading)) mandatory = !OPTIONAL.test(heading);
    else if (/^(?:preferred|nice.to.have|benefits|perks|about|responsibilit|what we offer|qu[eé] ofrecemos|beneficios)\b/i.test(heading)) mandatory = false;
  }
  return mandatory;
}
function scopeSupported(scope: string, evidence: string): boolean {
  if (scope === 'overall') return /experienceYears|(?:total|professional) experience|experiencia (?:total|profesional)|a[nñ]os de experiencia\s*:/i.test(evidence);
  const name = scope.replace(/^(?:domain|skill|dominio|tecnolog[ií]a):\s*/, '');
  const aliases: Record<string, string[]> = { ai: ['AI', 'IA', 'artificial intelligence', 'inteligencia artificial'], ml: ['ML', 'machine learning'] };
  return (aliases[name] ?? [name]).some((alias) => skillPresent(alias, evidence));
}
function numericYears(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 80 ? value : undefined;
}
function yearsSupported(years: number, evidence: string): boolean {
  const matches = Array.from(evidence.matchAll(/(?:experienceYears["']?\s*:\s*|(?:experiencia|experience)\s*[:=]\s*)(\d+(?:\.\d+)?)|\b(\d+(?:\.\d+)?)\s*(?:\+|[-–]\s*\d+)?\s*(?:years?|a[nñ]os?)\b/gi));
  return matches.some((match) => Number(match[1] ?? match[2]) === years);
}

function explicitYears(text: string): number[] {
  return Array.from(text.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:\+|[-–]\s*\d+)?\s*(?:years?|a[nñ]os?)\b/gi))
    .map((match) => Number(match[1])).filter((years) => years <= 80);
}
function assertMandatoryCoverage(requirements: MatchRequirement[], offer: MatchOfferCard) {
  let requirementsSection = false;
  for (const rawLine of offer.requirementsExtract.split('\n')) {
    const line = rawLine.replace(/^[\s#*•✅_\-]+/, '').trim();
    const heading = /^(?:requirements|minimum qualifications|required qualifications|qualifications|requisitos|must.haves|perfil buscado|what we are looking for)\b/i.test(line);
    if (heading) requirementsSection = !OPTIONAL.test(line);
    else if (/^(?:preferred|nice.to.have|benefits|perks|about|responsibilit|what we offer|qu[eé] ofrecemos|beneficios)\b/i.test(line)) requirementsSection = false;
    if (heading && !line.includes(':') && line.length < 70 && !MANDATORY.test(line) && !explicitYears(line).length && !extractSkillsFromText(line).length) continue;
    for (const sentence of line.split(/;|(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean)) {
      const years = explicitYears(sentence);
      const skills = extractSkillsFromText(sentence).filter((skill) => skillPresent(skill.name, sentence));
      if (OPTIONAL.test(sentence) || sentence.length < 12 || (!MANDATORY.test(sentence) && !(requirementsSection && (years.length || skills.length)))) continue;
      const normalized = normalizedEvidenceText(sentence);
      const refs = requirements.filter((requirement) => normalizedEvidenceText(requirement.offerEvidence.quote).includes(normalized));
      if (!refs.length) throw new MatchValidationError('La IA omitió evidencia de una frase obligatoria de la oferta.');
      if (years.some((year) => !refs.some((requirement) => requirement.kind === 'experience' && requirement.requiredYears === year))) throw new MatchValidationError('La IA omitió o alteró el mínimo de años de un requisito obligatorio.');
      if (skills.some((skill) => !refs.some((requirement) => requirement.kind === 'skill' && [requirement.name, ...requirement.alternatives].some((name) => skillPresent(skill.name, name))))) throw new MatchValidationError('La IA omitió una competencia de un requisito obligatorio.');
    }
  }
}
function positiveSkillEvidence(name: string, evidence: string): boolean {
  // Scope a denial to its clause: “React in production, not Angular” still proves React.
  return evidence.split(/[,;\n]|(?<=[.!?])\s+|\b(?:but|pero)\b/i).some((clause) => {
    if (!skillPresent(name, clause)) return false;
    return !/\b(?:no|not(?!\s+only\b)|never|without|sin|nunca|carezco)\b/i.test(clause);
  });
}

export function readMatchBreakdown(value: unknown): MatchBreakdown {
  const input = record(value);
  if (!input || !MATCH_DIMENSION_KEYS.every((key) => typeof input[key] === 'number' && Number.isFinite(input[key]) && input[key] >= 0 && input[key] <= 100)) {
    throw new MatchValidationError('La evaluación debe contener las cinco dimensiones numéricas de 0 a 100.');
  }
  return Object.fromEntries(MATCH_DIMENSION_KEYS.map((key) => [key, Math.round(input[key])])) as MatchBreakdown;
}

export function validateRequirements(value: unknown, candidate: CandidateEvidence, offer: MatchOfferCard): MatchRequirement[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 40) throw new MatchValidationError('Faltan requisitos verificables de la oferta.');
  const ids = new Set<string>();
  const corpus = candidate.sources.filter((source) => source.id !== 'preferences').map((source) => source.text).join('\n');
  const requirements = value.map((entry) => {
    const raw = record(entry);
    const id = text(raw?.id, 80);
    const name = text(raw?.name, 160);
    const offerEvidence = quote(raw?.offerEvidence, [{ id: 'offer', text: offer.sourceText }]);
    if (!raw || !id || ids.has(id) || !name || !KINDS.includes(raw.kind) || !STATUSES.includes(raw.status)
      || !['required', 'preferred'].includes(raw.importance) || typeof raw.core !== 'boolean' || !offerEvidence) {
      throw new MatchValidationError('Un requisito contiene identificadores, clasificación o citas inválidas.');
    }
    ids.add(id);
    if (!Array.isArray(raw.candidateEvidence)) throw new MatchValidationError('Faltan las referencias de evidencia del candidato.');
    const candidateEvidence = raw.candidateEvidence.map((item: unknown) => quote(item, candidate.sources));
    if (candidateEvidence.some((item: EvidenceQuote | null) => !item)) throw new MatchValidationError('Una cita del candidato no pertenece a las fuentes proporcionadas.');
    if (raw.status === 'met' && !candidateEvidence.length) throw new MatchValidationError('Un requisito cumplido necesita evidencia del candidato.');
    if (raw.alternatives !== undefined && (!Array.isArray(raw.alternatives) || raw.alternatives.some((item: unknown) => typeof item !== 'string'))) throw new MatchValidationError('Las alternativas deben ser una lista de requisitos.');
    if (raw.kind === 'skill' && !skillPresent(name, offerEvidence.quote)) throw new MatchValidationError('La competencia no aparece en su cita de la oferta.');
    const alternatives = (raw.alternatives ?? []).map((item: string) => item.trim()).filter(Boolean).slice(0, 12);
    if (alternatives.some((alternative: string) => !skillPresent(alternative, offerEvidence.quote))) throw new MatchValidationError('Una alternativa no aparece en la evidencia de la oferta.');
    const requirement: MatchRequirement = {
      id, name, kind: raw.kind, importance: raw.importance, core: raw.core, status: raw.status,
      offerEvidence, candidateEvidence: candidateEvidence as EvidenceQuote[], alternatives,
    };
    if (raw.kind === 'skill' && raw.status === 'met' && !requirement.candidateEvidence.some((item) => item.sourceId !== 'preferences' && [name, ...alternatives].some((skill) => positiveSkillEvidence(skill, item.quote)))) throw new MatchValidationError('La competencia acreditada no aparece en la evidencia profesional del candidato.');
    if (OPTIONAL.test(offerEvidence.quote)) requirement.importance = 'preferred';
    if (requirement.status === 'missing' && (!candidate.complete || !offer.complete)) requirement.status = 'unknown';
    if (requirement.kind === 'skill' && requirement.status === 'missing') {
      // A keyword-only model mismatch is not evidence of absence from complete sources.
      if (skillPresent(name, corpus) || alternatives.some((alternative: string) => skillPresent(alternative, corpus))) requirement.status = 'unknown';
      if (/\b(?:or|either|alternatively|equivalent|o|alternativas?)\b/i.test(offerEvidence.quote) && alternatives.length === 0) requirement.status = 'unknown';
    }
    const requiredYears = numericYears(raw.requiredYears);
    const candidateYears = numericYears(raw.candidateYears);
    if (requiredYears !== undefined && yearsSupported(requiredYears, offerEvidence.quote)) requirement.requiredYears = requiredYears;
    if (candidateYears !== undefined && yearsSupported(candidateYears, requirement.candidateEvidence.map((item) => item.quote).join(' '))) requirement.candidateYears = candidateYears;
    const requiredScope = text(raw.experienceScope, 100).toLowerCase();
    const candidateScope = text(raw.candidateExperienceScope, 100).toLowerCase();
    if (requiredScope && scopeSupported(requiredScope, offerEvidence.quote)) requirement.experienceScope = requiredScope;
    if (candidateScope && scopeSupported(candidateScope, requirement.candidateEvidence.map((item) => item.quote).join(' '))) requirement.candidateExperienceScope = candidateScope;
    // Total professional experience is an upper bound on any specialized experience.
    // It proves a gap only in this direction; never infer specialized years from the total.
    if (requirement.kind === 'experience' && requirement.requiredYears !== undefined
      && candidate.totalExperienceYears !== null && requirement.requiredYears - candidate.totalExperienceYears >= 4) {
      requirement.candidateYears = candidate.totalExperienceYears;
      requirement.candidateYearsIsUpperBound = true;
      const reference = candidate.sources.find((source) => source.id === 'preferences');
      const statement = `Años de experiencia: ${candidate.totalExperienceYears}`;
      if (reference?.text.includes(statement)) requirement.candidateEvidence.push({ sourceId: reference.id, quote: statement });
      requirement.status = 'partial';
    } else if (requirement.kind === 'experience' && requirement.requiredYears !== undefined && requirement.candidateYears !== undefined
      && (requirement.candidateYearsIsUpperBound || (requirement.experienceScope && requirement.experienceScope === requirement.candidateExperienceScope))
      && requirement.requiredYears > requirement.candidateYears && requirement.status === 'met') requirement.status = 'partial';
    return requirement;
  });
  assertMandatoryCoverage(requirements, offer);
  return requirements;
}

export function applyEvidenceAdjustments(baseBreakdown: MatchBreakdown, requirements: MatchRequirement[], offer: MatchOfferCard) {
  const scoreBreakdown = { ...baseBreakdown };
  const adjustments: MatchAdjustment[] = [];
  for (const requirement of requirements) {
    if (requirement.importance !== 'required' || !mandatoryEvidence(requirement, offer)) continue;
    if (requirement.kind === 'experience'
      && requirement.requiredYears !== undefined && requirement.candidateYears !== undefined
      && (requirement.candidateYearsIsUpperBound || (requirement.experienceScope && requirement.experienceScope === requirement.candidateExperienceScope))
      && requirement.requiredYears - requirement.candidateYears >= 4) {
      scoreBreakdown.experience_fit = Math.min(scoreBreakdown.experience_fit, 40);
      adjustments.push({ code: 'experience_gap', requirementIds: [requirement.id], dimension: 'experience_fit', dimensionCap: 40, overallCap: 59,
        reason: requirement.candidateYearsIsUpperBound
          ? `Piden ${requirement.requiredYears} años; la experiencia profesional total declarada es ${requirement.candidateYears}, límite superior de la experiencia especializada.`
          : `Brecha demostrada: ${requirement.requiredYears} años requeridos frente a ${requirement.candidateYears} en ${requirement.experienceScope}.` });
    }
    if (requirement.kind === 'skill' && requirement.core && requirement.status === 'missing') {
      scoreBreakdown.tech_stack = Math.min(scoreBreakdown.tech_stack, 35);
      adjustments.push({ code: 'core_skill_gap', requirementIds: [requirement.id], dimension: 'tech_stack', dimensionCap: 35, overallCap: 59,
        reason: `Falta documentada en el requisito principal obligatorio: ${requirement.name}.` });
    }
    // A Staff/Principal title alone never proves a responsibility gap.
    if (requirement.kind === 'seniority' && requirement.core && requirement.status === 'missing'
      && /\b(?:manage|management|leadership|lead teams|gesti[oó]n|dirigir equipos|direcci[oó]n)\b/i.test(requirement.offerEvidence.quote)
      && requirement.candidateEvidence.some((item) => /\b(?:no|without|sin)\b.{0,55}\b(?:manage|management|leadership|gesti[oó]n|direcci[oó]n|equipos)\b/i.test(item.quote))) {
      scoreBreakdown.experience_fit = Math.min(scoreBreakdown.experience_fit, 40);
      adjustments.push({ code: 'seniority_gap', requirementIds: [requirement.id], dimension: 'experience_fit', dimensionCap: 40, overallCap: 59,
        reason: `La responsabilidad obligatoria de ${requirement.name} contradice la experiencia declarada.` });
    }
  }
  const baseScore = computeOverall(baseBreakdown);
  const score = Math.min(computeOverall(scoreBreakdown), ...adjustments.map((item) => item.overallCap));
  return { baseScore, score, scoreBreakdown, adjustments };
}

export function isMatchEvidenceSnapshot(value: unknown): value is MatchEvidenceSnapshot {
  const item = record(value);
  if (!item || item.version !== MATCH_PROMPT_VERSION || typeof item.sourceHash !== 'string'
    || !/^[a-f0-9]{64}$/.test(item.sourceHash) || typeof item.inputHash !== 'string' || !/^[a-f0-9]{64}$/.test(item.inputHash)
    || typeof item.score !== 'number' || !Number.isInteger(item.score) || item.score < 0 || item.score > 100
    || !isCanonicalMatchBreakdown(item.baseBreakdown) || !isCanonicalMatchBreakdown(item.scoreBreakdown)
    || item.baseScore !== computeOverall(item.baseBreakdown)
    || typeof item.candidateComplete !== 'boolean' || typeof item.offerComplete !== 'boolean'
    || (item.rejectedByPreference !== undefined && typeof item.rejectedByPreference !== 'boolean')
    || !Array.isArray(item.requirements) || item.requirements.length === 0 || !Array.isArray(item.adjustments)) return false;
  const validRequirements = item.requirements.every((req: any) => record(req) && typeof req.id === 'string' && typeof req.name === 'string'
    && KINDS.includes(req.kind) && STATUSES.includes(req.status) && ['required', 'preferred'].includes(req.importance)
    && typeof req.core === 'boolean' && typeof req.offerEvidence?.quote === 'string' && req.offerEvidence?.sourceId === 'offer'
    && Array.isArray(req.candidateEvidence) && req.candidateEvidence.every((ref: any) => typeof ref?.sourceId === 'string' && typeof ref?.quote === 'string') && Array.isArray(req.alternatives));
  const validAdjustments = item.adjustments.every((adjustment: any) => record(adjustment)
    && ['experience_gap', 'core_skill_gap', 'seniority_gap', 'user_preference'].includes(adjustment.code)
    && typeof adjustment.overallCap === 'number' && adjustment.overallCap >= 0 && adjustment.overallCap <= 100
    && typeof adjustment.reason === 'string' && Array.isArray(adjustment.requirementIds)
    && adjustment.requirementIds.every((id: unknown) => item.requirements.some((req: any) => req.id === id)));
  return validRequirements && validAdjustments
    && item.score === Math.min(computeOverall(item.scoreBreakdown), ...item.adjustments.map((adjustment: any) => adjustment.overallCap));
}

export function normalizeMatchDetails(value: unknown, snapshot: MatchEvidenceSnapshot): MatchDetails {
  const raw = record(value);
  const ids = new Set(snapshot.requirements.map((item) => item.id));
  if (!raw || typeof raw.summary !== 'string' || !raw.summary.trim() || !Array.isArray(raw.dimensions)
    || raw.dimensions.length !== MATCH_DIMENSION_KEYS.length || !Array.isArray(raw.requirements) || !Array.isArray(raw.nextSteps)) throw new MatchValidationError('El desglose detallado está incompleto.');
  const dimensions = MATCH_DIMENSION_KEYS.map((key) => {
    const rows = raw.dimensions.filter((item: any) => item?.key === key);
    if (rows.length !== 1 || typeof rows[0].explanation !== 'string' || !rows[0].explanation.trim()
      || !Array.isArray(rows[0].requirementIds) || rows[0].requirementIds.some((id: unknown) => !ids.has(String(id)))) throw new MatchValidationError('El desglose incluye dimensiones o referencias inválidas.');
    return { key, explanation: text(rows[0].explanation, 800), requirementIds: rows[0].requirementIds as string[] };
  });
  if (raw.requirements.length !== ids.size || new Set(raw.requirements.map((item: any) => item?.requirementId)).size !== ids.size) throw new MatchValidationError('El desglose debe explicar cada requisito una sola vez.');
  const requirements = raw.requirements.map((item: any) => {
    if (!ids.has(item?.requirementId) || typeof item.explanation !== 'string') throw new MatchValidationError('El desglose hace referencia a un requisito desconocido.');
    return { requirementId: item.requirementId as string, explanation: text(item.explanation, 600) };
  });
  if (raw.nextSteps.some((item: unknown) => typeof item !== 'string')) throw new MatchValidationError('Los siguientes pasos son inválidos.');
  return { version: MATCH_EXPLANATION_VERSION, inputHash: snapshot.inputHash, summary: text(raw.summary, 1000), dimensions, requirements, nextSteps: raw.nextSteps.map((item: string) => text(item, 400)).filter(Boolean).slice(0, 5) };
}

export function isMatchDetails(value: unknown, snapshot: MatchEvidenceSnapshot): value is MatchDetails {
  const raw = record(value);
  if (raw?.version !== MATCH_EXPLANATION_VERSION || raw?.inputHash !== snapshot.inputHash) return false;
  try { normalizeMatchDetails(value, snapshot); return true; } catch { return false; }
}
