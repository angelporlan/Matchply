'use client';

import { trackUmamiConversion } from '@/components/analytics/UmamiTracker';
export default function BlogCta({ href, language, children }: { href: string; language: 'es' | 'en'; children: React.ReactNode }) {
  return <a href={href} onClick={() => { document.cookie = `lang=${language}; path=/; max-age=31536000`; trackUmamiConversion('blog_cta_clicked'); }} className="btn-raised inline-flex min-h-11 items-center gap-2">{children}<span aria-hidden="true">→</span></a>;
}
