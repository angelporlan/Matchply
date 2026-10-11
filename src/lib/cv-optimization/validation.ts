import { parseCvDocument } from '@/lib/cv-document';
import type { CvAnalysis, CvGap, CvKeyword } from './types';

export class CvOptimizationError extends Error {
  constructor(readonly code: string, readonly retryable = false) { super(code); }
}
const text = (v: unknown): v is string => typeof v === 'string' && v.length <= 120_000;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 100 && v.every(text);
const plain = (s: string) => s.replace(/[*_`]/g, '').normalize('NFKC').trim();
const fold = (s: string) => plain(s).toLowerCase().replace(/\s+/g, ' ');

/** Only declared facts, never scoring criteria, desired roles or inferred seniority. */
export function factualProfile(profile: unknown): string {
  if (!profile || typeof profile !== 'object') return '';
  const p = profile as Record<string, unknown>;
  const fields = ['masterDocument', 'bio', 'skills', 'techStack', 'keyProjects', 'experienceYears', 'englishLevel'];
  return JSON.stringify(Object.fromEntries(fields.filter(k => p[k] !== undefined).map(k => [k, p[k]])));
}

export function validateAnalysis(raw: unknown, cv: string, profile: string): CvAnalysis {
  if (!raw || typeof raw !== 'object') throw new CvOptimizationError('INVALID_ANALYSIS');
  const a = raw as CvAnalysis;
  if (![a.rol_objetivo, a.idioma_oferta, a.titular_sugerido].every(text) || !strings(a.top5) ||
    !strings(a.contenido_a_priorizar) || !strings(a.sugerencias_metricas) || !Array.isArray(a.keywords) || a.keywords.length > 100 ||
    !Array.isArray(a.gaps) || a.gaps.length > 100) throw new CvOptimizationError('INVALID_ANALYSIS');
  const source = `${cv}\n${profile}`;
  const quoted = (s: string) => Boolean(s.trim()) && source.includes(s);
  const keywords: CvKeyword[] = a.keywords.map(k => {
    if (!k || !text(k.termino) || !['imprescindible','valorable'].includes(k.tipo) || !['fuerte','parcial','ninguna'].includes(k.evidencia) ||
      !(k.cita_cv === null || text(k.cita_cv)) || !strings(k.sinonimos_reales)) throw new CvOptimizationError('INVALID_ANALYSIS');
    return { ...k, evidencia: k.evidencia !== 'ninguna' && k.cita_cv && quoted(k.cita_cv) ? k.evidencia : 'ninguna',
      cita_cv: k.cita_cv && quoted(k.cita_cv) ? k.cita_cv : null, sinonimos_reales: k.sinonimos_reales.filter(quoted) };
  });
  for (const g of a.gaps) if (!g || !text(g.requisito) || !text(g.sugerencia) || !['critico','moderado','menor'].includes(g.gravedad)) throw new CvOptimizationError('INVALID_ANALYSIS');
  const gaps: CvGap[] = keywords.filter(k => k.evidencia === 'ninguna' || k.tipo === 'imprescindible' && k.evidencia === 'parcial').map(k =>
    a.gaps.find(g => fold(g.requisito) === fold(k.termino)) || { requisito: k.termino, gravedad: k.tipo === 'imprescindible' ? 'moderado' : 'menor', sugerencia: 'Añade evidencia concreta a tu CV base solo si tienes esta experiencia.' });
  return { ...a, keywords, top5: a.top5.slice(0,5), gaps, contenido_a_priorizar: a.contenido_a_priorizar.filter(quoted), sugerencias_metricas: a.sugerencias_metricas.slice(0,5) };
}

/** Never pass a JSON parser error to logs: it can include candidate text. */
export function parseAnalysisResponse(response: string, cv: string, profile: string): CvAnalysis {
  let raw: unknown;
  try { raw = JSON.parse(response); } catch { throw new CvOptimizationError('INVALID_ANALYSIS'); }
  return validateAnalysis(raw,cv,profile);
}

const TECHNOLOGIES: RegExp[] = [
  /\bpython\b/i, /\bfastapi\b/i, /\blangchain\b/i, /\bkubernetes\b|\bk8s\b/i, /\bdocker\b/i,
  /\breact(?:\.?js)?\b/i, /\bnext\.?js\b/i, /\bnode\.?js\b/i, /\btypescript\b|\btsx?\b/i, /\bjavascript\b|\bjs\b|\bes6\b/i,
  /\bpostgres(?:ql)?\b/i, /\bmysql\b/i, /\bmongodb\b/i, /\baws\b|amazon web services/i,
  /\bazure\b/i, /\bgcp\b|google cloud/i, /\bpytorch\b/i, /\btensorflow\b/i,
  /\bdjango\b/i, /\bflask\b/i, /\bvue(?:\.?js)?\b/i, /\bangular\b/i, /\bjava\b/i,
  /\bgolang\b|\bgo\b/i, /\brust\b/i, /\bswift\b/i, /\bkotlin\b/i, /\bflutter\b/i,
  /\bterraform\b/i, /\bredis\b/i, /\bgraphql\b/i, /\bspark\b/i, /\bairflow\b/i,
];

export function validateVariant(markdown: string, cv: string, profile: string, analysis: CvAnalysis): string[] {
  const issues: string[] = [];
  const source = `${cv}\n${profile}`;
  const lines = markdown.trim().split('\n');
  if (!/^#\s+\S/.test(lines[0] || '') || /^#\s+(CV|CURRICULUM VITAE|RESUME)\s*$/i.test(lines[0] || '')) issues.push('INVALID_NAME');
  if (/```|\[\s*(?:COMPLETAR|INSERT|PENDIENTE|TODO|TBD)[^\]]*\]|\{\{[^}]+\}\}|<\s*(?:insert|completar)[^>]*>/i.test(markdown)) issues.push('PLACEHOLDER_OR_FENCE');
  if (!/^##\s+.+/m.test(markdown)) issues.push('MISSING_SECTIONS');
  if (/(habilidad|skills|competencia)/i.test(cv) && !/^##\s+.*(?:habilidad|skills|competencia)/im.test(markdown)) issues.push('MISSING_SKILLS');
  const sourceDoc = parseCvDocument(cv); const out = parseCvDocument(markdown);
  const sourceEntries = sourceDoc.sections.flatMap(s => s.entries);
  const outputEntries = out.sections.flatMap(s => s.entries);
  if (sourceDoc.name && fold(out.name) !== fold(sourceDoc.name)) issues.push('CHANGED_NAME');
  for (const technology of TECHNOLOGIES) if (technology.test(markdown) && !technology.test(source)) issues.push(`UNSUPPORTED_TECH:${technology.source}`);
  for (const keyword of analysis.keywords) {
    if (keyword.evidencia === 'ninguna' && keyword.termino.length > 2 && !fold(source).includes(fold(keyword.termino)) && fold(markdown).includes(fold(keyword.termino))) issues.push(`UNSUPPORTED_REQUIREMENT:${keyword.termino}`);
  }
  // Check facts in their entry, not just anywhere in the source document.
  for (const section of out.sections) for (const entry of section.entries) {
    const sameTitle = sourceEntries.filter(e => fold(e.heading) === fold(entry.heading));
    const original = sameTitle.find(e => fold(e.subheading) === fold(entry.subheading)) || (sameTitle.length === 1 ? sameTitle[0] : undefined);
    if (entry.subheading && !(original ? fold(original.subheading) === fold(entry.subheading) : fold(source).includes(fold(entry.subheading)))) issues.push('CHANGED_COMPANY');
    if (entry.date && !(original ? plain(original.date) === plain(entry.date) : source.includes(plain(entry.date)))) issues.push('CHANGED_DATES');
    if (!original && !fold(source).includes(fold(entry.heading))) issues.push('UNSUPPORTED_ENTRY');
  }
  for (const section of sourceDoc.sections.filter(s => /experienc|laboral|trabajo|educaci|education|formaci|estudios|certific/i.test(s.title))) for (const entry of section.entries) {
    if (!outputEntries.some(e => fold(e.heading) === fold(entry.heading) && fold(e.subheading) === fold(entry.subheading) && plain(e.date) === plain(entry.date))) issues.push(/experienc|laboral|trabajo/i.test(section.title) ? 'MISSING_JOB' : 'MISSING_CREDENTIAL');
  }
  for (const level of markdown.match(/\b[ABC][12]\b/g) || []) if (!source.includes(level)) issues.push(`UNSUPPORTED_LEVEL:${level}`);
  const numbers = (s: string) => s.match(/\b\d+(?:[.,]\d+)*\s*%?/g) || [];
  const allowed = new Set(numbers(source).map(s => s.trim()));
  for (const number of numbers(markdown)) if (!allowed.has(number.trim())) issues.push(`UNSUPPORTED_NUMBER:${number.trim()}`);
  for (let i = 0; i < lines.length; i++) if (lines[i].startsWith('### ')) {
    if (lines[i].includes('|')) issues.push('INVALID_ENTRY_HEADING');
    const next = lines[i+1] || '';
    if (next.includes('|') && !/^\*\*.+\*\* \| \*.+\*$/.test(next)) issues.push('INVALID_ENTRY_METADATA');
  }
  return Array.from(new Set(issues));
}
