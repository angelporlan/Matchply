import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
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
  title: 'NextProf AI | Generador e Inteligencia de Currículums Híbrido',
  description: 'Optimiza tus currículums al instante utilizando IA. Soporte de plantillas Harvard, Modern, Minimal, Creative y Swiss con generación PDF en tiempo real.',
  keywords: ['cv', 'curriculum', 'ia', 'deepseek', 'gemini', 'openrouter', 'pdfkit', 'stripe', 'kanban'],
  authors: [{ name: 'NextProf AI Team' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} ${outfit.variable}`}>
      <body className="bg-[#030712] text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
export const dynamic = 'force-dynamic';
