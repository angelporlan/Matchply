import { computeOverall, matchScoreLabel, resolveMatchBreakdown } from '@/lib/matching';

export function parseJsonObject(text: string): Record<string, any> | null {
  const clean = text.trim();
  if (!clean) return null;
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function unwrapMatchItem(parsed: Record<string, any>): Record<string, any> {
  if (Array.isArray(parsed.curated) && parsed.curated[0] && typeof parsed.curated[0] === 'object') {
    return parsed.curated[0];
  }
  return parsed;
}

export function evaluationFields(parsed: Record<string, any>) {
  const item = unwrapMatchItem(parsed);
  const scoreBreakdown = resolveMatchBreakdown(item);
  const scoreOverall = computeOverall(scoreBreakdown);
  const scoreLabel = matchScoreLabel(scoreOverall);
  const redFlags = item.redFlags ?? parsed.redFlags ?? null;
  const tldr = item.fitReason || item.scoreReason || parsed.scoreReason || null;
  const legitimacyTier = item.legitimacyTier || parsed.legitimacyTier || null;
  const presentKeywords = item.presentKeywords || parsed.presentKeywords || [];
  const missingKeywords = item.missingKeywords || parsed.missingKeywords || [];
  const verdict = item.verdict || parsed.verdict || '';

  const rawReport = `## B) Match con CV y Gaps Técnicos\n` +
    `- **Puntuación de compatibilidad:** ${scoreOverall}/100 (${scoreLabel})\n` +
    `- **Razón del score:** ${tldr || ''}\n\n` +
    `## C) Análisis de Stack Tecnológico\n` +
    `### Tecnologías coincidentes detectadas:\n` +
    (presentKeywords.length > 0
      ? presentKeywords.map((k: string) => `- ✓ **${k}**`).join('\n')
      : '- Ninguna detectada') + '\n\n' +
    `### Tecnologías requeridas ausentes (Gaps):\n` +
    (missingKeywords.length > 0
      ? missingKeywords.map((k: string) => `- ⚠ **${k}**`).join('\n')
      : '- Ninguno detectado') + '\n\n' +
    `## E) Blueprint de Personalización del CV\n` +
    `Veredicto final del Reclutador:\n\n` +
    `${verdict}`;

  return { scoreOverall, scoreBreakdown, redFlags, tldr, legitimacyTier, rawReport };
}
