"use client";

import { useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import Logo from '@/components/ui/Logo';

export default function LogoutPage() {
  useEffect(() => {
    // Automatically trigger sign out upon loading the page
    const performLogout = async () => {
      try {
        await signOut({ callbackUrl: '/' });
      } catch (err) {
        console.error('Error logging out:', err);
      }
    };
    performLogout();
  }, []);

  return (
    <div className="relative min-h-screen bg-canvas flex items-center justify-center p-4 transition-colors duration-300">
      {/* Radial glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-ai/3 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-ai/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-surface p-8 rounded-xl shadow-[0_4px_20px_-4px_rgba(30,27,75,0.05)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)] border border-subtle relative z-10 transition-all duration-300 text-center">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="mb-8 hover:opacity-90 transition-opacity">
            <Logo />
          </div>

          <div className="flex justify-center mb-6">
            <Loader2 className="w-10 h-10 text-ai animate-spin stroke-[1.75]" />
          </div>
          <h2 className="text-lg font-semibold text-text tracking-tight font-display">Cerrando sesión de forma segura...</h2>
          <p className="text-text-muted dark:text-text/60 text-xs mt-2 font-light font-sans max-w-xs leading-relaxed">
            Por favor espera un momento mientras destruimos tu sesión activa y te redirigimos de forma segura.
          </p>
        </div>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
