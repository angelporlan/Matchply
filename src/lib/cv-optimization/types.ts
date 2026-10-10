import type { OptimizeModeId } from '@/lib/optimize-modes';

export type CvKeyword = {
  termino: string;
  tipo: 'imprescindible' | 'valorable';
  evidencia: 'fuerte' | 'parcial' | 'ninguna';
  cita_cv: string | null;
  sinonimos_reales: string[];
};
export type CvGap = { requisito: string; gravedad: 'critico' | 'moderado' | 'menor'; sugerencia: string };
export type CvAnalysis = {
  rol_objetivo: string; idioma_oferta: string; top5: string[]; keywords: CvKeyword[];
  gaps: CvGap[]; titular_sugerido: string; contenido_a_priorizar: string[];
  sugerencias_metricas: string[];
};
export type VariantStatus = 'idle' | 'pending' | 'generating' | 'ready' | 'error';
export type CvVariant = { modeId: OptimizeModeId; content: string; status: VariantStatus; error: string | null; revision: number };
export type CvOptimizationView = { id: string; sourceMarkdown: string; analysis: CvAnalysis | null; variants: CvVariant[] };
export type VariantSaveContext = { optimizationId: string; modeId: OptimizeModeId; revision: number };
export type OptimizeOffer = { jobTitle: string; company: string; jobDescription: string; url: string | null; platform: string; addToApplications: boolean; jobOfferId?: string };
export type OptimizeJobPayload = { optimizationId: string; requestId: string; modes: OptimizeModeId[]; retry?: boolean; activateMode?: OptimizeModeId };
export type OptimizeProgress = { stage: 'queued' | 'analysis' | 'generating' | 'completed'; cvId: string; optimizationId: string; variants: Array<Pick<CvVariant, 'modeId' | 'status' | 'error'>>; preview?: { modeId: OptimizeModeId; content: string; attempt: number } };
