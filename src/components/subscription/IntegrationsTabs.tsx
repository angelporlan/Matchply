'use client';

import { useState } from 'react';
import { Key, Settings } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import ApiKeyConsole from './ApiKeyConsole';
import McpProfileConsole from './McpProfileConsole';

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

interface IntegrationsTabsProps {
  isPremium: boolean;
  initialApiKey: string | null;
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

export default function IntegrationsTabs({
  isPremium,
  initialApiKey,
  userCvs,
  initialMcpCvId,
  initialMcpProfile,
}: IntegrationsTabsProps) {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'api' | 'mcp'>('api');

  // Si no es premium, ApiKeyConsole gestionará el upsell/bloqueo de todo el apartado.
  if (!isPremium) {
    return <ApiKeyConsole initialApiKey={initialApiKey} isPremium={false} />;
  }

  return (
    <div className="space-y-6">
      {/* Selector de pestañas */}
      <div className="flex border-b border-[#1e1b4b]/10 dark:border-white/5 pb-px gap-2">
        <button
          onClick={() => setActiveTab('api')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all outline-none ${
            activeTab === 'api'
              ? 'border-[#8b5cf6] text-[#8b5cf6]'
              : 'border-transparent text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white'
          }`}
        >
          <Key className="w-4 h-4 stroke-[1.75]" />
          {language === 'es' ? 'Clave API y Conexión' : 'API Key & Connection'}
        </button>
        <button
          onClick={() => setActiveTab('mcp')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all outline-none ${
            activeTab === 'mcp'
              ? 'border-[#8b5cf6] text-[#8b5cf6]'
              : 'border-transparent text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4 stroke-[1.75]" />
          {language === 'es' ? 'Perfil del Agente MCP' : 'MCP Agent Profile'}
        </button>
      </div>

      {/* Contenido de la pestaña */}
      <div className="transition-all duration-300">
        {activeTab === 'api' ? (
          <ApiKeyConsole initialApiKey={initialApiKey} isPremium={true} />
        ) : (
          <McpProfileConsole
            userCvs={userCvs}
            initialMcpCvId={initialMcpCvId}
            initialMcpProfile={initialMcpProfile}
          />
        )}
      </div>
    </div>
  );
}
