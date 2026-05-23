"use client";

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, LogOut, ArrowLeft, Loader2 } from 'lucide-react';

export default function LogoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut({ callbackUrl: '/' });
    } catch (err) {
      console.error('Error logging out:', err);
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#030712] flex items-center justify-center p-4 overflow-hidden">
      {/* Radial glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-sky-950/20 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-950/20 blur-[100px] pointer-events-none" />

      {/* Decorative background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f29370a_1px,transparent_1px),linear-gradient(to_bottom,#1f29370a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <div className="w-full max-w-md glass-card p-8 rounded-3xl glow-primary relative z-10 border border-slate-800 text-center">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 hover:opacity-90 transition-opacity">
            <div className="bg-gradient-to-tr from-sky-400 to-indigo-500 p-2 rounded-xl text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-white">
              NextProf <span className="text-sky-400">AI</span>
            </span>
          </Link>

          {/* Animated LogOut Icon container */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-rose-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative w-20 h-20 bg-rose-500/10 border-2 border-rose-500/20 hover:border-rose-500/40 text-rose-400 rounded-full flex items-center justify-center transition-colors group">
              <LogOut className="w-8 h-8 group-hover:scale-110 transition-transform duration-300" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white tracking-tight">¿Cerrar sesión?</h2>
          <p className="text-slate-400 text-xs mt-2.5 font-light max-w-xs leading-relaxed">
            Estás a punto de salir de tu cuenta. Todo tu progreso, currículums y postulaciones se guardan automáticamente.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <Loader2 className="w-10 h-10 text-sky-400 animate-spin" />
            </div>
            <p className="text-sm font-medium text-slate-350 animate-pulse">
              Cerrando tu sesión de forma segura...
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={handleLogout}
              disabled={loading}
              className="w-full bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-400 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-md shadow-rose-500/10 hover:shadow-rose-500/25 flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sí, cerrar sesión
            </button>

            <button
              onClick={() => router.back()}
              disabled={loading}
              className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-semibold py-3.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Cancelar y volver
            </button>
          </div>
        )}

        <p className="text-center text-[10px] text-slate-500 mt-8 font-light">
          NextProf AI &copy; {new Date().getFullYear()} &bull; Tu carrera profesional impulsada por IA
        </p>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
