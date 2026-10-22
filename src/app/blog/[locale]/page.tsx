import Link from 'next/link';
import { notFound } from 'next/navigation';
import { articlesFor, articlePath, readingMinutes } from '@/content/blog';
import BlogShell from '@/components/blog/BlogShell';
import { blogMetadata } from '@/lib/blog-metadata';

export function generateMetadata({ params }: { params: { locale: string } }) { return params.locale === 'es' || params.locale === 'en' ? blogMetadata(params.locale) : {}; }
export default function BlogIndex({ params }: { params: { locale: string } }) {
  if (params.locale !== 'es' && params.locale !== 'en') notFound();
  const language = params.locale; const es = language === 'es';
  return <BlogShell language={language} alternate={`/blog/${es ? 'en' : 'es'}`}>
    <p className="text-sm font-semibold text-ai-text">{es ? 'Investigación y búsqueda de empleo' : 'Research and job searching'}</p>
    <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">{es ? 'Decisiones mejor informadas para tu próxima candidatura.' : 'Better-informed decisions for your next application.'}</h1>
    <p className="mt-6 max-w-2xl text-lg leading-8 text-text-muted">{es ? 'Qué dicen los estudios, qué no demuestran y cómo puedes aplicar sus enseñanzas con Matchply.' : 'What research says, what it cannot prove and how to apply its lessons with Matchply.'}</p>
    <div className="mt-12 grid gap-6 md:grid-cols-2">{articlesFor(language).map((article, i) => <article key={article.id} className="flex flex-col rounded-xl border border-subtle bg-surface p-6 sm:p-8">
      <p className="text-sm text-text-muted">0{i + 1} · {readingMinutes(article)} {es ? 'min de lectura' : 'min read'}</p>
      <h2 className="mt-4 font-display text-2xl font-semibold leading-8"><Link href={articlePath(article)} className="hover:underline">{article.title}</Link></h2>
      <p className="my-5 leading-7 text-text-muted">{article.summary}</p>
      <Link href={articlePath(article)} className="mt-auto inline-flex min-h-11 items-center gap-2 font-semibold underline underline-offset-4">{es ? 'Leer artículo' : 'Read article'}<span aria-hidden="true">→</span></Link>
    </article>)}</div>
  </BlogShell>;
}
