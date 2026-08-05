import Link from 'next/link';
import Logo from '@/components/ui/Logo';

type LegalPageProps = {
  title: string;
  intro: string;
  sections: Array<{ title: string; body: string }>;
};

export default function LegalPage({ title, intro, sections }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-[#fafafa] px-4 py-10 text-[#1e1b4b] dark:bg-[#0b0f19] dark:text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/" aria-label="Matchply">
          <Logo iconSize="sm" textSize="md" />
        </Link>
        <article className="mt-12 rounded-2xl border border-[#1e1b4b]/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#151b28] sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8b5cf6]">Matchply</p>
          <h1 className="mt-4 font-display text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-5 text-base leading-7 text-[#1e1b4b]/70 dark:text-slate-300">{intro}</p>
          <div className="mt-10 space-y-8">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="font-display text-lg font-extrabold">{section.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[#1e1b4b]/70 dark:text-slate-300">{section.body}</p>
              </section>
            ))}
          </div>
          <p className="mt-10 border-t border-[#1e1b4b]/10 pt-6 text-sm text-[#1e1b4b]/65 dark:border-white/10 dark:text-slate-400">
            ¿Necesitas ayuda? <a className="font-bold text-[#7c3aed] hover:underline" href="mailto:soporte@matchply.com">soporte@matchply.com</a>
          </p>
        </article>
      </div>
    </main>
  );
}
