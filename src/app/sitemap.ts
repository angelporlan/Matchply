export const dynamic = 'force-dynamic';
import type { MetadataRoute } from 'next';
import { blogArticles, articlePath } from '@/content/blog';
import { publicOrigin } from '@/lib/blog-metadata';
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicOrigin();
  return [{ url: origin, changeFrequency: 'monthly', priority: 1 }, ...(['es', 'en'] as const).map(language => ({ url: `${origin}/blog/${language}`, changeFrequency: 'monthly' as const, priority: 0.8 })), ...blogArticles.map(article => ({ url: `${origin}${articlePath(article)}`, lastModified: new Date(article.reviewedAt), changeFrequency: 'monthly' as const, priority: 0.7 }))];
}
