import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import { cookies } from 'next/headers';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { Language } from '@/lib/i18n/translations';
import { AiPromptDebugProvider } from '@/components/ai/AiPromptDebugContext';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'Matchply | Generador e Inteligencia de Currículums Híbrido',
  description: 'Optimiza tus currículums al instante utilizando IA. Plantilla Harvard con generación PDF en tiempo real.',
  keywords: ['cv', 'curriculum', 'ia', 'deepseek', 'gemini', 'openrouter', 'pdfkit', 'stripe', 'postulaciones'],
  authors: [{ name: 'Matchply Team' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const cookieLang = cookieStore.get('lang')?.value;
  const initialLanguage: Language = (cookieLang === 'es' || cookieLang === 'en') ? cookieLang : 'es';

  const isDebugEnabled =
    process.env.AI_PROMPTS_DEBUG === 'true' ||
    process.env.NEXT_PUBLIC_AI_PROMPTS_DEBUG === 'true';

  return (
    <html lang={initialLanguage} className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var savedTheme = localStorage.getItem('theme');
                if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="bg-canvas text-text min-h-screen">
        <LanguageProvider initialLanguage={initialLanguage}>
          <AiPromptDebugProvider initialDebugEnabled={isDebugEnabled}>
            {children}
          </AiPromptDebugProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
export const dynamic = 'force-dynamic';
