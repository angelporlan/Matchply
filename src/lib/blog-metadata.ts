import type { Metadata } from 'next';
import { articlePath, translatedArticle, type BlogArticle } from '@/content/blog';
export function publicOrigin() { return new URL(process.env.NEXTAUTH_URL || 'https://matchply.com').origin; }
export function blogMetadata(language: 'es' | 'en', article?: BlogArticle): Metadata {
  const path = article ? articlePath(article) : `/blog/${language}`;
  const other = article ? articlePath(translatedArticle(article)) : `/blog/${language === 'es' ? 'en' : 'es'}`;
  const title = article ? `${article.title} | Matchply` : language === 'es' ? 'Blog de empleo, CV e investigación | Matchply' : 'Job search, CVs and research | Matchply Blog';
  const description = article?.summary || (language === 'es' ? 'Estudios sobre búsqueda de empleo explicados con sus límites y consejos para preparar y seguir tus candidaturas.' : 'Job-search research, its limitations and practical advice for preparing and tracking your applications.');
  return { metadataBase: new URL(publicOrigin()), title, description,
    alternates: { canonical: path, languages: { [language]: path, [language === 'es' ? 'en' : 'es']: other, 'x-default': language === 'es' ? path : other } },
    openGraph: { title, description, url: path, siteName: 'Matchply', locale: language === 'es' ? 'es_ES' : 'en_GB', alternateLocale: language === 'es' ? ['en_GB'] : ['es_ES'], type: article ? 'article' : 'website', ...(article ? { publishedTime: article.publishedAt, modifiedTime: article.reviewedAt, authors: ['Equipo Matchply'] } : {}) },
    robots: { index: true, follow: true },
  };
}
