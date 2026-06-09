'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useReducedMotion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

// Exact y-axis wave offsets from the user's design
const waveOffsets = [
  29.36, 34.08, 34.75, 31.28, 24.08, 14.01, 2.27, -9.73, -20.58, -28.98,
  -33.92, -34.82, -31.58, -24.57, -14.63, -2.95, 9.07, 20.02, 28.59, 33.75,
  34.89, 31.87
];

const platforms = [
  { id: 'linkedin', name: 'LinkedIn' },
  { id: 'infojobs', name: 'InfoJobs' },
  { id: 'indeed', name: 'Indeed' },
  { id: 'glassdoor', name: 'Glassdoor' },
  { id: 'tecnoempleo', name: 'Tecnoempleo' },
  { id: 'jobsora', name: 'Jobsora' },
  { id: 'upwork', name: 'Upwork' },
  { id: 'fiverr', name: 'Fiverr' },
  { id: 'stepstone', name: 'StepStone' },
  { id: 'jooble', name: 'Jooble' }
];

const marqueeItems = [
  ...platforms, ...platforms, ...platforms, ...platforms
];

// Custom SVGs for job platforms
function PlatformIcon({ id }: { id: string }) {
  switch (id) {
    case 'linkedin':
      return (
        <svg className="w-8 h-8 text-[#0a66c2] fill-current" viewBox="0 0 24 24">
          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
        </svg>
      );
    case 'infojobs':
      return (
        <svg className="w-8 h-8" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" rx="22" fill="#1b75bb" />
          <path d="M39.5 27.5H50L40.5 70H30L39.5 27.5z" fill="white" />
          <path d="M60 27.5H70.5L62.2 65.3c-.8 3.6-2.5 6-5.8 7.2-2.5 1-5.5 1-8.2.3l1-8c1.5.4 3 .4 4-.1 1.2-.6 1.8-1.7 2.1-3.2L60 27.5z" fill="white" />
        </svg>
      );
    case 'indeed':
      return (
        <svg className="w-8 h-8" viewBox="0 0 245.6 356.7" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g transform="matrix(1.3333333,0,0,-1.3333333,0,356.70667)">
            <g transform="scale(0.1)">
              <path
                fill="#003A9B"
                d="M872.8,271.9v976.4c28.5-2.5,55.7-3.8,84.2-3.8c135.8,0,263.7,35.8,372.3,99.5v-1072 c0-91.5-21.8-159.2-63.8-204.4c-42-45-97.9-67.5-165.8-67.5c-66.6,0-119.6,22.5-163.1,68.8C894.6,114,872.8,181.8,872.8,271.9"
              />
              <path
                fill="#003A9B"
                d="M875.4,2612.2c282.6,99.6,604.6,94.3,846.4-110c45-41.1,96.5-92.9,116.9-153.9 c24.5-76.9-85.5,8.1-100.6,18.5c-78.8,50.5-157.6,92.9-245.8,122.2c-475.5,143.2-925.4-115.5-1205.1-517.5 c-116.8-177.8-193-364.7-255.5-570.4c-6.7-22.7-12.2-51.9-24.6-71.6c-12.2-22.8-5.4,60.8-5.4,63.6c9.4,84.8,27.2,167.1,49,249.4 C179.9,2080.3,465.1,2445.1,875.4,2612.2"
              />
              <path
                fill="#003A9B"
                d="M1243.7,1525.7c-169.8-84.9-377.8-18.7-463.4,147.2c-87,165.9-18.9,368.8,150.8,452.4 c169.9,84.9,377.9,18.6,463.4-147.3C1481.5,1812.2,1413.6,1609.2,1243.7,1525.7"
              />
            </g>
          </g>
        </svg>
      );
    case 'glassdoor':
      return (
        <svg className="w-8 h-8" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Left shape (g) */}
          <path
            d="M 20 38 H 48 V 66 C 48 77, 39 86, 28 86 H 20 V 74 H 32 C 34.5 74, 36 70.5, 36 66 H 20 V 38 Z"
            fill="#00A265"
          />
          {/* Right shape (d) - rotated 180 deg around center (50, 50) */}
          <path
            d="M 20 38 H 48 V 66 C 48 77, 39 86, 28 86 H 20 V 74 H 32 C 34.5 74, 36 70.5, 36 66 H 20 V 38 Z"
            fill="#00A265"
            transform="rotate(180 50 50)"
          />
        </svg>
      );
    case 'tecnoempleo':
      return (
        <svg className="w-8 h-8" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <text
            x="48"
            y="69"
            fill="#317fc0"
            fontSize="64"
            fontWeight="bold"
            fontStyle="italic"
            fontFamily='system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
            textAnchor="middle"
            letterSpacing="-2"
          >
            te
          </text>
        </svg>
      );
    case 'jobsora':
      return (
        <svg className="w-8 h-8" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Purple rounded square background */}
          <rect width="100" height="100" rx="22" fill="#9862c2" />
          {/* Slanted tail (pill) */}
          <rect x="62" y="57" width="14" height="24" rx="7" fill="white" transform="rotate(45 69 69)" />
          {/* Circular ring */}
          <path
            d="M 49 21 A 28 28 0 1 0 49 77 A 28 28 0 1 0 49 21 Z M 49 33 A 16 16 0 1 1 49 65 A 16 16 0 1 1 49 33 Z"
            fill="white"
            fillRule="evenodd"
          />
        </svg>
      );
    case 'domestika':
      return (
        <svg className="w-8 h-8" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="45" fill="#ff4b4b" />
          <path d="M38 30 H48 V48 C52 42, 58 40, 64 40 C74 40, 82 48, 82 60 C82 72, 74 80, 64 80 C58 80, 52 78, 48 72 V80 H38 V30 Z M48 60 C48 66, 52 70, 58 70 C64 70, 68 66, 68 60 C68 54, 64 50, 58 50 C52 50, 48 54, 48 60 Z" fill="white" fillRule="evenodd" />
        </svg>
      );
    case 'upwork':
      return (
        <svg className="w-8 h-8" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Green rounded square background */}
          <rect width="100" height="100" rx="22" fill="#6ed943" />
          {/* White symbol centered and scaled */}
          <path
            d="M16 6v7.5c0 1.9 1.1 3 3 3s3-1.1 3-3V6h3v7.5c0 3.6-2.4 6-6 6s-6-2.4-6-6V6h3zM8 6v7.5c0 .8-.5 1.5-1.5 1.5S5 14.3 5 13.5V6H2v7.5C2 16.5 4.1 19 7 19s5-2.5 5-5.5V6H8z"
            fill="white"
            transform="translate(9.5, 11.75) scale(3.0)"
          />
        </svg>
      );
    case 'fiverr':
      return (
        <svg className="w-8 h-8 text-[#1dbf73] fill-current" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="11" />
          <text x="12" y="17.5" fill="white" fontSize="13" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">fi</text>
        </svg>
      );
    case 'stepstone':
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" fill="#003554" />
          <path d="M7 16.5h10V14.5H7v2zm0-4h10v-2H7v2zm0-4h10v-2H7v2z" fill="#FFC72C" />
        </svg>
      );
    case 'jooble':
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round">
          <circle cx="8" cy="12" r="5" stroke="#0044bb" />
          <circle cx="16" cy="12" r="5" stroke="#ff8800" />
        </svg>
      );
    default:
      return null;
  }
}

export default function AgentFirstEffect() {
  const { t } = useLanguage();
  const shouldReduceMotion = useReducedMotion();
  const textToType = t('landing.agentEffect.text');
  const [displayedText, setDisplayedText] = useState('');
  const [ref, inView] = useInView({ threshold: 0.1 });
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasTypedRef = useRef(false);

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayedText(textToType);
      hasTypedRef.current = true;
      return;
    }

    if (!inView || hasTypedRef.current) return;

    setDisplayedText('');
    let currentLength = 0;

    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
    }

    typingTimerRef.current = setInterval(() => {
      currentLength++;
      setDisplayedText(textToType.slice(0, currentLength));
      if (currentLength >= textToType.length) {
        hasTypedRef.current = true;
        if (typingTimerRef.current) {
          clearInterval(typingTimerRef.current);
        }
      }
    }, 45);

    return () => {
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
      }
    };
  }, [inView, shouldReduceMotion, textToType]);

  return (
    <section
      ref={ref}
      className="w-full py-20 overflow-hidden bg-slate-50/20 dark:bg-[#0b0f19]/30 border-y border-[#1e1b4b]/5 dark:border-white/5 relative z-10 transition-colors duration-300"
    >
      {/* 3D Wave Icon Marquee */}
      <div className="w-full overflow-hidden relative select-none pb-16 pt-24 mask-fade-edges">
        <ul className={`${inView && !shouldReduceMotion ? 'animate-wave-marquee' : ''} flex items-center gap-6 md:gap-8 list-none m-0 p-0 w-max`}>
          {marqueeItems.map((platform, idx) => {
            const offsetIndex = idx % waveOffsets.length;
            const offsetY = waveOffsets[offsetIndex];

            return (
              <li
                key={`${platform.id}-${idx}`}
                className="flex-shrink-0"
                style={{
                  transform: `translate3d(0, ${offsetY}px, 0)`,
                  transition: 'transform 0.5s ease-out',
                }}
              >
                <div
                  className="bouncer relative group flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full bg-white dark:bg-slate-800/90 border border-slate-200/50 dark:border-slate-700/50 shadow-sm transition-all duration-300 hover:scale-110 hover:border-[#8b5cf6]/40 dark:hover:border-emerald-400/40"
                  style={{
                    animationDelay: `${idx * 0.15}s`,
                  }}
                >
                  {/* Visually stunning hover tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 bg-slate-900/95 dark:bg-white text-white dark:text-slate-900 text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 pointer-events-none whitespace-nowrap z-[9999] border border-white/10 dark:border-slate-200/20 font-display">
                    {platform.name}
                    {/* Downward pointing triangle arrow */}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-900/95 dark:border-t-white" />
                  </div>

                  <PlatformIcon id={platform.id} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Typing Text Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mt-6">
        <div className="flex justify-center items-center">
          <div className="inline-block relative max-w-4xl text-lg sm:text-2xl font-display font-medium text-slate-800 dark:text-slate-200 tracking-tight leading-relaxed min-h-[4rem] px-6 py-4 bg-white/70 dark:bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-200/40 dark:border-slate-800/40 shadow-xl shadow-slate-100/50 dark:shadow-none">
            <span>{displayedText}</span>
            <span
              className="inline-block w-2.5 h-6 bg-[#8b5cf6] dark:bg-emerald-400 ml-1 rounded-sm align-middle animate-blink"
              style={{
                boxShadow: '0 0 10px rgba(139, 92, 246, 0.5)',
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
