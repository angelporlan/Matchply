'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, ArrowRight } from 'lucide-react';
import Logo from '@/components/ui/Logo';
import ThemeToggle from '@/components/ui/ThemeToggle';
import LanguageToggle from '@/components/ui/LanguageToggle';

interface LandingHeaderProps {
  isLoggedIn: boolean;
  navFeatures: string;
  navTemplates: string;
  navPricing: string;
  navDashboard: string;
  navLogin: string;
  navRegister: string;
}

export default function LandingHeader({
  isLoggedIn,
  navFeatures,
  navTemplates,
  navPricing,
  navDashboard,
  navLogin,
  navRegister,
}: LandingHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-canvas/80 dark:bg-canvas/80 backdrop-blur-md border-b border-subtle shadow-sm transition-all duration-300">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left Side: Logo */}
        <div className="flex items-center gap-2 z-10">
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <Logo iconSize="sm" textSize="md" />
          </Link>
        </div>

        {/* Center: Desktop Nav Links (Hidden on Mobile) */}
        <nav className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-8 text-sm font-semibold text-text-muted dark:text-slate-300">
          <a href="#features" className="hover:text-text dark:hover:text-white transition-colors">{navFeatures}</a>
          <a href="#templates" className="hover:text-text dark:hover:text-white transition-colors">{navTemplates}</a>
          <a href="#pricing" className="hover:text-text dark:hover:text-white transition-colors">{navPricing}</a>
        </nav>

        {/* Right Side: Desktop Controls & Buttons (Hidden on Mobile) */}
        <div className="hidden md:flex items-center gap-4 z-10">
          <LanguageToggle />
          <ThemeToggle />

          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="bg-text dark:bg-white text-canvas hover:bg-text/95 dark:hover:bg-surface-muted font-bold px-4 py-2 rounded-[8px] text-sm transition-all shadow-sm flex items-center gap-1.5 font-display"
            >
              {navDashboard} <ArrowRight className="w-4 h-4 stroke-[1.75]" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-text-muted dark:text-slate-300 hover:text-text dark:hover:text-white font-semibold text-sm transition-colors"
              >
                {navLogin}
              </Link>
              <Link
                href="/try"
                className="bg-text dark:bg-white text-canvas hover:bg-text/90 dark:hover:bg-surface-muted font-bold px-4 py-2 rounded-[8px] text-sm transition-all shadow-sm font-display"
              >
                {navRegister}
              </Link>
            </>
          )}
        </div>

        {/* Mobile Controls & Hamburger Button (Visible on Mobile) */}
        <div className="flex md:hidden items-center gap-2 z-10">
          <ThemeToggle />
          <button
            onClick={toggleMenu}
            className="p-2 rounded-[8px] border border-subtle text-text-muted dark:text-slate-300 transition-all hover:bg-surface-muted dark:hover:bg-white/5"
            aria-label="Toggle Navigation Menu"
            aria-expanded={isOpen}
          >
            {isOpen ? <X className="w-5 h-5 stroke-[1.75]" /> : <Menu className="w-5 h-5 stroke-[1.75]" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer Overlay */}
      {isOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 bg-canvas/95 dark:bg-canvas/95 backdrop-blur-lg border-b border-subtle p-6 flex flex-col gap-6 shadow-xl z-40 transition-all duration-300 animate-accordion-down max-h-[calc(100vh-4rem)] overflow-y-auto">
          {/* Mobile Nav Links */}
          <nav className="flex flex-col gap-4 text-base font-semibold text-text-muted dark:text-text">
            <a
              href="#features"
              onClick={() => setIsOpen(false)}
              className="px-2 py-1.5 rounded-lg hover:bg-surface-muted dark:hover:bg-white/5 transition-colors"
            >
              {navFeatures}
            </a>
            <a
              href="#templates"
              onClick={() => setIsOpen(false)}
              className="px-2 py-1.5 rounded-lg hover:bg-surface-muted dark:hover:bg-white/5 transition-colors"
            >
              {navTemplates}
            </a>
            <a
              href="#pricing"
              onClick={() => setIsOpen(false)}
              className="px-2 py-1.5 rounded-lg hover:bg-text/5 dark:hover:bg-white/5 transition-colors"
            >
              {navPricing}
            </a>
          </nav>

          {/* Divider */}
          <div className="h-px bg-text/10 dark:bg-white/10" />

          {/* Language Toggle in Drawer */}
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-bold text-text-muted font-display">
              Idioma / Language
            </span>
            <LanguageToggle />
          </div>

          {/* Stacked Action Buttons */}
          <div className="flex flex-col gap-3 mt-2">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                onClick={() => setIsOpen(false)}
                className="w-full bg-text dark:bg-white text-canvas hover:bg-text/95 dark:hover:bg-surface-muted font-bold py-3 rounded-[8px] text-sm text-center transition-all shadow-sm flex items-center justify-center gap-1.5 font-display"
              >
                {navDashboard} <ArrowRight className="w-4 h-4 stroke-[1.75]" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="w-full bg-surface border border-subtle text-text font-bold py-3 rounded-[8px] text-sm text-center transition-all shadow-sm font-display hover:bg-canvas dark:hover:bg-surface-muted/80"
                >
                  {navLogin}
                </Link>
                <Link
                  href="/try"
                  onClick={() => setIsOpen(false)}
                  className="w-full bg-action hover:bg-action/90 text-on-action font-bold py-3 rounded-[8px] text-sm text-center transition-all shadow-sm font-display"
                >
                  {navRegister}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
