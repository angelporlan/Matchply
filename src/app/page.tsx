import Link from 'next/link';
import { auth } from '@/auth';
import { Sparkles, FileText, CheckCircle, ArrowRight, Briefcase, CreditCard, ChevronRight, BarChart2, Layers } from 'lucide-react';

export default async function LandingPage() {
  const session = await auth();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#030712] pt-16">
      {/* Background radial glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-sky-950/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[45%] h-[45%] rounded-full bg-purple-950/25 blur-[130px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="fixed inset-x-0 top-0 z-50 glass-nav-ios">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-sky-400 to-indigo-500 p-2 rounded-xl text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              NextProf <span className="text-sky-400">AI</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">Características</a>
            <a href="#templates" className="hover:text-white transition-colors">Plantillas</a>
            <a href="#pricing" className="hover:text-white transition-colors">Precios</a>
          </nav>

          <div className="flex items-center gap-4">
            {session ? (
              <Link
                href="/dashboard"
                className="bg-white hover:bg-slate-100 text-slate-950 font-semibold px-4 py-2 rounded-xl text-sm transition-all shadow-sm flex items-center gap-1.5"
              >
                Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-slate-300 hover:text-white font-medium text-sm transition-colors"
                >
                  Iniciar Sesión
                </Link>
                <Link
                  href="/register"
                  className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-all shadow-md shadow-sky-500/10 hover:shadow-sky-500/20"
                >
                  Registrarse
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-full px-4 py-1.5 text-xs text-sky-400 mb-8 animate-pulse-subtle">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Optimización de CVs impulsada por Inteligencia Artificial Híbrida</span>
        </div>

        <h1 className="font-display font-black text-4xl sm:text-6xl lg:text-7xl tracking-tight leading-[1.1] mb-6 text-white">
          Multiplica por <span className="bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">10x tu Match</span> con ofertas de empleo
        </h1>

        <p className="max-w-3xl mx-auto text-lg sm:text-xl text-slate-400 font-light mb-10 leading-relaxed">
          Genera versiones personalizadas de tu currículum adaptadas exactamente a cada puesto. Redacción Harvard profesional, editor interactivo en tiempo real y visor PDF inteligente.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={session ? "/dashboard" : "/register"}
            className="w-full sm:w-auto bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold px-8 py-4 rounded-2xl shadow-lg shadow-sky-500/15 hover:shadow-sky-500/30 transition-all flex items-center justify-center gap-2 text-base group"
          >
            Optimizar Mi CV Ahora
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a
            href="#templates"
            className="w-full sm:w-auto bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white px-8 py-4 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2 text-base"
          >
            Explorar Plantillas
          </a>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 border-t border-slate-900 bg-slate-950/40 relative scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-white mb-4">
              Una suite potente de optimización profesional
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto font-light">
              Desde el editor interactivo con auto-guardado hasta la inteligencia semántica y el pipeline de postulaciones.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass-card p-8 rounded-3xl glow-primary transition-all hover:translate-y-[-4px]">
              <div className="bg-sky-500/10 border border-sky-500/20 p-4 rounded-2xl text-sky-400 w-fit mb-6">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Editor Split-Screen</h3>
              <p className="text-slate-400 text-sm font-light leading-relaxed">
                Escribe en Markdown al lado izquierdo y visualiza los ajustes de diseño, fuentes y márgenes aplicados instantáneamente en el PDF a la derecha.
              </p>
            </div>

            <div className="glass-card p-8 rounded-3xl glow-accent transition-all hover:translate-y-[-4px]">
              <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-2xl text-purple-400 w-fit mb-6">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">IA Híbrida Inteligente</h3>
              <p className="text-slate-400 text-sm font-light leading-relaxed">
                Utiliza OpenRouter con Qwen de forma gratuita. O escala al plan Pro para canalizar directamente con APIs oficiales de DeepSeek y Gemini para optimizaciones con el método STAR.
              </p>
            </div>

            <div className="glass-card p-8 rounded-3xl glow-primary transition-all hover:translate-y-[-4px]">
              <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl text-indigo-400 w-fit mb-6">
                <BarChart2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Tablero Kanban</h3>
              <p className="text-slate-400 text-sm font-light leading-relaxed">
                Registra tus postulaciones en un panel visual elegante de 5 columnas. Vincula el CV personalizado exacto que utilizaste para cada oferta de empleo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Showcase of 5 templates */}
      <section id="templates" className="py-24 border-t border-slate-900 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-white mb-4">
              5 Plantillas de Nivel Profesional y Ultra-Optimizadas
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto font-light">
              Diseñadas para respetar la regla dorada de 1 página. El texto respira y encaja a la perfección según tus necesidades.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-slate-300 w-fit mb-4 text-xs font-semibold">
                  Harvard
                </div>
                <h4 className="text-lg font-bold text-white mb-2">Harvard</h4>
                <p className="text-slate-400 text-xs font-light leading-relaxed">
                  El estándar de oro. Diseño clásico centrado, jerarquía rigurosa y máxima aceptación por reclutadores en banca, consultoría y Big Tech.
                </p>
              </div>
              <div className="mt-4 text-sky-400 text-xs font-semibold flex items-center gap-1">
                Elegir clásico <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-sky-400 w-fit mb-4 text-xs font-semibold">
                  Modern
                </div>
                <h4 className="text-lg font-bold text-white mb-2">Modern</h4>
                <p className="text-slate-400 text-xs font-light leading-relaxed">
                  Asimetría de vanguardia con barra lateral azul petróleo. Ideal para roles de ingeniería de software, analistas y gerencia intermedia.
                </p>
              </div>
              <div className="mt-4 text-sky-400 text-xs font-semibold flex items-center gap-1">
                Elegir moderno <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-purple-400 w-fit mb-4 text-xs font-semibold">
                  Minimal
                </div>
                <h4 className="text-lg font-bold text-white mb-2">Minimal</h4>
                <p className="text-slate-400 text-xs font-light leading-relaxed">
                  Elegancia pura. Texto sobrio y márgenes extra-amplios que aseguran un balance perfecto para perfiles ejecutivos o creativos senior.
                </p>
              </div>
              <div className="mt-4 text-sky-400 text-xs font-semibold flex items-center gap-1">
                Elegir minimal <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-pink-400 w-fit mb-4 text-xs font-semibold">
                  Creative
                </div>
                <h4 className="text-lg font-bold text-white mb-2">Creative</h4>
                <p className="text-slate-400 text-xs font-light leading-relaxed">
                  Inspiración disruptiva con degradados magenta/púrpura y un panel visual lateral que destaca en agencias, startups y diseño.
                </p>
              </div>
              <div className="mt-4 text-sky-400 text-xs font-semibold flex items-center gap-1">
                Elegir creativo <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-red-400 w-fit mb-4 text-xs font-semibold">
                  Swiss
                </div>
                <h4 className="text-lg font-bold text-white mb-2">Swiss</h4>
                <p className="text-slate-400 text-xs font-light leading-relaxed">
                  Inspirada en el diseño internacional suizo. Geometría perfecta, bordes finos de separación y un acento rojo neón icónico.
                </p>
              </div>
              <div className="mt-4 text-sky-400 text-xs font-semibold flex items-center gap-1">
                Elegir suizo <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Grid */}
      <section id="pricing" className="py-24 border-t border-slate-900 bg-slate-950/30 relative scroll-mt-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-white mb-4">
              Precios transparentes diseñados para tu éxito
            </h2>
            <p className="text-slate-400 font-light max-w-xl mx-auto">
              Empieza gratis hoy mismo y escala al plan Pro cuando requieras optimizaciones y match semántico ilimitado.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Free Plan */}
            <div className="glass-card p-8 rounded-3xl border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Plan Invitado</span>
                <h3 className="text-2xl font-bold text-white mt-2 mb-4">Gratuito</h3>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-black text-white">€0</span>
                  <span className="text-sm text-slate-400">/ para siempre</span>
                </div>
                <ul className="space-y-3.5 text-sm font-light text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-sky-400" />
                    <span>1 Currículum Base en Markdown</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-sky-400" />
                    <span>Editor interactivo en vivo</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-sky-400" />
                    <span>Descarga de PDF (Plantilla Harvard)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-sky-400" />
                    <span>Optimización IA básica (OpenRouter)</span>
                  </li>
                </ul>
              </div>
              <Link
                href={session ? "/dashboard" : "/register"}
                className="w-full mt-8 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-white text-center font-semibold py-3.5 rounded-xl transition-all"
              >
                Empezar Gratis
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="glass-card p-8 rounded-3xl border border-sky-500/30 relative flex flex-col justify-between glow-primary">
              <div className="absolute top-4 right-4 bg-sky-500/15 border border-sky-500/35 text-sky-400 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                Recomendado
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Plan Premium</span>
                <h3 className="text-2xl font-bold text-white mt-2 mb-4">Profesional</h3>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-black text-white">€10</span>
                  <span className="text-sm text-slate-400">/ al mes</span>
                </div>
                <ul className="space-y-3.5 text-sm font-light text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-sky-400" />
                    <span className="font-medium text-white">Currículums ilimitados</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-sky-400" />
                    <span>Acceso a las 5 Plantillas Premium</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-sky-400" />
                    <span>Optimización IA oficial (DeepSeek o Gemini)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-sky-400" />
                    <span className="font-medium text-white">Tablero Kanban de candidaturas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-sky-400" />
                    <span>Alineación de palabras clave con el método STAR</span>
                  </li>
                </ul>
              </div>
              {session ? (
                <a
                  href="/api/stripe/checkout"
                  className="w-full mt-8 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-center font-bold py-3.5 rounded-xl transition-all shadow-md shadow-sky-500/10"
                >
                  Adquirir Plan Pro
                </a>
              ) : (
                <Link
                  href="/register"
                  className="w-full mt-8 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-center font-bold py-3.5 rounded-xl transition-all shadow-md shadow-sky-500/10"
                >
                  Registrarse y Comprar Pro
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-900 text-center text-xs text-slate-500 font-light">
        <p>&copy; {new Date().getFullYear()} NextProf AI. Diseñado con tecnologías de última generación.</p>
      </footer>
    </div>
  );
}
