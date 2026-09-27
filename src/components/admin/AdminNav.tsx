'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Bot, FolderOpen, LayoutDashboard, ScrollText, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/admin', label: 'Resumen', icon: LayoutDashboard, match: (path: string) => path === '/admin' },
  { href: '/admin/users', label: 'Usuarios', icon: Users, match: (path: string) => path.startsWith('/admin/users') },
  { href: '/admin/ai', label: 'IA', icon: Bot, match: (path: string) => path.startsWith('/admin/ai') },
  { href: '/admin/traffic', label: 'Tráfico', icon: Activity, match: (path: string) => path.startsWith('/admin/traffic') },
  { href: '/admin/audit', label: 'Auditoría', icon: ScrollText, match: (path: string) => path.startsWith('/admin/audit') },
];

export default function AdminNav({ showGtm = false }: { showGtm?: boolean }) {
  const pathname = usePathname();
  const items = showGtm
    ? [...ITEMS, { href: '/gtm', label: 'GTM local', icon: FolderOpen, match: (path: string) => path.startsWith('/gtm') }]
    : ITEMS;
  return (
    <nav aria-label="Administración" className="flex gap-1 overflow-x-auto pb-1">
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
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
