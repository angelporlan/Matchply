'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Kanban, CreditCard, Crown, LogOut, Shield, FileText, Menu, X } from 'lucide-react';
import { signOut } from 'next-auth/react';
import ThemeToggle from '@/components/ui/ThemeToggle';

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
  isPremium: boolean;
}

export default function Sidebar({ user, isPremium }: SidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    {
      name: 'Mis CVs',
      href: '/dashboard',
      icon: FileText,
    },
    {
      name: 'Kanban',
      href: '/dashboard/kanban',
      icon: Kanban,
    },
    {
      name: 'Suscripción',
      href: '/dashboard/subscription',
      icon: isPremium ? Crown : CreditCard,
      premiumIcon: isPremium,
    },
  ];

  if (user.role === 'admin') {
    menuItems.push({
      name: 'Panel Admin',
      href: '/admin',
      icon: Shield,
    });
  }

  const toggleSidebar = () => setIsOpen(!isOpen);

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  const [showConfirm, setShowConfirm] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut({ callbackUrl: '/' });
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between h-16 px-4 bg-white dark:bg-[#0b0f19] border-b border-[#1e1b4b]/10 dark:border-white/10 w-full sticky top-0 z-40 transition-colors duration-300">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="bg-gradient-to-tr from-[#8b5cf6] to-[#1e1b4b] p-1.5 rounded-lg text-white">
            <Sparkles className="w-4 h-4 stroke-[1.75]" />
          </div>
          <span className="font-display font-bold text-base tracking-tight text-[#1e1b4b] dark:text-white">
            NextProf <span className="text-[#8b5cf6]">AI</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-[8px] border border-[#1e1b4b]/10 dark:border-white/10 text-[#1e1b4b]/70 dark:text-slate-300"
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
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-white dark:bg-[#0b0f19] border-r border-[#1e1b4b]/10 dark:border-white/10 z-50 transition-all duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col justify-between p-6 select-none`}
      >
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="bg-gradient-to-tr from-[#8b5cf6] to-[#1e1b4b] p-2 rounded-xl text-white shadow-sm transition-all duration-300 hover:scale-105 group/logo">
                <Sparkles className="w-5 h-5 stroke-[1.75]" />
              </div>
              <span className="font-display font-bold text-lg tracking-tight text-[#1e1b4b] dark:text-white">
                NextProf <span className="text-[#8b5cf6]">AI</span>
              </span>
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
                  className={`flex items-center gap-3 px-4 py-3 rounded-[8px] text-sm font-semibold transition-all ${
                    active
                      ? 'bg-[#1e1b4b] text-white shadow-sm'
                      : 'text-[#1e1b4b]/70 dark:text-slate-300 hover:text-[#1e1b4b] dark:hover:text-white hover:bg-[#fafafa] dark:hover:bg-[#1f2937]/50'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 stroke-[1.75] ${
                      active
                        ? 'text-white'
                        : item.premiumIcon
                        ? 'text-amber-500'
                        : 'text-[#1e1b4b]/50 dark:text-slate-400'
                    }`}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile & logout */}
        <div className="pt-4 border-t border-[#1e1b4b]/10 dark:border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-[#1e1b4b] dark:text-white truncate">
                {user.name || 'Candidato'}
              </span>
              <span className="block text-[11px] text-[#1e1b4b]/50 dark:text-slate-400 truncate">
                {user.email}
              </span>
            </div>
            {isPremium && (
              <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-[8px] shadow-sm ml-2 shrink-0">
                Pro
              </span>
            )}
          </div>

          <div className="relative">
            {showConfirm && (
              <div className="absolute bottom-full left-0 right-0 mb-3 p-4 bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 rounded-[12px] shadow-xl z-50 animate-fadeIn backdrop-blur-md text-center">
                <p className="text-[11px] font-bold text-[#1e1b4b] dark:text-white mb-2.5 font-display">
                  ¿Estás seguro de cerrar sesión?
                </p>
                <div className="flex items-center gap-2 font-display">
                  <button
                    onClick={handleLogout}
                    className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-1.5 px-3 rounded-[8px] text-[10px] transition-all flex items-center justify-center gap-1 shadow-sm"
                  >
                    Sí, salir
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 bg-[#fafafa] dark:bg-[#0b0f19] hover:bg-[#fafafa]/80 text-[#1e1b4b]/60 dark:text-slate-400 border border-[#1e1b4b]/10 dark:border-white/10 font-bold py-1.5 px-3 rounded-[8px] text-[10px] transition-all flex items-center justify-center"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowConfirm(!showConfirm)}
              className="flex items-center justify-center gap-2 w-full bg-[#fafafa] dark:bg-[#1f2937]/30 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-[#1e1b4b]/60 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-450 border border-[#1e1b4b]/10 dark:border-white/5 font-bold py-2.5 px-4 rounded-[8px] text-xs transition-all shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5 stroke-[1.75]" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
