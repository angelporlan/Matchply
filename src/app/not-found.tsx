'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Briefcase,
  Compass,
  FileText,
  Home,
  Kanban,
  Mail,
  User,
} from 'lucide-react';
import Logo from '@/components/ui/Logo';
import { ButtonLink } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function NotFound() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <div className="relative min-h-screen bg-canvas text-text flex flex-col justify-between overflow-hidden">
      {/* Luces y efectos ambientales suaves de fondo */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-ai/5 dark:bg-ai/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[450px] h-[450px] rounded-full bg-emerald-500/5 dark:bg-emerald-500/8 blur-[120px] pointer-events-none" />

      {/* Cabecera con Logo */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link href="/" aria-label="Matchply" className="inline-block transition-opacity hover:opacity-85">
          <Logo iconSize="md" textSize="md" />
        </Link>
      </header>

      {/* Contenido principal */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="max-w-2xl w-full text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-ai/10 border border-ai/25 text-ai text-xs font-bold uppercase tracking-wider mb-6 font-display">
            <Compass className="w-3.5 h-3.5 stroke-[2]" />
            <span>{t('notFound.badge')}</span>
          </div>

          {/* Número 404 de fondo / diseño */}
          <div className="relative select-none my-[-10px] sm:my-[-20px]">
            <span className="font-display font-black text-8xl sm:text-9xl tracking-tight text-text/10 dark:text-white/10 leading-none">
              404
            </span>
          </div>

          {/* Título y descripción */}
          <h1 className="relative font-display text-2xl sm:text-4xl font-extrabold text-text tracking-tight mt-2">
            {t('notFound.title')}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-text-muted dark:text-slate-350 max-w-lg mx-auto font-sans leading-relaxed">
            {t('notFound.description')}
          </p>

          {/* Botones principales de acción */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/dashboard" variant="strong">
              <Home className="w-4 h-4 stroke-[1.75]" />
              <span>{t('notFound.backDashboard')}</span>
            </ButtonLink>

            <ButtonLink href="/dashboard/applications" variant="secondary">
              <Kanban className="w-4 h-4 stroke-[1.75]" />
              <span>{t('notFound.viewApplications')}</span>
            </ButtonLink>

            <button
              type="button"
              onClick={() => router.back()}
              className="btn-raised btn-raised--ghost text-xs font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5 stroke-[1.75]" />
              <span>{t('notFound.goBack')}</span>
            </button>
          </div>

          {/* Enlaces recomendados */}
          <div className="mt-14 pt-8 border-t border-subtle dark:border-white/10 text-left">
            <h2 className="text-xs uppercase tracking-wider font-bold text-text-muted mb-4 font-display text-center sm:text-left">
              {t('notFound.quickLinks')}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                href="/dashboard"
                className="group p-3.5 rounded-[12px] bg-surface border border-subtle hover:border-ai/40 dark:border-white/10 dark:hover:border-ai/50 transition-all hover:-translate-y-0.5 shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-ai/10 text-ai group-hover:scale-105 transition-transform">
                    <FileText className="w-4 h-4 stroke-[1.75]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-text font-display truncate">
                      {t('notFound.dashboardTitle')}
                    </p>
                    <p className="text-[11px] text-text-muted truncate mt-0.5 font-sans">
                      {t('notFound.dashboardDesc')}
                    </p>
                  </div>
                </div>
              </Link>

              <Link
                href="/dashboard/applications"
                className="group p-3.5 rounded-[12px] bg-surface border border-subtle hover:border-ai/40 dark:border-white/10 dark:hover:border-ai/50 transition-all hover:-translate-y-0.5 shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                    <Briefcase className="w-4 h-4 stroke-[1.75]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-text font-display truncate">
                      {t('notFound.applicationsTitle')}
                    </p>
                    <p className="text-[11px] text-text-muted truncate mt-0.5 font-sans">
                      {t('notFound.applicationsDesc')}
                    </p>
                  </div>
                </div>
              </Link>

              <Link
                href="/dashboard/profile"
                className="group p-3.5 rounded-[12px] bg-surface border border-subtle hover:border-ai/40 dark:border-white/10 dark:hover:border-ai/50 transition-all hover:-translate-y-0.5 shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                    <User className="w-4 h-4 stroke-[1.75]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-text font-display truncate">
                      {t('notFound.profileTitle')}
                    </p>
                    <p className="text-[11px] text-text-muted truncate mt-0.5 font-sans">
                      {t('notFound.profileDesc')}
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Pie de página con soporte */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-xs text-text-muted font-sans border-t border-subtle/50 dark:border-white/5">
        <p className="flex items-center justify-center gap-1.5 flex-wrap">
          <span>{t('notFound.supportPrompt')}</span>
          <span>{t('notFound.supportContact')}</span>
          <a
            href="mailto:soporte@matchply.com"
            className="font-bold text-ai-text hover:underline inline-flex items-center gap-1"
          >
            <Mail className="w-3.5 h-3.5 stroke-[1.75]" />
            soporte@matchply.com
          </a>
        </p>
      </footer>
    </div>
  );
}
