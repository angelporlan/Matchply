'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import Logo from '@/components/ui/Logo';
import ThemeToggle from '@/components/ui/ThemeToggle';
import LanguageToggle from '@/components/ui/LanguageToggle';
import type { LandingContent } from '@/lib/landing-content';

export default function LandingHeader({ isLoggedIn, copy }: { isLoggedIn: boolean; copy: LandingContent['nav'] }) {
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const accountHref = isLoggedIn ? '/dashboard' : '/login';
  const accountLabel = isLoggedIn ? copy.workspace : copy.login;

  useEffect(() => {
    if (!open) return;
    firstLinkRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const closeOutside = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const wideViewport = window.matchMedia('(min-width: 1024px)');
    const closeWhenWide = () => { if (wideViewport.matches) setOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOutside);
    wideViewport.addEventListener('change', closeWhenWide);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOutside);
      wideViewport.removeEventListener('change', closeWhenWide);
    };
  }, [open]);

  const links = [{ href: '#how-it-works', text: copy.how }, { href: '#pricing', text: copy.pricing }, { href: '#faq', text: copy.faq }];

  return (
    <header ref={headerRef} className="sticky top-0 z-40 border-b border-subtle bg-canvas/95 backdrop-blur-sm">
      <a href="#main-content" className="sr-only z-50 rounded-lg bg-surface px-4 py-3 text-text focus:not-sr-only focus:absolute focus:left-4 focus:top-2">{copy.skip}</a>
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label={copy.home} className="flex min-h-11 items-center rounded-lg"><Logo iconSize="sm" textSize="md" /></Link>
        <nav aria-label={copy.label} className="hidden items-center gap-6 lg:flex">
          {links.map(link => <a key={link.href} href={link.href} className="flex min-h-11 items-center text-sm font-medium text-text-muted hover:text-text">{link.text}</a>)}
        </nav>
        <div className="landing-controls flex items-center gap-2 sm:gap-3">
          <div className="hidden lg:block"><LanguageToggle /></div>
          <ThemeToggle />
          <Link href={accountHref} className="hidden min-h-11 items-center px-2 text-sm font-semibold text-text hover:underline lg:flex">{accountLabel}</Link>
          <button ref={toggleRef} type="button" onClick={() => setOpen(!open)} aria-label={open ? copy.close : copy.menu} aria-expanded={open} aria-controls="landing-mobile-navigation" className="flex h-11 w-11 items-center justify-center rounded-lg border border-control bg-surface text-text lg:hidden">
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>
      <div id="landing-mobile-navigation" hidden={!open} className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-subtle bg-surface px-4 py-5 shadow-lg lg:hidden">
        <nav aria-label={copy.label} className="mx-auto flex max-w-7xl flex-col gap-1">
          {links.map((link, index) => <a ref={index === 0 ? firstLinkRef : undefined} key={link.href} href={link.href} onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-text hover:bg-surface-muted">{link.text}</a>)}
          <Link href={accountHref} onClick={() => setOpen(false)} className="mt-2 flex min-h-11 items-center rounded-lg border-t border-subtle px-3 pt-3 font-semibold text-text">{accountLabel}</Link>
        </nav>
        <div className="landing-controls mx-auto mt-4 max-w-7xl px-3"><LanguageToggle /></div>
      </div>
    </header>
  );
}
