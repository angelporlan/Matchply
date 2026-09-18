'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { AnimatePresence, LazyMotion, m, domAnimation } from 'framer-motion';
import {
  ChevronUp,
  CreditCard,
  Crown,
  LogOut,
  Shield,
  SlidersHorizontal,
  Terminal,
  UserCircle,
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string | null;
  };
  isPremium: boolean;
}

function getInitials(name?: string | null, email?: string | null) {
  const source = (name || email || '').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function Avatar({
  image,
  name,
  email,
  className,
}: {
  image?: string | null;
  name?: string | null;
  email?: string | null;
  className: string;
}) {
  if (image) {
    return (
      <img
        src={image}
        alt={name || email || ''}
        referrerPolicy="no-referrer"
        className={`${className} rounded-full object-cover border border-subtle shrink-0`}
      />
    );
  }

  return (
    <span
      className={`${className} rounded-full bg-gradient-to-tr from-ai to-ai-action text-white font-bold flex items-center justify-center shrink-0 select-none`}
    >
      {getInitials(name, email)}
    </span>
  );
}

export default function UserMenu({ user, isPremium }: UserMenuProps) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    setIsOpen(false);
    setConfirmLogout(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setConfirmLogout(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setConfirmLogout(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    try {
      await signOut({ callbackUrl: '/' });
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          setConfirmLogout(false);
        }}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="w-full flex items-center gap-3 p-2 rounded-[10px] border border-subtle bg-surface-muted/40 hover:bg-white dark:hover:bg-surface-muted/70 hover:border-control dark:hover:border-white/10 transition-all shadow-xs text-left"
      >
        <Avatar image={user.image} name={user.name} email={user.email} className="w-9 h-9 text-xs" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-text font-display">
            {user.name || t('sidebar.profile.candidate')}
          </span>
          <span className="block truncate text-[11px] text-text-muted">
            {user.email}
          </span>
        </span>
        {isPremium && (
          <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-[8px] shadow-sm shrink-0">
            PRO
          </span>
        )}
        <ChevronUp
          className={`w-3.5 h-3.5 shrink-0 text-text-muted stroke-[1.75] transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {isOpen && (
          <m.div
            role="menu"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="absolute bottom-full left-0 mb-2 w-72 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-subtle bg-surface shadow-dialog z-50"
          >
            {/* Cabecera del usuario */}
            <div className="p-4 border-b border-subtle bg-surface-muted/50">
              <div className="flex items-center gap-3">
                <Avatar
                  image={user.image}
                  name={user.name}
                  email={user.email}
                  className="w-11 h-11 text-sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-text font-display">
                    {user.name || t('sidebar.profile.candidate')}
                  </p>
                  <p className="text-[11px] text-text-muted truncate mt-0.5">
                    {user.email}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1 mt-3 px-2 py-0.5 rounded-[8px] text-[9px] uppercase font-bold tracking-wider border ${
                  isPremium
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    : 'bg-text/5 dark:bg-white/5 text-text-muted border-subtle'
                }`}
              >
                {isPremium ? (
                  <Crown className="w-3 h-3 stroke-[1.75]" />
                ) : (
                  <CreditCard className="w-3 h-3 stroke-[1.75]" />
                )}
                {isPremium ? t('sidebar.userMenu.planPro') : t('sidebar.userMenu.planFree')}
              </span>
            </div>

            {/* Navegación */}
            <nav className="p-1.5">
              <Link
                href="/dashboard/profile?tab=profile"
                role="menuitem"
                className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-xs font-semibold text-text hover:bg-surface-muted transition-colors font-display"
              >
                <SlidersHorizontal className="w-4 h-4 stroke-[1.75] text-text-muted" />
                {t('sidebar.userMenu.profile')}
              </Link>
              <Link
                href="/dashboard/profile?tab=integrations"
                role="menuitem"
                className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-xs font-semibold text-text hover:bg-surface-muted transition-colors font-display"
              >
                <Terminal className="w-4 h-4 stroke-[1.75] text-text-muted" />
                {t('sidebar.userMenu.integrations')}
              </Link>
              <Link
                href="/dashboard/subscription"
                role="menuitem"
                className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-xs font-semibold text-text hover:bg-surface-muted transition-colors font-display"
              >
                {isPremium ? (
                  <Crown className="w-4 h-4 stroke-[1.75] text-amber-500" />
                ) : (
                  <CreditCard className="w-4 h-4 stroke-[1.75] text-text-muted" />
                )}
                {t('sidebar.userMenu.subscription')}
              </Link>
              <Link
                href="/dashboard/profile?tab=account"
                role="menuitem"
                className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-xs font-semibold text-text hover:bg-surface-muted transition-colors font-display"
              >
                <UserCircle className="w-4 h-4 stroke-[1.75] text-text-muted" />
                {t('sidebar.userMenu.account')}
              </Link>
              {user.role === 'admin' && (
                <Link
                  href="/admin"
                  role="menuitem"
                  className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-xs font-semibold text-text hover:bg-surface-muted transition-colors font-display"
                >
                  <Shield className="w-4 h-4 stroke-[1.75] text-text-muted" />
                  {t('sidebar.menu.adminPanel')}
                </Link>
              )}
            </nav>

            {/* Cerrar sesión */}
            <div className="border-t border-subtle p-2">
              {confirmLogout ? (
                <div className="flex items-center gap-2 p-1.5">
                  <p className="flex-1 text-[11px] font-bold text-text font-display leading-tight">
                    {t('sidebar.logout.confirm')}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-1.5 px-3 rounded-[8px] text-[10px] transition-all shadow-sm font-display"
                  >
                    {t('sidebar.logout.yes')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmLogout(false)}
                    className="bg-canvas text-text-muted border border-subtle font-bold py-1.5 px-3 rounded-[8px] text-[10px] transition-all font-display"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmLogout(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors font-display"
                >
                  <LogOut className="w-4 h-4 stroke-[1.75]" />
                  {t('sidebar.logout.button')}
                </button>
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
      </LazyMotion>
    </div>
  );
}
