export const dynamic = 'force-dynamic';
import type { MetadataRoute } from 'next';
import { publicOrigin } from '@/lib/blog-metadata';
export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/dashboard', '/editor', '/auth/', '/account/', '/login', '/register', '/try'] }, sitemap: `${publicOrigin()}/sitemap.xml` }; }
