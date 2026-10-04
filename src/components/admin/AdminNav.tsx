'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Bot, CreditCard, FolderOpen, LayoutDashboard, ScrollText, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const ITEMS = [
  { href: '/admin', label: 'Resumen', labelEn: 'Overview', icon: LayoutDashboard, match: (path: string) => path === '/admin' },
  { href: '/admin/users', label: 'Usuarios', labelEn: 'Users', icon: Users, match: (path: string) => path.startsWith('/admin/users') },
  { href: '/admin/ai', label: 'IA', labelEn: 'AI', icon: Bot, match: (path: string) => path.startsWith('/admin/ai') },
  { href: '/admin/plans', label: 'Planes', labelEn: 'Plans', icon: CreditCard, match: (path: string) => path.startsWith('/admin/plans') },
  { href: '/admin/traffic', label: 'Tráfico', labelEn: 'Traffic', icon: Activity, match: (path: string) => path.startsWith('/admin/traffic') },
  { href: '/admin/audit', label: 'Auditoría', labelEn: 'Audit', icon: ScrollText, match: (path: string) => path.startsWith('/admin/audit') },
];

export default function AdminNav({ showGtm = false }: { showGtm?: boolean }) {
  const pathname = usePathname();
  const { t, language } = useLanguage();
  const items = showGtm
    ? [...ITEMS, { href: '/gtm', label: 'GTM local', labelEn: 'Local GTM', icon: FolderOpen, match: (path: string) => path.startsWith('/gtm') }]
    : ITEMS;
  return (
    <nav aria-label={language === 'es' ? 'Administración' : 'Administration'} className="flex gap-1 overflow-x-auto pb-1">
      {items.map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-2 rounded-[8px] px-3 py-2 text-sm font-semibold font-display min-h-[44px] border',
              active
                ? 'bg-surface-muted text-text border-control'
                : 'bg-surface text-text-muted border-subtle hover:text-text',
            )}
          >
            <Icon className="w-4 h-4 stroke-[1.75]" aria-hidden="true" />
            {item.href === '/admin/plans' ? t('plans.adminNav') : language === 'en' ? item.labelEn : item.label}
          </Link>
        );
      })}
    </nav>
  );
}
