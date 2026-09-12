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

export function evaluationFields(parsed: Record<string, any>) {
  const scoreOverall = parsed.score !== undefined ? parseFloat(Number(parsed.score).toFixed(1)) : null;
  const scoreBreakdown = Array.isArray(parsed.dimensions)
    ? parsed.dimensions.reduce((acc: Record<string, number>, curr: any) => {
      if (curr?.name) acc[curr.name] = parseFloat(Number(curr.percentage).toFixed(1));
      return acc;
    }, {})
    : null;
  const redFlags = parsed.redFlags ?? null;
  const tldr = parsed.scoreReason || null;
  const legitimacyTier = parsed.legitimacyTier || null;
  const rawReport = `## B) Match con CV y Gaps Técnicos\n` +
    `- **Puntuación de compatibilidad:** ${parsed.score}/100 (${parsed.scoreLabel || 'Analizado'})\n` +
    `- **Razón del score:** ${parsed.scoreReason || ''}\n\n` +
    `## C) Análisis de Stack Tecnológico\n` +
    `### Tecnologías coincidentes detectadas:\n` +
    (parsed.presentKeywords && parsed.presentKeywords.length > 0
      ? parsed.presentKeywords.map((k: string) => `- ✓ **${k}**`).join('\n')
      : '- Ninguna detectada') + '\n\n' +
    `### Tecnologías requeridas ausentes (Gaps):\n` +
    (parsed.missingKeywords && parsed.missingKeywords.length > 0
      ? parsed.missingKeywords.map((k: string) => `- ⚠ **${k}**`).join('\n')
      : '- Ninguno detectado') + '\n\n' +
    `## E) Blueprint de Personalización del CV\n` +
    `Veredicto final del Reclutador:\n\n` +
    `${parsed.verdict || ''}`;

  return { scoreOverall, scoreBreakdown, redFlags, tldr, legitimacyTier, rawReport };
}
