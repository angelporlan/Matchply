'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Key, Sparkles, Terminal, ArrowLeft, Copy, Check, 
  Layers, Cpu, Chrome, Puzzle, Code, ShieldAlert,
  ArrowRight, CheckCircle2, ChevronRight, Play, Server,
  Lock, RefreshCw, Zap
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function ApiDocsPage() {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'extension' | 'careerops' | 'developer'>('extension');
  const [copiedText, setCopiedText] = useState<'key' | 'curl' | 'python' | null>(null);

  const handleCopy = (text: string, id: 'key' | 'curl' | 'python') => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const payloadExample = {
    title: "Senior Frontend React Engineer",
    company: "Stripe",
    url: "https://stripe.com/jobs/123",
    platform: "linkedin",
    description: "Buscamos un experto en React, Next.js y Tailwind CSS...",
    cvMarkdownTailored: "# Ángel Porlán\n**Email:** angel@example.com | **LinkedIn:** ...\n## Experiencia..."
  };

  const curlCommand = `curl -X POST https://matchply.com/api/external/applications \\
  -H "Authorization: Bearer TU_API_KEY_PERSONAL" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Senior Frontend React Engineer",
    "company": "Stripe",
    "url": "https://stripe.com/jobs/123",
    "platform": "linkedin",
    "status": "applied",
    "description": "Buscamos un experto en React, Next.js y Tailwind CSS..."
  }'`;

  const pythonCode = `import requests
import json

api_key = "matchply_usr_c3a7b..."
url = "https://matchply.com/api/external/applications"

payload = {
    "title": "Senior Frontend React Engineer",
    "company": "Stripe",
    "url": "https://stripe.com/jobs/123",
    "platform": "linkedin",
    "status": "applied",
    "description": "Buscamos un experto en React, Next.js y Tailwind CSS..."
}

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

response = requests.post(url, data=json.dumps(payload), headers=headers)
print(response.json())`;

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0b0f19] text-[#1e1b4b] dark:text-slate-100 font-sans transition-colors duration-300 pb-20">
      {/* Background Decorative Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#8b5cf6]/5 dark:bg-[#8b5cf6]/8 rounded-full filter blur-[100px] pointer-events-none" />
      <div className="absolute top-[30%] right-1/4 w-96 h-96 bg-[#2ecc71]/5 dark:bg-[#2ecc71]/5 rounded-full filter blur-[120px] pointer-events-none" />

      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0b0f19]/80 backdrop-blur-md border-b border-[#1e1b4b]/10 dark:border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link 
            href="/dashboard" 
            className="p-2 rounded-[8px] bg-slate-100 dark:bg-[#1f2937]/50 hover:bg-[#8b5cf6]/10 hover:text-[#8b5cf6] transition-all text-[#1e1b4b]/70 dark:text-slate-350"
            title="Volver al Dashboard"
          >
            <ArrowLeft className="w-4 h-4 stroke-[1.75]" />
          </Link>
          <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800" />
          <div className="flex items-center gap-2">
            <span className="font-display font-extrabold text-sm tracking-tight text-[#1e1b4b] dark:text-white">
              MATCHPLY <span className="text-[#8b5cf6]">DOCS</span>
            </span>
            <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#8b5cf6] bg-[#8b5cf6]/10 border border-[#8b5cf6]/30 px-2 py-0.5 rounded-full">
              Developer & User Hub
            </span>
          </div>
        </div>

        <Link 
          href="/dashboard/subscription" 
          className="text-xs font-bold text-[#8b5cf6] hover:text-[#8b5cf6]/90 transition-all flex items-center gap-1"
        >
          <Key className="w-3.5 h-3.5" />
          {language === 'es' ? 'Obtener mi API Key' : 'Get my API Key'}
          <ArrowRight className="w-3 h-3" />
        </Link>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-12 pb-8 text-center relative z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-1.5 bg-[#8b5cf6]/10 dark:bg-[#8b5cf6]/15 border border-[#8b5cf6]/20 px-3.5 py-1 rounded-full text-xs font-semibold text-[#8b5cf6]">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            {language === 'es' ? 'Integraciones y Automatizaciones al 100%' : '100% Automated Integrations & Sync'}
          </div>
          
          <h1 className="text-3xl md:text-5xl font-display font-extrabold text-[#1e1b4b] dark:text-white leading-tight max-w-3xl mx-auto">
            {language === 'es' ? (
              <>Conecta tu Kanban de Matchply con <span className="text-[#8b5cf6] relative">Cualquier Herramienta</span></>
            ) : (
              <>Connect your Matchply Kanban with <span className="text-[#8b5cf6] relative">Any Tool</span></>
            )}
          </h1>

          <p className="text-sm md:text-base font-light text-[#1e1b4b]/60 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            {language === 'es' ? (
              "Sincroniza ofertas de empleo directamente en tu embudo visual, adapta currículums en la nube y extrae reportes de IA avanzados en tiempo real usando nuestras API Keys personales."
            ) : (
              "Automatically sync job offers into your visual funnel, tailor resumes on the fly, and download advanced AI analysis in real time using our personal API Keys."
            )}
          </p>
        </div>
      </section>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start relative z-10">
        
        {/* Left 2 Columns: Documentation Guide */}
        <div className="lg:col-span-2 space-y-10">
          
          {/* Quick Guide Card */}
          <div className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 p-8 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#8b5cf6]/5 rounded-bl-full pointer-events-none" />
            
            <h2 className="text-xl font-bold font-display text-[#1e1b4b] dark:text-white flex items-center gap-2 mb-6">
              <Zap className="w-5 h-5 text-[#8b5cf6]" />
              {language === 'es' ? 'Cómo empezar en 3 Simples Pasos' : 'How to get started in 3 Simple Steps'}
            </h2>

            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-[#8b5cf6]/10 text-[#8b5cf6] flex items-center justify-center font-bold font-display shrink-0">1</div>
                <div>
                  <h3 className="font-bold text-sm text-[#1e1b4b] dark:text-white">
                    {language === 'es' ? 'Activa tu Plan PRO' : 'Activate your PRO Plan'}
                  </h3>
                  <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 mt-1 leading-relaxed">
                    {language === 'es' 
                      ? 'Las integraciones externas y las claves de API personales son un beneficio exclusivo de suscripción PRO. Adquiere el plan para desbloquearlas.' 
                      : 'External integrations and personal API keys are an exclusive benefit of the PRO plan. Upgrade to unlock all features.'}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-[#8b5cf6]/10 text-[#8b5cf6] flex items-center justify-center font-bold font-display shrink-0">2</div>
                <div>
                  <h3 className="font-bold text-sm text-[#1e1b4b] dark:text-white">
                    {language === 'es' ? 'Genera tu Clave de API Secreta' : 'Generate your Secret API Key'}
                  </h3>
                  <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 mt-1 leading-relaxed">
                    {language === 'es' 
                      ? 'Dirígete al panel de Suscripción en tu panel y haz clic en "Generar Clave de API". Copia la clave secreta con prefijo "matchply_usr_".' 
                      : 'Navigate to the Subscription Panel and click "Generate API Key". Copy the secret key starting with prefix "matchply_usr_".'}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-[#8b5cf6]/10 text-[#8b5cf6] flex items-center justify-center font-bold font-display shrink-0">3</div>
                <div>
                  <h3 className="font-bold text-sm text-[#1e1b4b] dark:text-white">
                    {language === 'es' ? 'Conecta tu Herramienta o Extensión' : 'Connect your Tool or Extension'}
                  </h3>
                  <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 mt-1 leading-relaxed">
                    {language === 'es' 
                      ? 'Utiliza tu clave personal para autorizar las solicitudes. Configúrala en extensiones de navegador compatibles, scripts en segundo plano o tu panel Career-Ops.' 
                      : 'Use your personal key to authorize requests. Plug it into compatible browser extensions, background scripts, or your Career-Ops dashboard.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Use Cases Panel */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h2 className="text-lg font-bold font-display text-[#1e1b4b] dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#8b5cf6]" />
                {language === 'es' ? 'Escenarios y Casos de Uso Comunes' : 'Common Integration Scenarios'}
              </h2>

              {/* Custom Tabs */}
              <div className="flex bg-slate-100 dark:bg-[#1f2937]/50 p-1 rounded-xl border border-slate-200/50 dark:border-white/5">
                <button
                  onClick={() => setActiveTab('extension')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'extension'
                      ? 'bg-white dark:bg-[#0b0f19] text-[#8b5cf6] shadow-xs'
                      : 'text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white'
                  }`}
                >
                  <Chrome className="w-3.5 h-3.5" />
                  {language === 'es' ? 'Extensión Chrome' : 'Chrome Ext'}
                </button>
                <button
                  onClick={() => setActiveTab('careerops')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'careerops'
                      ? 'bg-white dark:bg-[#0b0f19] text-[#8b5cf6] shadow-xs'
                      : 'text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white'
                  }`}
                >
                  <Server className="w-3.5 h-3.5" />
                  Career-Ops
                </button>
                <button
                  onClick={() => setActiveTab('developer')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'developer'
                      ? 'bg-white dark:bg-[#0b0f19] text-[#8b5cf6] shadow-xs'
                      : 'text-[#1e1b4b]/60 dark:text-slate-400 hover:text-[#1e1b4b] dark:hover:text-white'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  {language === 'es' ? 'Código / API' : 'Code / API'}
                </button>
              </div>
            </div>

            {/* Tab Contents */}
            <div className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 p-8 rounded-2xl shadow-sm transition-all duration-300">
              
              {/* TAB 1: CHROME EXTENSION */}
              {activeTab === 'extension' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex gap-4 items-start">
                    <div className="p-3 bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/20 rounded-xl shrink-0">
                      <Puzzle className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-[#1e1b4b] dark:text-white">
                        {language === 'es' ? 'Sincronización con un solo clic' : 'One-Click Extension Sync'}
                      </h3>
                      <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans font-light leading-relaxed">
                        {language === 'es' 
                          ? 'Automatiza tu búsqueda directamente desde portales como LinkedIn, Indeed o InfoJobs usando extensiones compatibles de scraping.'
                          : 'Automate your job hunting directly from platforms like LinkedIn, Indeed, or InfoJobs using compatible web scrapers.'}
                      </p>
                    </div>
                  </div>

                  {/* Visual Interface Mock */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-[#0b0f19] p-5 relative">
                    <span className="absolute top-3 right-3 text-[8px] uppercase tracking-wider font-extrabold text-[#2ecc71] bg-[#2ecc71]/10 border border-[#2ecc71]/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-[#2ecc71] rounded-full animate-ping" />
                      Active Sync
                    </span>

                    <h4 className="text-xs font-bold text-[#1e1b4b] dark:text-white mb-4 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                      {language === 'es' ? 'Extensión de Navegador (Mock UI)' : 'Browser Extension (Mock UI)'}
                    </h4>

                    <div className="space-y-3 font-sans">
                      <div className="bg-white dark:bg-[#1f2937] p-3 rounded-lg border border-slate-150 dark:border-slate-800 text-xs">
                        <span className="text-[10px] text-slate-400 block">{language === 'es' ? 'Vacante detectada:' : 'Detected Job:'}</span>
                        <strong className="text-[#1e1b4b] dark:text-white">Senior React Developer</strong>
                        <span className="text-[#1e1b4b]/60 dark:text-slate-400 block mt-0.5">Vercel Inc. &middot; Remote</span>
                      </div>

                      <div className="flex gap-2">
                        <button className="flex-1 bg-[#8b5cf6] text-white hover:bg-[#8b5cf6]/90 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 stroke-[1.75]" />
                          {language === 'es' ? 'Sincronizar con Matchply' : 'Sync to Matchply'}
                        </button>
                        <div className="w-12 bg-[#2ecc71]/10 text-[#2ecc71] border border-[#2ecc71]/20 rounded-lg flex flex-col items-center justify-center text-[10px] font-bold">
                          <span>94%</span>
                          <span className="text-[7px] text-[#2ecc71]/80 uppercase">Match</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs font-sans font-light text-[#1e1b4b]/60 dark:text-slate-400 leading-relaxed">
                    {language === 'es' ? (
                      <>
                        Al pulsar <strong>"Sincronizar"</strong>, la extensión inyectará los datos automáticamente y creará una versión de currículum optimizada basada en tu CV Principal en menos de 3 segundos.
                      </>
                    ) : (
                      <>
                        Clicking <strong>"Sync"</strong> instantly pushes the job to your Kanban board and builds an optimized custom resume copy under 3 seconds.
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: CAREER-OPS */}
              {activeTab === 'careerops' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex gap-4 items-start">
                    <div className="p-3 bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/20 rounded-xl shrink-0">
                      <Server className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-[#1e1b4b] dark:text-white">
                        Integración con Plataforma Career-Ops
                      </h3>
                      <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans font-light leading-relaxed">
                        {language === 'es' 
                          ? 'Vincula tu cuenta para sincronizar de manera automatizada las vacantes pre-evaluadas y optimizadas de la plataforma madre directamente a tu Kanban personal.'
                          : 'Link your workspace to dynamically sync pre-evaluated job vacancies directly to your visual board from the master Career-Ops engine.'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 font-sans">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#1e1b4b]/80 dark:text-slate-350">
                      {language === 'es' ? 'Variables locales en tu archivo .env' : 'Local variables for your .env file'}
                    </label>
                    <div className="relative bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 p-4 rounded-xl font-mono text-[10px] text-[#1e1b4b]/80 dark:text-slate-200 select-all leading-relaxed whitespace-pre-wrap">
                      <button 
                        onClick={() => handleCopy("MATCHPLY_API_KEY=matchply_usr_...\nMATCHPLY_API_URL=https://matchply.com/api/external/applications", 'key')}
                        className="absolute top-2.5 right-2.5 p-1.5 rounded-md hover:bg-slate-250 dark:hover:bg-slate-800 transition-colors text-slate-400"
                        title="Copiar configuración"
                      >
                        {copiedText === 'key' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      {`# Configuración oficial de Sincronización\n`}
                      {`MATCHPLY_API_KEY=matchply_usr_c3a7b... (Tu clave personal)\n`}
                      {`MATCHPLY_API_URL=https://matchply.com/api/external/applications`}
                    </div>
                  </div>

                  <div className="flex gap-3.5 items-start p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500 rounded-xl text-xs">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="font-light leading-relaxed">
                      <strong>{language === 'es' ? 'Aislamiento seguro multitenant:' : 'Secure multitenant isolation:'}</strong>{' '}
                      {language === 'es' 
                        ? 'Al inyectar tu API Key de usuario, Matchply ignorará cualquier email del cuerpo del JSON y asociará la oferta directamente a tu cuenta protegida.'
                        : 'By providing your personal key, Matchply routes all synchronization calls strictly to your workspace, ignoring any email field overrides.'}
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 3: CUSTOM CODING */}
              {activeTab === 'developer' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex gap-4 items-start">
                    <div className="p-3 bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/20 rounded-xl shrink-0">
                      <Terminal className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-[#1e1b4b] dark:text-white">
                        {language === 'es' ? 'Desarrollo de Scripts Personalizados' : 'Custom Developer Scripts'}
                      </h3>
                      <p className="text-xs text-[#1e1b4b]/60 dark:text-slate-400 font-sans font-light leading-relaxed">
                        {language === 'es'
                          ? 'Interactúa con nuestra API mediante Curl, Python, Node.js o cualquier lenguaje capaz de enviar peticiones JSON.'
                          : 'Interact with our developer endpoint using Curl, Python, Node.js, or any HTTP JSON client.'}
                      </p>
                    </div>
                  </div>

                  {/* Code Container */}
                  <div className="space-y-4">
                    {/* cURL Block */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 font-sans">cURL</span>
                      <div className="relative bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 p-4 rounded-xl font-mono text-[9px] text-[#1e1b4b]/80 dark:text-slate-200 select-all leading-relaxed whitespace-pre-wrap">
                        <button 
                          onClick={() => handleCopy(curlCommand, 'curl')}
                          className="absolute top-2.5 right-2.5 p-1.5 rounded-md hover:bg-slate-250 dark:hover:bg-slate-800 transition-colors text-slate-400"
                        >
                          {copiedText === 'curl' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        {curlCommand}
                      </div>
                    </div>

                    {/* Python Block */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 font-sans">Python</span>
                      <div className="relative bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 p-4 rounded-xl font-mono text-[9px] text-[#1e1b4b]/80 dark:text-slate-200 select-all leading-relaxed whitespace-pre-wrap">
                        <button 
                          onClick={() => handleCopy(pythonCode, 'python')}
                          className="absolute top-2.5 right-2.5 p-1.5 rounded-md hover:bg-slate-250 dark:hover:bg-slate-800 transition-colors text-slate-400"
                        >
                          {copiedText === 'python' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        {pythonCode}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>

        {/* Right 1 Column: Interactive Payload Simulator */}
        <div className="space-y-6 lg:sticky lg:top-24">
          <div className="bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 p-6 rounded-2xl shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1e1b4b] dark:text-white flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-[#8b5cf6] fill-[#8b5cf6]" />
                {language === 'es' ? 'Simulación de Payload' : 'Payload Simulator'}
              </h3>
              <span className="text-[9px] text-slate-400 font-mono">POST 200 OK</span>
            </div>

            {/* Fields List */}
            <div className="space-y-4 font-sans text-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-[#8b5cf6]">title</span>
                  <span className="text-[8px] text-slate-400 uppercase font-semibold">string (Required)</span>
                </div>
                <div className="bg-[#fafafa] dark:bg-[#0b0f19] border border-slate-200/50 dark:border-slate-850 px-2.5 py-1.5 rounded-md text-[10px] truncate text-[#1e1b4b] dark:text-slate-300">
                  {payloadExample.title}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-[#8b5cf6]">company</span>
                  <span className="text-[8px] text-slate-400 uppercase font-semibold">string (Required)</span>
                </div>
                <div className="bg-[#fafafa] dark:bg-[#0b0f19] border border-slate-200/50 dark:border-slate-850 px-2.5 py-1.5 rounded-md text-[10px] truncate text-[#1e1b4b] dark:text-slate-300">
                  {payloadExample.company}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-slate-400">url</span>
                  <span className="text-[8px] text-slate-400 uppercase font-semibold">string (Optional)</span>
                </div>
                <div className="bg-[#fafafa] dark:bg-[#0b0f19] border border-slate-200/50 dark:border-slate-850 px-2.5 py-1.5 rounded-md text-[10px] truncate text-[#1e1b4b] dark:text-slate-300">
                  {payloadExample.url}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-slate-400">cvMarkdownTailored</span>
                  <span className="text-[8px] text-slate-400 uppercase font-semibold">string (Optional)</span>
                </div>
                <div className="bg-[#fafafa] dark:bg-[#0b0f19] border border-slate-200/50 dark:border-slate-850 px-2.5 py-1.5 rounded-md text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                  {payloadExample.cvMarkdownTailored}
                </div>
                <span className="text-[8.5px] text-[#8b5cf6] block mt-1">
                  💡 {language === 'es' ? 'Genera automáticamente un CV con tu estética principal.' : 'Builds a resume automatically utilizing your styling settings.'}
                </span>
              </div>
            </div>

            {/* Success Response Preview */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 font-sans block">
                {language === 'es' ? 'Respuesta del Servidor:' : 'Server Response:'}
              </span>
              <div className="bg-[#0b0f19] text-[#2ecc71] font-mono p-3 rounded-lg text-[9px] leading-relaxed border border-slate-800">
                {`{\n`}
                {`  "success": true,\n`}
                {`  "offerId": "job_d9a8c17...",\n`}
                {`  "cvId": "cv_e3c109f...",\n`}
                {`  "message": "Application created successfully"\n`}
                {`}`}
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
