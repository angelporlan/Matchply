import type { Language } from '@/lib/i18n/types';

const copy = {
  es: {
    demo: 'Cómo se adapta un CV en Matchply',
    fallback: 'Ver el vídeo de demostración',
  },
  en: {
    demo: 'How Matchply adapts a CV',
    fallback: 'Watch the demo video',
  },
} satisfies Record<Language, Record<string, string>>;

export default function LandingDemo({ language }: { language: Language }) {
  const text = copy[language];

  return (
    <figure aria-label={text.demo} className="w-full min-w-0 overflow-hidden rounded-[20px] border border-control bg-surface shadow-[0_8px_0_0_var(--surface-muted)]">
      <video
        controls
        playsInline
        preload="none"
        poster="/assets/videos/matchply-demo-v1.jpg"
        width={1920}
        height={1080}
        aria-label={text.demo}
        className="block aspect-video w-full bg-canvas object-contain focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        <source src="/assets/videos/matchply-demo-v1.mp4" type="video/mp4" />
        <a href="/assets/videos/matchply-demo-v1.mp4">{text.fallback}</a>
      </video>
    </figure>
  );
}
