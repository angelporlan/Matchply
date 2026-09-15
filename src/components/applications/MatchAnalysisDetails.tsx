'use client';

import { MATCH_DIMENSION_LABELS, type MatchEvidenceSnapshot, type MatchDetails } from '@/lib/matching/types';

const STATUS_LABELS = { met: 'Acreditado', partial: 'Parcial', missing: 'No acreditado', unknown: 'Desconocido' };

export default function MatchAnalysisDetails({ evidence, details }: { evidence: MatchEvidenceSnapshot | null; details: MatchDetails | null }) {
  if (!evidence) return <p className="text-sm text-text-muted">El match necesita actualizarse con tu perfil y las reglas actuales.</p>;
  if (!details) return <p className="text-sm text-text-muted">Tu match es {evidence.score} %. Pulsa «Analizar match» para ver el desglose y las evidencias.</p>;
  return <section className="min-w-0 space-y-6 text-sm text-text [overflow-wrap:anywhere]" aria-label="Desglose del match">
    <div className="space-y-2">
      <h2 className="text-lg font-bold font-display">Match con tu perfil: {evidence.score} %</h2>
      <p className="leading-relaxed">{details.summary}</p>
      <p className="text-xs text-text-muted">Puntuación ponderada inicial: {evidence.baseScore}/100. Los límites aplicados se muestran a continuación.</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      {details.dimensions.map(dimension => <div key={dimension.key} className="rounded-[12px] border border-subtle p-4">
        <h3 className="font-semibold">{MATCH_DIMENSION_LABELS[dimension.key]} · {evidence.scoreBreakdown[dimension.key]}/100</h3>
        <p className="mt-2 text-text-muted leading-relaxed">{dimension.explanation}</p>
      </div>)}
    </div>
    {evidence.adjustments.length > 0 && <section className="space-y-2" aria-label="Ajustes aplicados">
      <h3 className="font-semibold">Ajustes aplicados</h3>
      <ul className="space-y-2">{evidence.adjustments.map((adjustment, index) => <li key={index} className="rounded-[8px] border border-control p-3">
        <p>{adjustment.reason}</p>
        <p className="mt-1 text-xs text-text-muted">Límite global: {adjustment.overallCap}/100{adjustment.dimension ? ` · ${MATCH_DIMENSION_LABELS[adjustment.dimension]}: máximo ${adjustment.dimensionCap}/100` : ''}.</p>
      </li>)}</ul>
    </section>}
    <section className="space-y-3" aria-label="Requisitos y evidencias">
      <h3 className="font-semibold">Requisitos y evidencias</h3>
      <p className="text-xs text-text-muted">«No acreditado» significa que no encontramos evidencia en las fuentes revisadas; no afirma que desconozcas esa competencia.</p>
      {evidence.requirements.map(requirement => <article key={requirement.id} className="rounded-[12px] border border-subtle p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">{requirement.name}</h4>
          <span className="text-xs font-medium rounded-[6px] border border-control px-2 py-1">{STATUS_LABELS[requirement.status]}</span>
        </div>
        <p className="text-xs text-text-muted">{requirement.importance === 'required' ? 'Obligatorio' : 'Deseable'}{requirement.alternatives.length ? ` · Alternativas: ${requirement.alternatives.join(', ')}` : ''}</p>
        <p>{details.requirements.find(item => item.requirementId === requirement.id)?.explanation}</p>
        <blockquote className="border-l-2 border-control pl-3 text-text-muted"><span className="font-medium">Oferta: </span>{requirement.offerEvidence.quote}</blockquote>
        {requirement.candidateEvidence.map((proof, index) => <blockquote key={index} className="border-l-2 border-control pl-3 text-text-muted"><span className="font-medium">{proof.sourceId === 'cv' ? 'CV' : 'Perfil'}: </span>{proof.quote}</blockquote>)}
      </article>)}
    </section>
    {details.nextSteps.length > 0 && <section className="space-y-2"><h3 className="font-semibold">Próximos pasos</h3><ul className="list-disc pl-5 space-y-2">{details.nextSteps.map((step, index) => <li key={index}>{step}</li>)}</ul></section>}
  </section>;
}
