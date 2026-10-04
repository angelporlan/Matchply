'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Users, ChevronDown, Briefcase, FileText, Menu, UserPlus, X } from 'lucide-react';
import ThemeToggle from '@/components/ui/ThemeToggle';
import LanguageToggle from '@/components/ui/LanguageToggle';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import Logo from '@/components/ui/Logo';
import UserMenu from '@/components/account/UserMenu';
import NavigationLink from '@/components/navigation/NavigationLink';
import { useNavigationPending } from '@/components/navigation/NavigationPendingProvider';
import SidebarLimits from '@/components/subscription/SidebarLimits';

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string | null;
  };
  isPremium: boolean;
  isGuest?: boolean;
  supportMode?: boolean;
}

type SidebarChildItem = {
  name: string;
  href: string;
  isActive: (pathname: string) => boolean;
  icon: typeof Building2;
};

type SidebarMenuItem = {
  name: string;
  href: string;
  icon: any;
  children?: SidebarChildItem[];
};

function isApplicationsListPath(pathname: string) {
  return pathname === '/dashboard/applications' || pathname.startsWith('/dashboard/applications/offer');
}

function isCompaniesPath(pathname: string) {
  return pathname.startsWith('/dashboard/applications/companies');
}

export default function Sidebar({ user, isPremium, isGuest = false, supportMode = false }: SidebarProps) {
  const pathname = usePathname();
  const { pendingHref } = useNavigationPending();
  const [isOpen, setIsOpen] = useState(false);
  const [applicationsOpen, setApplicationsOpen] = useState(
    isApplicationsListPath(pathname) || isCompaniesPath(pathname) || pathname.startsWith('/dashboard/applications/people'),
  );
  const { t, language } = useLanguage();

  const menuItems: SidebarMenuItem[] = [
    {
      name: t('sidebar.menu.cvs'),
      href: '/dashboard',
      icon: FileText,
    },
    {
      name: t('sidebar.menu.applications'),
      href: '/dashboard/applications',
      icon: Briefcase,
      children: [
        {
          name: t('sidebar.menu.companies'),
          href: '/dashboard/applications/companies',
          isActive: isCompaniesPath,
          icon: Building2,
        },
        { name: language === 'es' ? 'Personas' : 'People', href: '/dashboard/applications/people', icon: Users, isActive: (path: string) => path.startsWith('/dashboard/applications/people') },
      ],
    },
  ];

  const toggleSidebar = () => setIsOpen(!isOpen);

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    if (href === '/dashboard/applications') {
      return isApplicationsListPath(pathname);
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between h-16 px-4 bg-canvas border-b border-subtle w-full sticky top-0 z-40 transition-colors duration-300">
        <Link href="/dashboard" className="hover:opacity-90 transition-opacity">
          <Logo iconSize="sm" textSize="sm" />
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle compact />
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
          className="fixed inset-0 bg-black/60 dark:bg-black/80 z-40 md:hidden backdrop-blur-xs transition-opacity"
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
          {/* Logo & Controls at original position */}
          <div className="flex items-center justify-between">
            <Link href="/" className="hover:opacity-90 transition-opacity">
              <Logo />
            </Link>
            <div className="hidden md:flex items-center gap-2">
              <LanguageToggle compact />
              <ThemeToggle />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const childActive = Boolean(item.children?.some((child) => child.isActive(pathname)));
              const active = isActive(item.href);
              if (!item.children) {
                const pending = pendingHref === item.href;
                return (
                  <NavigationLink
                    key={item.name}
                    href={item.href}
                    isCurrent={active}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-[8px] text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-surface-muted text-text shadow-sm'
                        : pending
                        ? 'bg-surface-muted/70 text-text'
                        : 'text-text-muted hover:text-text hover:bg-surface-muted'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 stroke-[1.75] ${
                        active || pending ? 'text-text' : 'text-text-muted'
                      }`}
                    />
                    <span>{item.name}</span>
                    {pending && !active && (
                      <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-text-muted">
                        {t('sidebar.nav.pending')}
                      </span>
                    )}
                  </NavigationLink>
                );
              }

              return (
                <div key={item.name} className="space-y-1">
                  <div
                    className={`flex items-center rounded-[8px] text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-surface-muted text-text shadow-sm'
                        : childActive
                        ? 'text-text hover:bg-surface-muted'
                        : 'text-text-muted hover:text-text hover:bg-surface-muted'
                    }`}
                  >
                    <NavigationLink
                      href={item.href}
                      isCurrent={active}
                      onClick={() => setIsOpen(false)}
                      className="flex flex-1 items-center gap-3 px-4 py-3 min-w-0"
                    >
                      <Icon
                        className={`w-4 h-4 stroke-[1.75] ${
                          active || childActive ? 'text-text' : 'text-text-muted'
                        }`}
                      />
                      <span className="truncate">{item.name}</span>
                      {pendingHref === item.href && !active && (
                        <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-text-muted">
                          {t('sidebar.nav.pending')}
                        </span>
                      )}
                    </NavigationLink>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setApplicationsOpen((open) => !open);
                      }}
                      aria-expanded={applicationsOpen}
                      aria-label={t('sidebar.menu.toggleApplications')}
                      className="shrink-0 mr-1 p-1.5 rounded-[8px] text-text-muted hover:bg-surface-muted hover:text-text transition-colors"
                    >
                      <ChevronDown
                        className={`w-4 h-4 stroke-[1.75] transition-transform ${applicationsOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </div>
                  {applicationsOpen && (
                    <div className="ml-4 pl-3 border-l border-subtle space-y-1">
                      {item.children.map((child) => {
                        const childIsActive = child.isActive(pathname);
                        const ChildIcon = child.icon;
                        return (
                          <NavigationLink
                            key={child.href}
                            href={child.href}
                            isCurrent={childIsActive}
                            onClick={() => setIsOpen(false)}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-sm font-semibold transition-colors ${
                              childIsActive
                                ? 'bg-surface-muted text-text'
                                : pendingHref === child.href
                                ? 'bg-surface-muted/70 text-text'
                                : 'text-text-muted hover:text-text hover:bg-surface-muted'
                            }`}
                          >
                            <ChildIcon className="w-3.5 h-3.5 stroke-[1.75]" />
                            <span>{child.name}</span>
                            {pendingHref === child.href && !childIsActive && (
                              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-text-muted">
                                {t('sidebar.nav.pending')}
                              </span>
                            )}
                          </NavigationLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* User profile & limits */}
        <div className="pt-4 border-t border-subtle space-y-3 mt-auto shrink-0">
          {/* Sleek Limits Accordion */}
          <SidebarLimits />

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
            <UserMenu user={user} isPremium={isPremium} supportMode={supportMode} />
          )}
        </div>
      </aside>
    </>
  );
}
