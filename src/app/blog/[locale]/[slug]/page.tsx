import Link from 'next/link';
import { notFound } from 'next/navigation';
import { articlePath, articlesFor, readingMinutes, translatedArticle } from '@/content/blog';
import BlogShell from '@/components/blog/BlogShell';
import BlogCta from '@/components/blog/BlogCta';
import { blogMetadata, publicOrigin } from '@/lib/blog-metadata';
import { getRequestContext } from '@/lib/request-context';

type Props = { params: { locale: string; slug: string } };
function findArticle({ locale, slug }: Props['params']) { return locale === 'es' || locale === 'en' ? articlesFor(locale).find(article => article.slug === slug) : undefined; }
export function generateMetadata({ params }: Props) { const article = findArticle(params); return article ? blogMetadata(article.language, article) : { robots: { index: false } }; }
export default async function BlogPost({ params }: Props) {
  const article = findArticle(params); if (!article) notFound();
  const es = article.language === 'es';
  const ctx = await getRequestContext(); const registered = Boolean(ctx.effectiveUser && !ctx.effectiveUser.isGuest);
  const href = registered ? article.destination : '/try';
  const schema = { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: article.title, description: article.summary, datePublished: article.publishedAt, dateModified: article.reviewedAt, inLanguage: article.language,
    author: { '@type': 'Organization', name: 'Equipo Matchply' }, publisher: { '@type': 'Organization', name: 'Matchply' }, mainEntityOfPage: `${publicOrigin()}${articlePath(article)}`, citation: article.source.url };
  return <BlogShell language={article.language} alternate={articlePath(translatedArticle(article))}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
    <article className="mx-auto max-w-3xl">
      <Link href={`/blog/${article.language}`} className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">← {es ? 'Todos los artículos' : 'All articles'}</Link>
      <h1 className="mt-6 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">{article.title}</h1>
      <p className="mt-6 text-lg leading-8 text-text-muted">{article.summary}</p>
      <p className="mt-5 text-sm leading-6 text-text-muted">Equipo Matchply · {es ? 'Publicado y revisado' : 'Published and reviewed'} <time dateTime={article.reviewedAt}>{new Date(`${article.reviewedAt}T12:00:00Z`).toLocaleDateString(es ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</time> · {readingMinutes(article)} min</p>
      <div className="mt-9 rounded-xl border border-subtle bg-surface p-5 text-sm leading-6"><span className="font-semibold">{es ? 'Fuente principal: ' : 'Primary source: '}</span><a href={article.source.url} className="underline underline-offset-4">{article.source.title}</a></div>
      <div className="mt-10 space-y-10">{article.sections.map(section => <section key={section.title}>
        <h2 className="font-display text-2xl font-semibold leading-8">{section.title}</h2>
        {section.paragraphs.map(paragraph => <p key={paragraph} className="mt-4 text-base leading-8 text-text-muted">{paragraph}</p>)}
        {section.checklist && <ul className="mt-5 list-disc space-y-3 pl-6 leading-7 text-text-muted">{section.checklist.map(item => <li key={item}>{item}</li>)}</ul>}
      </section>)}</div>
      <div className="mt-12 rounded-xl border border-control bg-surface p-6"><p className="mb-5 leading-7">{es ? 'Empieza con tu experiencia y una oferta concreta. Revisa el resultado antes de utilizarlo.' : 'Start with your experience and a specific job. Review the result before using it.'}</p><BlogCta href={href} language={article.language}>{registered ? article.cta : article.guestCta}</BlogCta></div>
      <aside className="mt-12 border-t border-subtle pt-8"><h2 className="font-display text-xl font-semibold">{es ? 'Sigue leyendo' : 'Keep reading'}</h2><ul className="mt-4 space-y-3">{articlesFor(article.language).filter(other => other.id !== article.id).map(other => <li key={other.id}><Link href={articlePath(other)} className="inline-flex min-h-11 items-center underline underline-offset-4">{other.title}</Link></li>)}</ul></aside>
    </article>
  </BlogShell>;
}
