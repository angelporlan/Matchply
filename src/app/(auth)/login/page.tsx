"use client";

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get('error') === 'CredentialsSignin'
      ? 'CredentialsSignin'
      : null
  );

  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      await signIn('google', { callbackUrl: '/dashboard' });
    } catch (err) {
      setError('unexpected');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError('CredentialsSignin');
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err) {
      setError('unexpected');
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = () => {
    if (!error) return null;
    if (error === 'CredentialsSignin') {
      return t('auth.login.errorInvalidCredentials');
    }
    if (error === 'unexpected') {
      return t('auth.login.errorUnexpected');
    }
    return error;
  };

  return (
    <div className="relative min-h-screen bg-[#FAFAFA] dark:bg-[#0B0F19] flex items-center justify-center p-4 transition-colors duration-300">
      {/* Radial glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#8B5CF6]/3 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#8B5CF6]/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-white dark:bg-[#1F2937] p-8 rounded-xl shadow-[0_4px_20px_-4px_rgba(30,27,75,0.05)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)] border border-[#1E1B4B]/5 dark:border-[#F3F4F6]/5 relative z-10 transition-all duration-300">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="bg-[#8B5CF6]/10 p-2.5 rounded-xl text-[#8B5CF6] shadow-sm">
              <Sparkles className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-[#1E1B4B] dark:text-[#F3F4F6]">
              Matchply
            </span>
          </Link>
          <h2 className="text-2xl font-bold text-[#1E1B4B] dark:text-[#F3F4F6] tracking-tight font-display">{t('auth.login.welcomeBack')}</h2>
          <p className="text-[#1E1B4B]/60 dark:text-[#F3F4F6]/60 text-xs mt-1.5 font-light font-sans">
            {t('auth.login.subtitle')}
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs p-3.5 rounded-lg mb-6 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.75} />
            <span className="font-sans">{getErrorMessage()}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[#1E1B4B] dark:text-[#F3F4F6]/80 text-sm font-medium mb-1.5 font-sans">
              {t('auth.login.emailLabel')}
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-[#1E1B4B]/40 dark:text-[#F3F4F6]/40" strokeWidth={1.75} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.login.emailPlaceholder')}
                className="w-full bg-white dark:bg-[#0B0F19] border border-[#1E1B4B]/10 dark:border-[#F3F4F6]/10 rounded-lg py-3 pl-10 pr-4 text-sm text-[#1E1B4B] dark:text-[#F3F4F6] placeholder-[#1E1B4B]/30 dark:placeholder-[#F3F4F6]/30 focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6] transition-all font-sans"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[#1E1B4B] dark:text-[#F3F4F6]/80 text-sm font-medium font-sans">
                {t('auth.login.passwordLabel')}
              </label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-[#1E1B4B]/40 dark:text-[#F3F4F6]/40" strokeWidth={1.75} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.login.passwordPlaceholder')}
                className="w-full bg-white dark:bg-[#0B0F19] border border-[#1E1B4B]/10 dark:border-[#F3F4F6]/10 rounded-lg py-3 pl-10 pr-4 text-sm text-[#1E1B4B] dark:text-[#F3F4F6] placeholder-[#1E1B4B]/30 dark:placeholder-[#F3F4F6]/30 focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6] transition-all font-sans"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full bg-[#2ECC71] hover:bg-[#27ae60] text-white font-semibold py-3.5 rounded-lg text-sm transition-all shadow-sm shadow-[#2ECC71]/10 hover:shadow-[#2ECC71]/20 flex items-center justify-center gap-2 font-display"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              t('auth.login.submitButton')
            )}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[#1E1B4B]/10 dark:border-[#F3F4F6]/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white dark:bg-[#1F2937] px-3 text-[#1E1B4B]/40 dark:text-[#F3F4F6]/40 font-medium font-sans">{t('auth.login.orContinueWith')}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading || googleLoading}
          className="w-full bg-white dark:bg-[#0B0F19] border border-[#1E1B4B]/10 dark:border-[#F3F4F6]/10 hover:border-[#1E1B4B]/20 dark:hover:border-[#F3F4F6]/20 text-[#1E1B4B]/80 dark:text-[#F3F4F6]/80 hover:text-[#1E1B4B] dark:hover:text-[#F3F4F6] font-semibold py-3.5 rounded-lg text-sm transition-all flex items-center justify-center gap-2.5 font-display"
        >
          {googleLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <span>{t('auth.login.googleButton')}</span>
            </>
          )}
        </button>

        <p className="text-center text-xs text-[#1E1B4B]/60 dark:text-[#F3F4F6]/60 mt-8 font-light font-sans">
          {t('auth.login.noAccountYet')}{' '}
          <Link href="/register" className="text-[#8B5CF6] font-semibold hover:underline">
            {t('auth.login.signUpHere')}
          </Link>
        </p>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
