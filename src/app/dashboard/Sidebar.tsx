'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Kanban, FileText, Menu, UserPlus, X } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';
import LanguageToggle from '@/components/ui/LanguageToggle';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Logo from '@/components/ui/Logo';
import UserMenu from '@/components/account/UserMenu';

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string | null;
  };
  isPremium: boolean;
  isGuest?: boolean;
}

type SidebarMenuItem = {
  name: string;
  href: string;
  icon: any;
};

export default function Sidebar({ user, isPremium, isGuest = false }: SidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const { t, language } = useLanguage();

  const menuItems: SidebarMenuItem[] = isGuest ? [
    {
      name: language === 'es' ? 'Nueva prueba' : 'New trial',
      href: '/try',
      icon: FileText,
    },
  ] : [
    {
      name: t('sidebar.menu.cvs'),
      href: '/dashboard',
      icon: FileText,
    },
    {
      name: t('sidebar.menu.kanban'),
      href: '/dashboard/kanban',
      icon: Kanban,
    },
  ];

  const toggleSidebar = () => setIsOpen(!isOpen);

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between h-16 px-4 bg-canvas border-b border-subtle w-full sticky top-0 z-40 transition-colors duration-300">
        <Link href={isGuest ? "/try" : "/dashboard"} className="hover:opacity-90 transition-opacity">
          <Logo iconSize="sm" textSize="sm" />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-[8px] border border-subtle text-text-muted dark:text-slate-300"
            aria-label="Toggle Menu"
          >
            {isOpen ? <X className="w-5 h-5 stroke-[1.75]" /> : <Menu className="w-5 h-5 stroke-[1.75]" />}
          </button>
        </div>
      </div>

      {/* Sidebar Velo overlay on mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-[#1e1b4b]/40 dark:bg-black/60 z-40 md:hidden backdrop-blur-xs transition-opacity"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-canvas border-r border-subtle z-50 transition-all duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col justify-between p-6 select-none`}
      >
        <div className="space-y-8">
          {/* Logo & ThemeToggle at original position */}
          <div className="flex items-center justify-between">
            <Link href="/" className="hover:opacity-90 transition-opacity">
              <Logo />
            </Link>
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 px-4 py-3 rounded-[8px] text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-surface-muted text-text shadow-sm'
                      : 'text-text-muted hover:text-text hover:bg-surface-muted'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 stroke-[1.75] ${
                      active ? 'text-text' : 'text-text-muted'
                    }`}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile & language settings */}
        <div className="pt-4 border-t border-subtle space-y-4">
          {/* Sleek Language Panel */}
          <div className="flex items-center justify-between bg-surface-muted/30 border border-subtle px-3 py-2 rounded-[10px] shadow-xs">
            <span className="text-[11px] font-bold text-text-muted font-display">
              {language === 'es' ? 'Idioma' : 'Language'}
            </span>
            <LanguageToggle />
          </div>

          {isGuest ? (
            <>
              {/* Guest profile */}
              <div className="flex items-center justify-between px-1">
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-text truncate font-display">
                    {language === 'es' ? 'Invitado' : 'Guest'}
                  </span>
                  <span className="block text-[11px] text-text-muted truncate">
                    {language === 'es' ? 'Prueba sin registro' : 'Trial without signup'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 font-display">
                <Link
                  href="/register"
                  className="flex items-center justify-center gap-2 w-full bg-action hover:bg-action-hover text-on-action font-bold py-2.5 px-4 rounded-[8px] text-xs transition-all shadow-sm"
                >
                  <UserPlus className="w-3.5 h-3.5 stroke-[1.75]" />
                  <span>{language === 'es' ? 'Guardar mi CV' : 'Save my CV'}</span>
                </Link>
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 w-full bg-surface-muted/30 text-text-muted dark:text-slate-300 border border-subtle font-bold py-2.5 px-4 rounded-[8px] text-xs transition-all shadow-sm"
                >
                  {language === 'es' ? 'Ya tengo cuenta' : 'I have an account'}
                </Link>
              </div>
            </>
          ) : (
            <UserMenu user={user} isPremium={isPremium} />
          )}
        </div>
      </aside>
    </>
  );
}
