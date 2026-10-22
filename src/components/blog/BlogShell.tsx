import Link from 'next/link';
import Logo from '@/components/ui/Logo';
import ThemeToggle from '@/components/ui/ThemeToggle';
import type { Language } from '@/lib/i18n/types';

export default function BlogShell({ language, alternate, children }: { language: Language; alternate: string; children: React.ReactNode }) {
  const es = language === 'es';
  return <div className="min-h-screen bg-canvas text-text">
    <header className="border-b border-subtle bg-surface">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:bg-surface focus:p-4">{es ? 'Ir al contenido' : 'Skip to content'}</a>
      <nav aria-label={es ? 'Navegación principal' : 'Main navigation'} className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/"><Logo iconSize="sm" textSize="md" /></Link>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/#how-it-works" className="hidden min-h-11 items-center sm:flex">{es ? 'Cómo funciona' : 'How it works'}</Link>
          <Link href="/#pricing" className="hidden min-h-11 items-center sm:flex">{es ? 'Precios' : 'Pricing'}</Link>
          <Link href={`/blog/${language}`} className="flex min-h-11 items-center font-semibold">Blog</Link>
          <a href={alternate} hrefLang={es ? 'en' : 'es'} lang={es ? 'en' : 'es'} className="flex min-h-11 items-center underline underline-offset-4">{es ? 'English' : 'Español'}</a>
          <ThemeToggle />
        </div>
      </nav>
    </header>
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">{children}</main>
    <footer className="border-t border-subtle bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-text-muted sm:px-6">
        <p>© {new Date().getFullYear()} Matchply</p>
        <nav aria-label={es ? 'Información' : 'Information'} className="flex flex-wrap gap-5">
          <Link href={`/blog/${language}`}>Blog</Link>
          <Link href="/privacy">{es ? 'Privacidad' : 'Privacy'}</Link><Link href="/terms">{es ? 'Términos' : 'Terms'}</Link>
          <a href="mailto:matchplyapp@gmail.com">{es ? 'Contacto' : 'Contact'}</a>
        </nav>
      </div>
    </footer>
  </div>;
}
