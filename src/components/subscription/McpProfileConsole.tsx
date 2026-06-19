'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Settings, Briefcase, Coins, MapPin, 
  Sparkles, Save, Loader2, Plus, X, 
  CheckCircle2, AlertCircle, HelpCircle, GraduationCap
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { updateUserMcpSettings } from '@/app/dashboard/actions';

interface CVOption {
  id: string;
  title: string;
  isBase: boolean;
  isPrincipal: boolean;
}

interface LocationPreference {
  name: string;
  score: number;
}

interface McpProfileConsoleProps {
  userCvs: CVOption[];
  initialMcpCvId: string | null;
  initialMcpProfile: {
    targetRoles?: string[];
    experienceYears?: number;
    salaryMin?: number;
    salaryTarget?: number;
    locations?: LocationPreference[];
    experienceFitRules?: {
      'under-1'?: number;
      '1-3'?: number;
      '4'?: number;
      '5+'?: number;
    };
    additionalNotes?: string;
  } | null;
}

export default function McpProfileConsole({ 
  userCvs, 
  initialMcpCvId, 
  initialMcpProfile 
}: McpProfileConsoleProps) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form states
  const [mcpCvId, setMcpCvId] = useState<string>(initialMcpCvId || '');
  const [experienceYears, setExperienceYears] = useState<number>(initialMcpProfile?.experienceYears ?? 0);
  const [salaryMin, setSalaryMin] = useState<number>(initialMcpProfile?.salaryMin ?? 0);
  const [salaryTarget, setSalaryTarget] = useState<number>(initialMcpProfile?.salaryTarget ?? 0);
  const [additionalNotes, setAdditionalNotes] = useState<string>(initialMcpProfile?.additionalNotes ?? '');

  // Roles states
  const [targetRoles, setTargetRoles] = useState<string[]>(initialMcpProfile?.targetRoles ?? []);
  const [newRole, setNewRole] = useState('');

  // Locations states
  const [locations, setLocations] = useState<LocationPreference[]>(initialMcpProfile?.locations ?? []);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationScore, setNewLocationScore] = useState(5.0);

  // Experience Fit Rules states
  const [expRules, setExpRules] = useState({
    'under-1': initialMcpProfile?.experienceFitRules?.['under-1'] ?? 5.0,
    '1-3': initialMcpProfile?.experienceFitRules?.['1-3'] ?? 5.0,
    '4': initialMcpProfile?.experienceFitRules?.['4'] ?? 5.0,
    '5+': initialMcpProfile?.experienceFitRules?.['5+'] ?? 5.0,
  });

  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole.trim()) return;
    if (targetRoles.includes(newRole.trim())) {
      setNewRole('');
      return;
    }
    setTargetRoles([...targetRoles, newRole.trim()]);
    setNewRole('');
  };

  const handleRemoveRole = (roleToRemove: string) => {
    setTargetRoles(targetRoles.filter(role => role !== roleToRemove));
  };

  const handleAddLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationName.trim()) return;
    if (locations.some(loc => loc.name.toLowerCase() === newLocationName.trim().toLowerCase())) {
      setNewLocationName('');
      return;
    }
    setLocations([...locations, { name: newLocationName.trim(), score: newLocationScore }]);
    setNewLocationName('');
    setNewLocationScore(4.0);
  };

  const handleRemoveLocation = (nameToRemove: string) => {
    setLocations(locations.filter(loc => loc.name !== nameToRemove));
  };

  const handleLocationScoreChange = (index: number, newScore: number) => {
    const updated = [...locations];
    updated[index].score = newScore;
    setLocations(updated);
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    const mcpProfile = {
      targetRoles,
      experienceYears,
      salaryMin,
      salaryTarget,
      locations,
      experienceFitRules: expRules,
      additionalNotes
    };

    const result = await updateUserMcpSettings(mcpCvId || null, mcpProfile);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      router.refresh();
    } else {
      setError(result.error || 'Ocurrió un error al guardar la configuración.');
    }
    setLoading(false);
  };

  return (
    <div className="relative bg-white dark:bg-[#1f2937] p-8 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 shadow-sm mt-8 overflow-hidden font-display">
      {/* Background Glow */}
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-[#8b5cf6]/5 dark:bg-[#8b5cf6]/10 rounded-full filter blur-[80px] pointer-events-none" />

      <div className="space-y-6 relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e1b4b]/10 dark:border-white/5 pb-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-[#1e1b4b] dark:text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#8b5cf6] stroke-[1.75]" />
              {language === 'es' ? '🧠 Configuración del Agente MCP' : '🧠 MCP Agent Settings'}
            </h3>
            <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans font-light">
              {language === 'es' 
                ? 'Personaliza los parámetros semánticos que tu servidor MCP utiliza para calcular el match, red flags y adaptar tu CV.'
                : 'Customize the semantic parameters your MCP server uses to calculate match scores, flags, and adapt your CV.'}
            </p>
          </div>
          <span className="self-start sm:self-auto text-[9px] uppercase tracking-wider font-extrabold text-[#8b5cf6] bg-[#8b5cf6]/10 border border-[#8b5cf6]/35 px-2.5 py-0.5 rounded-full">
            {language === 'es' ? 'Período 2026' : '2026 Settings'}
          </span>
        </div>

        {/* Alertas */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-[8px] text-xs font-semibold font-sans animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 stroke-[1.75]" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-[8px] text-xs font-semibold font-sans animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 stroke-[1.75]" />
            <span>{language === 'es' ? '¡Preferencias de MCP guardadas con éxito!' : 'MCP preferences saved successfully!'}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans font-light">
          {/* COLUMNA IZQUIERDA */}
          <div className="space-y-6">
            
            {/* 1. CV Principal */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#1e1b4b] dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-[#8b5cf6] stroke-[1.75]" />
                {language === 'es' ? 'Currículum Base para MCP' : 'Base CV for MCP'}
              </label>
              <select
                value={mcpCvId}
                onChange={(e) => setMcpCvId(e.target.value)}
                className="w-full bg-[#fafafa] dark:bg-[#0b0f19]/45 border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2 text-xs text-[#1e1b4b] dark:text-white outline-none focus:border-[#8b5cf6]/50"
              >
                <option value="">
                  {language === 'es' ? 'Usar currículum principal por defecto' : 'Use default principal CV'}
                </option>
                {userCvs.map((cv) => (
                  <option key={cv.id} value={cv.id}>
                    {cv.title} {cv.isPrincipal ? `(${language === 'es' ? 'Principal' : 'Principal'})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400">
                {language === 'es' 
                  ? 'El currículum seleccionado será usado para evaluar ofertas de empleo y como base para adaptarlo en las herramientas del MCP.'
                  : 'The selected CV will be used to evaluate vacancies and as the base reference to optimize resumes.'}
              </p>
            </div>

            {/* 2. Roles Objetivo */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-[#1e1b4b] dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#8b5cf6] stroke-[1.75]" />
                {language === 'es' ? 'Roles & Tecnologías Objetivo' : 'Target Roles & Technologies'}
              </label>
              
              <form onSubmit={handleAddRole} className="flex gap-2">
                <input
                  type="text"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder={language === 'es' ? 'Ej: PHP Laravel, MLOps, Angular...' : 'E.g., PHP Laravel, MLOps, Angular...'}
                  className="flex-1 bg-[#fafafa] dark:bg-[#0b0f19]/45 border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3 py-1.5 text-xs text-[#1e1b4b] dark:text-white outline-none focus:border-[#8b5cf6]/50"
                />
                <button
                  type="submit"
                  className="px-3 bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 hover:bg-[#8b5cf6]/20 rounded-[8px] flex items-center justify-center text-[#8b5cf6] transition-colors"
                >
                  <Plus className="w-4 h-4 stroke-[1.75]" />
                </button>
              </form>

              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                {targetRoles.map((role) => (
                  <span 
                    key={role}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#8b5cf6] bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 px-2.5 py-0.5 rounded-full"
                  >
                    {role}
                    <button 
                      type="button" 
                      onClick={() => handleRemoveRole(role)}
                      className="hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3 stroke-[2]" />
                    </button>
                  </span>
                ))}
                {targetRoles.length === 0 && (
                  <span className="text-xs text-slate-400 italic font-sans font-light">
                    {language === 'es' ? 'Añade roles para guiar al modelo semántico.' : 'Add roles to guide the semantic model.'}
                  </span>
                )}
              </div>
            </div>

            {/* 3. Años de Experiencia y Salario */}
            <div className="space-y-4">
              {/* Experiencia */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#1e1b4b] dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-[#8b5cf6] stroke-[1.75]" />
                  {language === 'es' ? 'Años de Experiencia Real' : 'Actual Years of Experience'}
                </label>
                <input
                  type="number"
                  min="0"
                  max="40"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(parseInt(e.target.value) || 0)}
                  className="w-full bg-[#fafafa] dark:bg-[#0b0f19]/45 border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2 text-xs text-[#1e1b4b] dark:text-white outline-none focus:border-[#8b5cf6]/50"
                />
              </div>

              {/* Salarios */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#1e1b4b] dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-[#8b5cf6] stroke-[1.75]" />
                  {language === 'es' ? 'Pretensiones Salariales (EUR/año)' : 'Salary Range Target (EUR/year)'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Mínimo Aceptable</span>
                    <input
                      type="number"
                      step="5000"
                      value={salaryMin}
                      onChange={(e) => setSalaryMin(parseInt(e.target.value) || 0)}
                      className="w-full bg-[#fafafa] dark:bg-[#0b0f19]/45 border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3 py-1.5 text-xs text-[#1e1b4b] dark:text-white outline-none focus:border-[#8b5cf6]/50"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Salario Objetivo</span>
                    <input
                      type="number"
                      step="5000"
                      value={salaryTarget}
                      onChange={(e) => setSalaryTarget(parseInt(e.target.value) || 0)}
                      className="w-full bg-[#fafafa] dark:bg-[#0b0f19]/45 border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3 py-1.5 text-xs text-[#1e1b4b] dark:text-white outline-none focus:border-[#8b5cf6]/50"
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* COLUMNA DERECHA */}
          <div className="space-y-6">

            {/* 4. Ubicaciones y Puntuaciones */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-[#1e1b4b] dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#8b5cf6] stroke-[1.75]" />
                {language === 'es' ? 'Preferencia de Ubicación (Score 1.0 - 5.0)' : 'Location Scores (1.0 - 5.0)'}
              </label>

              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  placeholder={language === 'es' ? 'Ej: Remoto España, Barcelona...' : 'E.g., Remote EU, Barcelona...'}
                  className="flex-1 bg-[#fafafa] dark:bg-[#0b0f19]/45 border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3 py-1.5 text-xs text-[#1e1b4b] dark:text-white outline-none focus:border-[#8b5cf6]/50"
                />
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400 font-mono">{newLocationScore.toFixed(1)}</span>
                  <input
                    type="range"
                    min="1.0"
                    max="5.0"
                    step="0.5"
                    value={newLocationScore}
                    onChange={(e) => setNewLocationScore(parseFloat(e.target.value))}
                    className="w-16 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#8b5cf6]"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddLocation}
                  className="px-3 py-1.5 bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 hover:bg-[#8b5cf6]/20 rounded-[8px] flex items-center justify-center text-[#8b5cf6] transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4 stroke-[1.75]" />
                </button>
              </div>

              <div className="space-y-2.5 max-h-36 overflow-y-auto pr-1">
                {locations.map((loc, index) => (
                  <div key={loc.name} className="flex items-center justify-between gap-3 bg-[#fafafa] dark:bg-[#0b0f19]/25 border border-[#1e1b4b]/5 dark:border-white/5 p-2 rounded-lg text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">{loc.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[#8b5cf6] font-bold text-[10px] w-5 text-right">{loc.score.toFixed(1)}</span>
                      <input
                        type="range"
                        min="1.0"
                        max="5.0"
                        step="0.5"
                        value={loc.score}
                        onChange={(e) => handleLocationScoreChange(index, parseFloat(e.target.value))}
                        className="w-20 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#8b5cf6]"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveLocation(loc.name)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {locations.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No has añadido preferencias geográficas.</p>
                )}
              </div>
            </div>

            {/* 5. Reglas de Puntuación por Experiencia */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-[#1e1b4b] dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-[#8b5cf6] stroke-[1.75]" />
                {language === 'es' ? 'Ajuste de Score por Años Exigidos' : 'Experience Rules Score Matrix'}
              </label>
              
              <div className="space-y-2.5 bg-[#fafafa] dark:bg-[#0b0f19]/25 border border-[#1e1b4b]/5 dark:border-white/5 p-3 rounded-lg">
                {/* Under 1 */}
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-600 dark:text-slate-350">Si pide &lt; 1 año (Intern/Junior):</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#8b5cf6] text-[10px] w-5 text-right">{expRules['under-1'].toFixed(1)}</span>
                    <input
                      type="range"
                      min="1.0"
                      max="5.0"
                      step="0.5"
                      value={expRules['under-1']}
                      onChange={(e) => setExpRules({...expRules, 'under-1': parseFloat(e.target.value)})}
                      className="w-24 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#8b5cf6]"
                    />
                  </div>
                </div>

                {/* 1-3 */}
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-600 dark:text-slate-350">Si pide 1 a 3 años (Mid):</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#8b5cf6] text-[10px] w-5 text-right">{expRules['1-3'].toFixed(1)}</span>
                    <input
                      type="range"
                      min="1.0"
                      max="5.0"
                      step="0.5"
                      value={expRules['1-3']}
                      onChange={(e) => setExpRules({...expRules, '1-3': parseFloat(e.target.value)})}
                      className="w-24 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#8b5cf6]"
                    />
                  </div>
                </div>

                {/* 4 */}
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-600 dark:text-slate-350">Si pide exactamente 4 años:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#8b5cf6] text-[10px] w-5 text-right">{expRules['4'].toFixed(1)}</span>
                    <input
                      type="range"
                      min="1.0"
                      max="5.0"
                      step="0.5"
                      value={expRules['4']}
                      onChange={(e) => setExpRules({...expRules, '4': parseFloat(e.target.value)})}
                      className="w-24 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#8b5cf6]"
                    />
                  </div>
                </div>

                {/* 5+ */}
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-600 dark:text-slate-350">Si pide 5+ años (Senior/Lead):</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#8b5cf6] text-[10px] w-5 text-right">{expRules['5+'].toFixed(1)}</span>
                    <input
                      type="range"
                      min="1.0"
                      max="5.0"
                      step="0.5"
                      value={expRules['5+']}
                      onChange={(e) => setExpRules({...expRules, '5+': parseFloat(e.target.value)})}
                      className="w-24 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#8b5cf6]"
                    />
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* 6. Notas Adicionales */}
        <div className="space-y-2 font-sans font-light">
          <label className="text-xs font-semibold text-[#1e1b4b] dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            {language === 'es' ? 'Notas Adicionales de Contexto' : 'Additional Context & Notes'}
          </label>
          <textarea
            rows={3}
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder={language === 'es' 
              ? 'Añade cualquier otro detalle (ej: "No me interesan ofertas de consultoras tradicionales, prefiero startups con producto propio")' 
              : 'Add any other custom instructions (e.g., "I prefer product companies over agency work, highlight payment integrations").'}
            className="w-full bg-[#fafafa] dark:bg-[#0b0f19]/45 border border-[#1e1b4b]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2 text-xs text-[#1e1b4b] dark:text-white outline-none focus:border-[#8b5cf6]/50 resize-none"
          />
        </div>

        {/* Guardar */}
        <div className="flex justify-end pt-4 border-t border-[#1e1b4b]/10 dark:border-white/5">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-[#8b5cf6] hover:bg-[#8b5cf6]/90 text-white font-bold py-2.5 px-6 rounded-[8px] text-xs transition-all disabled:opacity-50 shadow-sm shadow-[#8b5cf6]/10"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {language === 'es' ? 'Guardando...' : 'Saving...'}
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 stroke-[1.75]" />
                {language === 'es' ? 'Guardar Preferencias' : 'Save Preferences'}
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
