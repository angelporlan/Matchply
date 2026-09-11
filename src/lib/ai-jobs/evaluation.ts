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

export function formatMcpOptimizeMessage(input: {
  company: string;
  title: string;
  offerId: string;
  parsed: Record<string, any> | null;
}) {
  let text = `✅ **CV Optimizado con Éxito y Añadido al Kanban**\n\n` +
    `- **Empresa:** ${input.company}\n` +
    `- **Puesto:** ${input.title}\n` +
    `- **Estado:** Interesado (Kanban)\n` +
    `- **ID de la Postulación:** \`${input.offerId}\`\n\n`;

  if (input.parsed) {
    text += `🏆 **Puntuación de Match:** **${input.parsed.score}/100**\n` +
      `📌 **Veredicto:** _${input.parsed.scoreReason || input.parsed.verdict || ''}_\n\n`;
    if (Array.isArray(input.parsed.redFlags) && input.parsed.redFlags.length > 0) {
      text += `⚠️ **Red Flags:**\n` + input.parsed.redFlags.map((rf: any) => `* **${rf.title}**: _${rf.description}_`).join('\n') + `\n\n`;
    }
  }

  text += `El currículum se adaptó correctamente siguiendo tu perfil. Ya está disponible en tu dashboard para previsualizar y exportar a PDF.`;
  return text;
}

export function formatMcpEvaluateMessage(input: {
  company: string;
  title: string;
  offerId: string;
  parsed: Record<string, any>;
  tldr: string | null;
  legitimacyTier: string | null;
}) {
  const breakdownText = Array.isArray(input.parsed.dimensions)
    ? '\n' + input.parsed.dimensions.map((d: any) => `- **${d.name}:** ${d.percentage}/100`).join('\n')
    : '';
  const redFlagsText = Array.isArray(input.parsed.redFlags) && input.parsed.redFlags.length > 0
    ? input.parsed.redFlags.map((rf: any) => `⚠️ **${rf.title}**\n  _${rf.description}_`).join('\n')
    : 'Ninguna detectada ✅';
  const keywordsText = Array.isArray(input.parsed.missingKeywords) && input.parsed.missingKeywords.length > 0
    ? input.parsed.missingKeywords.join(', ')
    : 'Ninguna';

  return `🔍 **Evaluación de la Oferta: ${input.company} — ${input.title}**\n\n` +
    `🏆 **Puntuación Global de Match:** **${input.parsed.score}/100**\n` +
    `📊 **Detalle por Dimensiones (0 - 100):**${breakdownText}\n\n` +
    `📌 **Resumen / Veredicto:**\n_${input.tldr || 'No disponible'}_\n\n` +
    `🚨 **Red Flags Detectadas:**\n${redFlagsText}\n\n` +
    `🔑 **Palabras Clave Faltantes (ATS):**\n${keywordsText}\n\n` +
    `📁 **Legitimidad de la Oferta:** \`${input.legitimacyTier || 'No analizado'}\`\n\n` +
    `La oferta ha sido añadida a tu Kanban en la columna **"Interesado"** (ID: \`${input.offerId}\`). Puedes optimizar tu CV para este puesto ejecutando la herramienta de optimización.`;
}

export function formatPendingJobMessage(jobId: string, kind: string) {
  return `⏳ El trabajo de IA sigue en cola (\`${kind}\`).\n\n` +
    `- **ID:** \`${jobId}\`\n` +
    `Consulta el estado con la herramienta \`consultar_trabajo_ia\` pasando este ID.`;
}
