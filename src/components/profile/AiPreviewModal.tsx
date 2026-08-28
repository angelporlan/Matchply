"use client";

import React from 'react';
import {
  Eye,
  X,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Code2,
  Sliders,
  Briefcase,
} from 'lucide-react';

interface AiPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileData: {
    bio: string;
    targetRoles: string[];
    experienceYears?: number | '';
    techStack?: Record<string, string[] | undefined> | any;
    keyProjects?: Array<{
      title: string;
      techStack?: string;
      description: string;
      impact?: string;
    }>;
    targetTransition?: {
      targetRole?: string;
      targetIndustries?: string;
      targetGeography?: string;
    } | string;
    preferredWorkplaces: string[];
    preferredLocations: string;
    companyPreferences: string;
    salaryMin?: number | '';
    salaryTarget?: number | '';
    curationCriteria: string;
  };
  constraintChips: string[];
}

export default function AiPreviewModal({
  isOpen,
  onClose,
  profileData,
  constraintChips,
}: AiPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b0f19]/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-[#111827] border border-[#8B5CF6]/30 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#1e1b4b]/10 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-[#8B5CF6]/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#8B5CF6] to-[#7c3aed] text-white flex items-center justify-center shadow-xs">
              <Eye className="w-5 h-5 stroke-[1.75]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#1e1b4b] dark:text-white font-display">
                Cómo te ve la IA
              </h2>
              <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans">
                Este es el contexto exacto que se inyecta en cada evaluación de oferta y creación de CV.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all"
          >
            <X className="w-4 h-4 stroke-[1.75]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 font-sans text-xs">
          {/* Reglas Duras */}
          <div className="bg-slate-50 dark:bg-[#0b0f19] border border-[#8B5CF6]/20 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-[#8B5CF6] font-bold font-display text-xs">
              <ShieldCheck className="w-4 h-4 stroke-[1.75]" />
              <span>Reglas duras aplicadas en código:</span>
            </div>
            {constraintChips.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {constraintChips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center rounded-lg border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 px-2.5 py-1 text-[11px] font-bold text-[#6D28D9] dark:text-[#C4B5FD]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                No se han detectado reglas duras de idioma o descarte estricto. La IA usará evaluación semántica estándar.
              </p>
            )}
          </div>

          {/* Contexto inyectado */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-[#1e1b4b] dark:text-white font-display flex items-center gap-1.5">
              <Code2 className="w-4 h-4 text-[#8B5CF6] stroke-[1.75]" />
              Payload de Contexto del Candidato:
            </p>
            <div className="bg-slate-900 text-slate-200 rounded-xl p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto border border-slate-800">
{`### PERFIL DEL CANDIDATO:
- Trayectoria & Stack: ${profileData.bio || '(Sin biografía definida)'}
- Roles Objetivo: ${profileData.targetRoles?.join(', ') || '(Sin definir)'}
- Años de Experiencia: ${profileData.experienceYears || 'N/D'}
- Modalidades: ${profileData.preferredWorkplaces?.join(', ') || 'Cualquiera'}
- Ubicaciones: ${profileData.preferredLocations || 'No especificada'}
- Empresas Preferidas: ${profileData.companyPreferences || 'Cualquiera'}
- Salario: Min ${profileData.salaryMin || 'N/D'}€, Target ${profileData.salaryTarget || 'N/D'}€
${profileData.keyProjects && profileData.keyProjects.length > 0 ? `\n- Proyectos Clave:\n${profileData.keyProjects.map(p => `  * ${p.title} (${p.techStack || ''}): ${p.description} [Impacto: ${p.impact || 'N/D'}]`).join('\n')}` : ''}
${profileData.curationCriteria ? `\n### CRITERIOS DE CURACIÓN (LinkedIn Matching):\n${profileData.curationCriteria}` : ''}`}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1e1b4b]/10 dark:border-white/10 flex items-center justify-end bg-slate-50 dark:bg-[#0e1422]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#8B5CF6] hover:bg-[#7c3aed] text-white text-xs font-bold transition-all cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
