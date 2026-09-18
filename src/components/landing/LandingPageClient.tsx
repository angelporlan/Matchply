'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { LazyMotion, m, domAnimation, useReducedMotion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Sparkles, FileText, CheckCircle, ArrowRight, ChevronRight, ChevronLeft } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LandingHeader from '@/components/landing/LandingHeader';
import AgentFirstEffect from '@/components/landing/AgentFirstEffect';
import Logo from '@/components/ui/Logo';
import { ButtonLink } from '@/components/ui/Button';

// ----------------------------------------------------
// Sub-component: Interactive Particles/Grid Canvas
// ----------------------------------------------------
function useIsNarrowViewport(breakpoint = 768) {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsNarrow(media.matches);

    update();
    media.addEventListener('change', update);

    return () => media.removeEventListener('change', update);
  }, [breakpoint]);

  return isNarrow;
}
export function ParticlesCanvas({ disabled = false }: { disabled?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (disabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId = 0;
    let lastFrameTime = 0;
    let isVisible = true;
    let dpr = 1;
    let particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
    }> = [];

    const colors = [
      'rgba(139, 92, 246, 0.65)',   // purple
      'rgba(46, 204, 113, 0.65)',   // green esmeralda
      'rgba(143, 132, 248, 0.65)',  // light violet
    ];

    let mouse = { x: -1000, y: -1000, active: false };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.x = -1000;
      mouse.y = -1000;
    };

    const handleResize = () => {
      const parentWidth = canvas.parentElement?.clientWidth || window.innerWidth;
      const parentHeight = canvas.parentElement?.clientHeight || 650;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      canvas.width = Math.floor(parentWidth * dpr);
      canvas.height = Math.floor(parentHeight * dpr);
      canvas.style.width = `${parentWidth}px`;
      canvas.style.height = `${parentHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const count = Math.min(Math.floor((width * height) / 18000), 45);
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.45,
          vy: (Math.random() - 0.5) * 0.45,
          radius: Math.random() * 3 + 1.5,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    };

    const renderFrame = (timestamp: number) => {
      animationFrameId = requestAnimationFrame(renderFrame);

      if (!isVisible || document.hidden || timestamp - lastFrameTime < 33) {
        return;
      }

      lastFrameTime = timestamp;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.clearRect(0, 0, width, height);

      // Draw connection lines between particles
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (dist < 140) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(139, 92, 246, ${0.16 * (1 - dist / 140)})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // Draw & Update particles, apply mouse repulsion and draw cursor lines
      particles.forEach((p) => {
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 140) {
            // Repulsion force
            const force = (140 - dist) / 140;
            const angle = Math.atan2(dy, dx);
            p.x += Math.cos(angle) * force * 3;
            p.y += Math.sin(angle) * force * 3;

            // Draw line from mouse to particle
            ctx.beginPath();
            ctx.strokeStyle = `rgba(139, 92, 246, ${0.22 * (1 - dist / 140)})`;
            ctx.lineWidth = 0.95;
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 4;
        ctx.shadowColor = p.color;
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;

        // bounce off edges
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
      });
    };

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.05 }
    );

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    visibilityObserver.observe(canvas);
    handleResize();
    animationFrameId = requestAnimationFrame(renderFrame);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      visibilityObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, [disabled]);

  if (disabled) return null;

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none opacity-70 dark:opacity-85 z-0" />;
}

// ----------------------------------------------------
// Sub-component: Scroll-revealing Character Stagger Text
// ----------------------------------------------------
function FeatureDescription({ text }: { text: string }) {
  const shouldReduceMotion = useReducedMotion();
  const words = text.split(' ');

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.035,
      },
    },
  };

  const wordVariants = {
    hidden: { opacity: 0.15 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.28,
        ease: "easeOut" as any,
      },
    },
  };

  if (shouldReduceMotion) {
    return <>{text}</>;
  }

  return (
    <m.span
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      className="inline-block"
      aria-label={text}
    >
      {words.map((word, wordIdx) => (
        <m.span
          key={wordIdx}
          variants={wordVariants}
          className="inline-block whitespace-nowrap mr-[0.25em]"
          aria-hidden="true"
        >
          {word}
        </m.span>
      ))}
    </m.span>
  );
}

// ----------------------------------------------------
// Sub-component: Animated Count-up Numbers
// ----------------------------------------------------
export function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1500,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}) {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;

    let startTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const currentVal = progress * value;
      setCount(currentVal);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  }, [inView, value, duration]);

  const formatted = count.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return <span ref={ref}>{prefix}{formatted}{suffix}</span>;
}

// ----------------------------------------------------
// Sub-component: Card with Radial Cursor Glow Hover
// ----------------------------------------------------
export function FeatureCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const shouldReduceMotion = useReducedMotion();
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shouldReduceMotion) return;

    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden transition-all duration-300 ${className}`}
      style={{
        background: isHovered && !shouldReduceMotion
          ? `radial-gradient(300px circle at ${coords.x}px ${coords.y}px, rgba(139, 92, 246, 0.09), transparent 85%)`
          : undefined,
      }}
    >
      {/* Dynamic border highlighting cursor */}
      {isHovered && !shouldReduceMotion && (
        <div
          className="absolute pointer-events-none rounded-[12px] border border-ai/20 transition-opacity duration-300"
          style={{
            inset: 0,
            maskImage: `radial-gradient(150px circle at ${coords.x}px ${coords.y}px, black, transparent)`,
            WebkitMaskImage: `radial-gradient(150px circle at ${coords.x}px ${coords.y}px, black, transparent)`,
          }}
        />
      )}
      {children}
    </div>
  );
}

// ----------------------------------------------------
// Sub-component: 3D Flip Card for Templates
// ----------------------------------------------------
export function TemplateFlipCard({
  title,
  badgeText,
  badgeColorClass,
  desc,
  ctaText,
  imagePath,
  session,
  t,
}: {
  title: string;
  badgeText: string;
  badgeColorClass: string;
  desc: string;
  ctaText: string;
  imagePath: string;
  session: any;
  t: any;
}) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className="perspective-1000 w-full h-[380px] cursor-pointer group"
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div
        className="preserve-3d duration-700 ease-in-out relative w-full h-full"
        style={{
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >

        {/* Front Face */}
        <div className="backface-hidden absolute inset-0 bg-surface p-6 rounded-[12px] border border-subtle flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300">
          <div>
            <div className={`p-2 py-1 rounded-[8px] border text-[11px] font-bold font-display w-fit mb-4 ${badgeColorClass}`}>
              {badgeText}
            </div>
            <h4 className="text-xl font-bold font-display text-text mb-2">{title}</h4>
            <p className="text-text-muted text-xs font-light leading-relaxed">
              {desc}
            </p>
          </div>

          {/* Decorative mini layout of the CV inside card */}
          <div className="border-t border-subtle pt-4 flex flex-col gap-2 opacity-50 group-hover:opacity-85 transition-opacity">
            <div className="h-1.5 w-full bg-subtle dark:bg-slate-700 rounded-sm" />
            <div className="h-1.5 w-5/6 bg-subtle dark:bg-slate-700 rounded-sm" />
            <div className="h-1.5 w-4/6 bg-subtle dark:bg-slate-700 rounded-sm" />
            <div className="flex gap-1.5 mt-1 items-center">
              <div className="h-3 w-3 rounded-full bg-ai/30" />
              <div className="h-1.5 w-12 bg-action/25 rounded-sm" />
            </div>
          </div>

          <div className="mt-4 text-ai text-xs font-bold flex items-center gap-1 font-display">
            {ctaText} <ChevronRight className="w-3.5 h-3.5 stroke-[1.75] group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Back Face (CV Visual) */}
        <div className="backface-hidden rotate-y-180 absolute inset-0 bg-[#1e1b4b] dark:bg-canvas rounded-[12px] border border-ai/40 overflow-hidden shadow-lg shadow-ai/10">
          <img
            src={imagePath}
            alt={title}
            loading="lazy"
            fetchPriority="low"
            className="w-full h-full object-cover object-top opacity-90 group-hover:scale-105 transition-transform duration-700"
          />
          {/* Overlay containing "Use This Template" Action */}
          <div className="absolute inset-0 bg-gradient-to-t from-canvas/95 via-canvas/35 to-transparent flex flex-col justify-end p-5">
            <h5 className="text-white font-bold font-display text-sm mb-1">{title} Template</h5>
            <p className="text-slate-300 text-[10px] font-light mb-3 leading-tight">{desc.substring(0, 50)}...</p>
            <Link
              href={session ? "/dashboard" : "/try"}
              className="w-full bg-ai-action hover:bg-ai-hover text-on-ai-action text-center font-bold py-2.5 rounded-[8px] text-[11px] transition-all shadow-md shadow-ai/20 font-display flex items-center justify-center gap-1"
            >
              {t('landing.hero.primaryCta')} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}

// ----------------------------------------------------
// Sub-component: Mini IDE Real-Time Compiler Mockup
// ----------------------------------------------------
export function MiniEditorMockup() {
  const lines = [
    "# Fernando González",
    "## Experiencia",
    "* Admin Contable",
    "  - Logro: Reduje 12% costes"
  ];

  const [typedLines, setTypedLines] = useState<string[]>(["", "", "", ""]);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [compiling, setCompiling] = useState(false);
  const [pdfVisibleCount, setPdfVisibleCount] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    // Reset loop
    if (activeLineIdx >= lines.length) {
      timer = setTimeout(() => {
        setTypedLines(["", "", "", ""]);
        setActiveLineIdx(0);
        setCharIdx(0);
        setPdfVisibleCount(0);
        setCompiling(false);
      }, 3500); // Hold final state before reset
      return () => clearTimeout(timer);
    }

    const currentLineText = lines[activeLineIdx];

    if (charIdx < currentLineText.length) {
      // Type next character
      timer = setTimeout(() => {
        setTypedLines(prev => {
          const next = [...prev];
          next[activeLineIdx] = currentLineText.slice(0, charIdx + 1);
          return next;
        });
        setCharIdx(prev => prev + 1);
      }, 45); // Typing speed
    } else {
      // Line finished typing. Trigger compile.
      setCompiling(true);
      timer = setTimeout(() => {
        setCompiling(false);
        setPdfVisibleCount(prev => prev + 1);
        // Move to next line
        setActiveLineIdx(prev => prev + 1);
        setCharIdx(0);
      }, 900); // Compilation delay
    }

    return () => clearTimeout(timer);
  }, [activeLineIdx, charIdx]);

  return (
    <div className="w-full bg-white dark:bg-canvas/95 border border-slate-200 dark:border-white/10 rounded-xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col h-40 sm:h-56 relative font-mono text-[7px] sm:text-[9px] select-none transition-colors duration-300">
      {/* 1. Header Bar */}
      <div className="h-7 sm:h-9 bg-surface-muted dark:bg-surface/50 border-b border-slate-200 dark:border-white/5 flex items-center px-2.5 sm:px-4 justify-between select-none">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#ff5f56] opacity-90" />
          <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#ffbd2e] opacity-90" />
          <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#27c93f] opacity-90" />
        </div>
        
        {/* Document Tab */}
        <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-surface-muted dark:bg-canvas/80 rounded-t-lg border-t border-x border-slate-200 dark:border-white/5 text-[6.5px] sm:text-[8.5px] font-sans font-bold text-slate-700 dark:text-slate-300 relative top-[3.5px] sm:top-[4.5px]">
          <FileText className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-indigo-500 dark:text-ai" />
          <span>fernando_cv.md</span>
        </div>
        
        <div className="hidden sm:block text-[7.5px] text-slate-400 dark:text-text-muted font-sans font-semibold uppercase tracking-wider">
          Markdown
        </div>
      </div>

      {/* 2. Main Workspace */}
      <div className="flex flex-1 h-[calc(100%-64px)] overflow-hidden">
        {/* Left Panel: Markdown Editor */}
        <div className="w-1/2 bg-surface-muted/50 dark:bg-canvas/50 border-r border-slate-200/80 dark:border-white/5 p-2 sm:p-3 flex gap-1.5 sm:gap-2 text-left relative overflow-y-auto scrollbar-none">
          {/* Line Numbers */}
          <div className="flex flex-col text-slate-400 dark:text-slate-600 text-right select-none text-[6.5px] sm:text-[8.5px] gap-[3px] sm:gap-[4.5px] pr-1 border-r border-slate-200 dark:border-white/5">
            <div>1</div>
            <div>2</div>
            <div>3</div>
            <div>4</div>
            <div>5</div>
          </div>

          {/* Lines editor content */}
          <div className="flex flex-col gap-[3px] sm:gap-[4.5px] flex-1 text-[6.5px] sm:text-[8.5px] pl-1">
            {/* Line 1 */}
            <div className="text-indigo-600 dark:text-ai font-bold min-h-[12px] flex items-center">
              <span>{typedLines[0]}</span>
              {activeLineIdx === 0 && (
                <m.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="w-1 h-3 bg-indigo-500 dark:bg-ai-action ml-0.5"
                />
              )}
            </div>

            {/* Line 2 */}
            <div className="text-slate-700 dark:text-slate-300 font-semibold min-h-[12px] flex items-center">
              <span>{typedLines[1]}</span>
              {activeLineIdx === 1 && (
                <m.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="w-1 h-3 bg-indigo-500 dark:bg-ai-action ml-0.5"
                />
              )}
            </div>

            {/* Line 3 */}
            <div className="text-slate-600 dark:text-emerald-400 font-medium min-h-[12px] flex items-center">
              <span>{typedLines[2]}</span>
              {activeLineIdx === 2 && (
                <m.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="w-1 h-3 bg-indigo-500 dark:bg-emerald-400 ml-0.5"
                />
              )}
            </div>

            {/* Line 4 */}
            <div className="text-slate-500 dark:text-text-muted pl-2 min-h-[12px] flex items-center">
              <span>{typedLines[3]}</span>
              {activeLineIdx === 3 && (
                <m.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="w-1 h-3 bg-indigo-500 dark:bg-emerald-400 ml-0.5"
                />
              )}
            </div>

            {/* Cursor on next lines */}
            {activeLineIdx >= 4 && (
              <div className="min-h-[12px] flex items-center">
                <m.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="w-1 h-3 bg-indigo-500 dark:bg-ai-action ml-0.5"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Simulated PDF (Always Real-Looking White Paper with Premium Shadow) */}
        <div className="w-1/2 bg-surface-muted dark:bg-[#080b16] p-2 sm:p-3 flex items-center justify-center relative">
          <div className="w-[86px] h-[96px] sm:w-[125px] sm:h-[135px] bg-white text-slate-800 rounded-md shadow-md border border-slate-200/60 p-1.5 sm:p-2.5 flex flex-col gap-1 sm:gap-1.5 relative overflow-hidden select-none">
            {/* Header Element */}
            {pdfVisibleCount >= 1 ? (
              <m.div
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-0.5 border-b border-slate-100 pb-1"
              >
                <div className="text-[6.5px] font-black text-indigo-700 tracking-tight leading-none">
                  Fernando González
                </div>
                <div className="text-[4px] text-slate-400 leading-none">
                  fernando@email.com • Madrid, ES
                </div>
              </m.div>
            ) : (
              <div className="h-6 flex items-center justify-center border border-dashed border-slate-100 rounded text-[6px] text-slate-300">
                Esperando cabecera...
              </div>
            )}

            {/* Experience Title Element */}
            {pdfVisibleCount >= 2 && (
              <m.div
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-0.5"
              >
                <div className="text-[4.5px] font-bold text-slate-500 tracking-wider uppercase leading-none">
                  Experiencia Profesional
                </div>
              </m.div>
            )}

            {/* Job Title Line */}
            {pdfVisibleCount >= 3 && (
              <m.div
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-0.5 pl-0.5"
              >
                <div className="text-[5px] font-black text-slate-700 leading-none">
                  Admin Contable
                </div>
                <div className="text-[4px] text-slate-400 leading-none">
                  ABC Consulting SA • 2022 - Presente
                </div>
              </m.div>
            )}

            {/* AI optimized achievement Bullet Highlight */}
            {pdfVisibleCount >= 4 && (
              <m.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="bg-emerald-50 border border-emerald-200/80 text-emerald-800 rounded px-1.5 py-1 text-[4.5px] font-medium leading-relaxed shadow-sm relative overflow-hidden"
              >
                <div className="font-extrabold text-emerald-700 flex items-center gap-0.5 mb-0.5 text-[4.2px]">
                  <Sparkles className="w-1.5 h-1.5 text-emerald-600 animate-pulse" />
                  <span>Logro Optimizado por IA</span>
                </div>
                Reduje un 12% en costes operativos automatizando conciliaciones bancarias.
                {/* Glowing light shimmer */}
                <m.div
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none"
                />
              </m.div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Status Footer Bar */}
      <div className="h-7 bg-surface-muted dark:bg-surface/40 border-t border-slate-200 dark:border-white/5 flex items-center justify-between px-4 py-1 text-[8.5px] font-sans font-medium text-slate-500 dark:text-text-muted select-none">
        <div className="flex items-center gap-1.5">
          {compiling ? (
            <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400">
              <Sparkles className="w-2.5 h-2.5 animate-spin" />
              <span>Compilando cambios...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span>PDF Listo</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span>Pág: 1 / 1</span>
          <span className="w-px h-2.5 bg-subtle dark:bg-white/10" />
          <span>A4 Harvard</span>
        </div>
      </div>
    </div>
  );
}

interface LandingApplicationCard {
  id: string;
  title: string;
  company: string;
  template: string;
  status: string;
  info?: string;
  accepted?: boolean;
}

// ----------------------------------------------------
// MAIN: LandingPageClient Component
// ----------------------------------------------------
export default function LandingPageClient({ session }: { session: any }) {
  const { t } = useLanguage();
  const shouldReduceMotion = useReducedMotion();
  const isNarrowViewport = useIsNarrowViewport();
  const shouldUseLightMotion = shouldReduceMotion || isNarrowViewport;

  const part1Text = t('landing.hero.titleBefore');
  const part2Text = t('landing.hero.titleHighlight');
  const part3Text = t('landing.hero.titleAfter');
  const headlineText = `${part1Text}${part2Text}${part3Text}`;
  const part1End = part1Text.length;
  const part2End = part1End + part2Text.length;
  const [visibleHeadlineLength, setVisibleHeadlineLength] = useState(headlineText.length);
  const visiblePart1 = headlineText.slice(0, Math.min(visibleHeadlineLength, part1End));
  const visiblePart2 = headlineText.slice(part1End, Math.min(visibleHeadlineLength, part2End));
  const visiblePart3 = headlineText.slice(part2End, visibleHeadlineLength);

  useEffect(() => {
    if (shouldReduceMotion) {
      setVisibleHeadlineLength(headlineText.length);
      return;
    }

    setVisibleHeadlineLength(0);
    let currentLength = 0;
    const timer = window.setInterval(() => {
      currentLength += 1;
      setVisibleHeadlineLength(currentLength);

      if (currentLength >= headlineText.length) {
        window.clearInterval(timer);
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, [headlineText, shouldReduceMotion]);

  const [pricingInViewRef, pricingInView] = useInView({ triggerOnce: true, threshold: 0.1 });

  // Mini applications board state on landing page
  const [applicationCards, setApplicationCards] = useState<LandingApplicationCard[]>([
    { id: '1', title: 'Software Engineer', company: 'Google', template: 'Harvard CV', status: 'postulado' },
    { id: '2', title: 'Data Analyst', company: 'Netflix', template: 'Harvard CV', status: 'postulado' },
    { id: '3', title: 'Fullstack Dev', company: 'Stripe', template: 'Harvard CV', status: 'entrevista', info: 'Mañana 10:00' },
    { id: '4', title: 'AI Lead', company: 'OpenAI', template: 'Harvard CV', status: 'oferta', accepted: true },
  ]);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const [applications, setApplications] = useState(10);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setActiveColumn(status);
  };

  const handleDragLeave = () => {
    setActiveColumn(null);
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    setApplicationCards(prev => prev.map(card => {
      if (card.id === id) {
        if (status === 'oferta') {
          return { ...card, status, accepted: true };
        }
        return { ...card, status, accepted: false };
      }
      return card;
    }));
    setActiveColumn(null);
  };

  return (
    <LazyMotion features={domAnimation} strict>
    <div className="relative min-h-screen overflow-x-hidden bg-canvas pt-16 text-text font-sans transition-colors duration-300">
      {/* Background radial glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-ai/4 dark:bg-ai/6 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[20%] right-[-10%] w-[45%] h-[45%] rounded-full bg-action/4 dark:bg-ai/8 blur-[130px] pointer-events-none z-0" />

      {/* Navigation Header */}
      <LandingHeader
        isLoggedIn={!!session}
        navFeatures={t('landing.nav.features')}
        navTemplates={t('landing.nav.templates')}
        navPricing={t('landing.nav.pricing')}
        navDashboard={t('landing.nav.dashboard')}
        navLogin={t('landing.nav.login')}
        navRegister={t('landing.nav.register')}
      />

      {/* Centered Welcome Section (adapted from Google Antigravity) */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[calc(100vh-4rem)] z-10 flex flex-col items-center justify-center text-center py-16">
        {/* Particle matching mesh underneath Hero */}
        <div className="absolute inset-0 w-full h-full -z-10 overflow-hidden">
          <ParticlesCanvas disabled={shouldUseLightMotion} />
        </div>

        {/* 1. Centered Logo at the top */}
        <m.div 
          className="mb-10 select-none flex items-center justify-center"
          initial={{ opacity: 0, y: -25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <Logo iconSize="md" textSize="lg" className="scale-125 sm:scale-150 transform origin-center" />
        </m.div>

        {/* 2. Header Container */}
        <div className="max-w-4xl mx-auto mb-8">
          <h1 className="font-display font-black text-4xl sm:text-6xl tracking-tight leading-[1.15] text-text min-h-[5.5rem] sm:min-h-[7rem]">
            <span>{visiblePart1}</span>
            <span className="bg-gradient-to-r from-ai to-action dark:to-emerald-400 bg-clip-text text-transparent">
              {visiblePart2}
            </span>
            <span>{visiblePart3}</span>
            {!shouldReduceMotion && (
              <span className="inline-block w-[3px] h-[0.85em] bg-ai-action dark:bg-action ml-1 rounded-sm align-middle animate-blink" />
            )}
          </h1>
        </div>

        {/* 4. Welcome CTA Row */}
        <m.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.8 }}
        >
          <ButtonLink
            href={session ? "/dashboard" : "/try"}
            size="hero"
            className="w-full sm:w-auto group"
          >
            {t('landing.hero.primaryCta')}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform stroke-[1.75]" />
          </ButtonLink>
          <a
            href="#templates"
            className="w-full sm:w-auto bg-surface border border-subtle text-text-muted dark:text-text hover:bg-canvas dark:hover:bg-surface-muted/80 hover:text-text dark:hover:text-white px-8 py-4 rounded-[8px] font-semibold transition-all flex items-center justify-center gap-2 text-base font-display shadow-sm"
          >
            {t('landing.hero.secondaryCta')}
          </a>
        </m.div>
      </section>


      {/* Wavy Banner & Typewriter Typing Effect */}
      <AgentFirstEffect />
      {/* Features Grid (Scroll Triggered + Cursor Glow) - Restructured to Antigravity Row style */}
      <section id="features" className="feature-explorer-section">
        <div className="grid-container">
          <div className="feature-list">

            {/* Feature Item 1: Split-Screen Editor */}
            <div className="feature-item">
              <div className="grid-row">
                <div className="grid-col col-xs-4 col-md-4">
                  <div className="feature-copy">
                    <span className="heading-4 feature-title">{t('landing.features.editor.title')}</span>
                    <p className="body feature-description" aria-label={t('landing.features.editor.desc')}>
                      <FeatureDescription text={t('landing.features.editor.desc')} />
                    </p>
                  </div>
                </div>
                <div className="grid-col col-xs-4 col-md-offset-2 col-md-6">
                  <div className="feature-media">
                    <m.div
                      initial={{ opacity: 0, y: 35 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-100px' }}
                      transition={{ duration: 0.6, delay: 0.15 }}
                    >
                      <FeatureCard className="bg-surface-muted/30 p-3 sm:p-8 rounded-xl sm:rounded-2xl border border-text/8 dark:border-white/5 shadow-md overflow-hidden relative">
                        <MiniEditorMockup />
                      </FeatureCard>
                    </m.div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Item 2: AI Semantic Optimization */}
            <div className="feature-item">
              <div className="grid-row">
                <div className="grid-col col-xs-4 col-md-4 order-1 md:order-2 md:col-start-9">
                  <div className="feature-copy">
                    <span className="heading-4 feature-title">{t('landing.features.ai.title')}</span>
                    <p className="body feature-description" aria-label={t('landing.features.ai.desc')}>
                      <FeatureDescription text={t('landing.features.ai.desc')} />
                    </p>
                  </div>
                </div>
                <div className="grid-col col-xs-4 col-md-6 order-2 md:order-1 md:col-start-1">
                  <div className="feature-media">
                    <m.div
                      initial={{ opacity: 0, y: 35 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-100px' }}
                      transition={{ duration: 0.6, delay: 0.15 }}
                    >
                      <FeatureCard className="bg-surface-muted/30 p-3 sm:p-8 rounded-xl sm:rounded-2xl border border-text/8 dark:border-white/5 shadow-md overflow-hidden relative">
                        {/* Visual conceptual AI Optimization CV & Keyword link Streams */}
                        <div className="flex flex-col items-center justify-center relative h-36 sm:h-52 overflow-hidden bg-control/5 dark:bg-surface/10 rounded-xl border border-subtle select-none w-full">
                          {/* Glowing background aura */}
                          <div className="absolute inset-0 bg-ai/5 rounded-full blur-2xl animate-pulse" />

                          {/* SVG Streams connecting keywords to central CV */}
                          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 340 176" fill="none" xmlns="http://www.w3.org/2000/svg">
                            {[
                              { d: 'M 55 30 L 152 90', color: '#8b5cf6' },
                              { d: 'M 285 30 L 188 90', color: '#10b981' },
                              { d: 'M 35 84 L 142 105', color: '#6366f1' },
                              { d: 'M 305 84 L 198 105', color: '#2ecc71' },
                              { d: 'M 55 146 L 152 120', color: '#8b5cf6' },
                              { d: 'M 285 146 L 188 120', color: '#a855f7' }
                            ].map((line, idx) => (
                              <g key={idx}>
                                <path d={line.d} stroke={line.color} strokeWidth="1" strokeOpacity="0.12" />
                                <m.path
                                  d={line.d}
                                  stroke={line.color}
                                  strokeWidth="1.2"
                                  strokeOpacity="0.45"
                                  strokeDasharray="4 4"
                                  animate={{ strokeDashoffset: [20, 0] }}
                                  transition={{ repeat: Infinity, duration: 1.5, ease: 'linear', delay: idx * 0.2 }}
                                />
                              </g>
                            ))}
                          </svg>

                          {/* Center: CV + Match Badge */}
                          <div className="flex flex-col items-center z-10">
                            <m.div
                              animate={{ y: [0, -3, 0] }}
                              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                              className="bg-emerald-500/15 border border-emerald-500/35 text-emerald-600 dark:text-emerald-400 text-[8.5px] font-black px-2.5 py-0.5 rounded-full mb-2.5 flex items-center gap-0.5 shadow-sm shadow-emerald-500/5"
                            >
                              <Sparkles className="w-2.5 h-2.5 animate-pulse text-emerald-500" />
                              <span>98% ATS Match</span>
                            </m.div>

                            <m.div
                              whileHover={{ scale: 1.05, y: -2 }}
                              className="w-14 h-18 bg-white dark:bg-canvas rounded-lg shadow-xl border border-ai/25 dark:border-ai/35 flex flex-col p-2 gap-1.5 relative overflow-hidden"
                            >
                              <div className="flex gap-1 items-center">
                                <div className="w-3 h-3 rounded-full bg-ai/15 flex items-center justify-center">
                                  <div className="w-1.5 h-1.5 rounded-full bg-ai/40" />
                                </div>
                                <div className="flex-1 flex flex-col gap-0.5">
                                  <div className="h-1 w-6 bg-ai-action rounded-full" />
                                  <div className="h-0.5 w-4 bg-subtle dark:bg-surface-muted rounded-full" />
                                </div>
                              </div>

                              <div className="flex flex-col gap-1 mt-1">
                                <div className="h-0.5 w-full bg-subtle dark:bg-surface-muted rounded-full" />
                                <div className="h-0.5 w-5/6 bg-subtle dark:bg-surface-muted rounded-full" />
                                <div className="h-0.5 w-4/6 bg-subtle dark:bg-surface-muted rounded-full" />
                              </div>

                              <div className="h-2 w-full bg-emerald-500/15 rounded border border-emerald-500/25 overflow-hidden relative flex items-center justify-center mt-auto">
                                <m.div
                                  animate={{ x: ['-100%', '100%'] }}
                                  transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                                />
                              </div>
                            </m.div>
                          </div>

                          {/* Keywords */}
                          <m.div
                            animate={{ y: [0, -4, 0] }}
                            transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
                            className="absolute left-[10%] top-[12%] bg-ai/8 hover:bg-ai/15 border border-ai/20 text-ai text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm cursor-default"
                          >
                            Logros
                          </m.div>

                          <m.div
                            animate={{ y: [0, -4, 0] }}
                            transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut", delay: 0.5 }}
                            className="absolute right-[10%] top-[12%] bg-emerald-500/8 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm cursor-default"
                          >
                            Keywords
                          </m.div>

                          <m.div
                            animate={{ y: [0, 4, 0] }}
                            transition={{ repeat: Infinity, duration: 3.4, ease: "easeInOut", delay: 1 }}
                            className="absolute left-[4%] top-[45%] bg-indigo-500/8 hover:bg-indigo-500/15 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[8px] font-bold px-2.5 py-0.5 rounded-full shadow-sm cursor-default"
                          >
                            ATS
                          </m.div>

                          <m.div
                            animate={{ y: [0, 4, 0] }}
                            transition={{ repeat: Infinity, duration: 3.1, ease: "easeInOut", delay: 1.5 }}
                            className="absolute right-[4%] top-[45%] bg-action/8 hover:bg-action/15 border border-action/20 text-success-text dark:text-emerald-400 text-[8px] font-bold px-2.5 py-0.5 rounded-full shadow-sm cursor-default"
                          >
                            Impacto
                          </m.div>

                          <m.div
                            animate={{ y: [0, -4, 0] }}
                            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", delay: 2 }}
                            className="absolute left-[10%] bottom-[12%] bg-violet-500/8 hover:bg-violet-500/15 border border-violet-500/20 text-violet-600 dark:text-ai text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm cursor-default"
                          >
                            Logros
                          </m.div>

                          <m.div
                            animate={{ y: [0, -4, 0] }}
                            transition={{ repeat: Infinity, duration: 3.3, ease: "easeInOut", delay: 2.5 }}
                            className="absolute right-[10%] bottom-[12%] bg-purple-500/8 hover:bg-purple-500/15 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm cursor-default"
                          >
                            Skills
                          </m.div>
                        </div>
                      </FeatureCard>
                    </m.div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Item 3: Applications Pipeline */}
            <div className="feature-item">
              <div className="grid-row">
                <div className="grid-col col-xs-4 col-md-4">
                  <div className="feature-copy">
                    <span className="heading-4 feature-title">{t('landing.features.applications.title')}</span>
                    <p className="body feature-description" aria-label={t('landing.features.applications.desc')}>
                      <FeatureDescription text={t('landing.features.applications.desc')} />
                    </p>
                  </div>
                </div>
                <div className="grid-col col-xs-4 col-md-offset-2 col-md-6">
                  <div className="feature-media">
                    <m.div
                      initial={{ opacity: 0, y: 35 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-100px' }}
                      transition={{ duration: 0.6, delay: 0.15 }}
                    >
                      <FeatureCard className="bg-surface-muted/30 p-3 sm:p-8 rounded-xl sm:rounded-2xl border border-text/8 dark:border-white/5 shadow-md overflow-hidden relative">
                        {/* Right Column: Mini Applications UI Preview */}
                        <div className="w-full bg-surface-muted/40 border border-subtle rounded-xl p-2.5 sm:p-5 shadow-inner flex gap-2 sm:gap-4 h-[150px] sm:h-[220px] overflow-hidden relative">
                          {[
                            { id: 'postulado', name: 'Postulado', colorClass: 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10', dotColor: 'bg-yellow-500' },
                            { id: 'entrevista', name: 'Entrevista', colorClass: 'text-ai bg-ai/10', dotColor: 'bg-ai-action' },
                            { id: 'oferta', name: 'Oferta', colorClass: 'text-emerald-500 bg-emerald-500/10', dotColor: 'bg-emerald-500' },
                          ].map(col => {
                            const colCards = applicationCards.filter(c => c.status === col.id);
                            const isActive = activeColumn === col.id;
                            
                            return (
                              <div
                                key={col.id}
                                onDragOver={handleDragOver}
                                onDragEnter={(e) => handleDragEnter(e, col.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, col.id)}
                                className={`flex-1 flex flex-col gap-2.5 rounded-xl transition-all duration-200 p-1 select-none ${
                                  isActive ? 'bg-ai/5 outline-2 outline-dashed outline-ai/20' : ''
                                }`}
                              >
                                <div className={`flex items-center justify-between text-[8px] font-bold px-2.5 py-1 rounded-md border border-transparent ${col.colorClass}`}>
                                  <span>{col.name}</span>
                                  <span className={`w-1.5 h-1.5 rounded-full ${col.dotColor} ${col.id === 'oferta' ? 'animate-pulse' : ''}`} />
                                </div>
                                
                                <div className="flex-1 flex flex-col gap-2 overflow-y-auto scrollbar-none pr-0.5">
                                  {colCards.map(card => (
                                    <m.div
                                      key={card.id}
                                      layout
                                      draggable
                                      onDragStart={(e: any) => handleDragStart(e, card.id)}
                                      whileDrag={{ scale: 1.05, rotate: 1.5 }}
                                      className={`bg-white dark:bg-canvas p-2.5 rounded-xl shadow-sm border border-slate-100 dark:border-white/5 flex flex-col gap-1.5 cursor-grab active:cursor-grabbing transition-all hover:border-ai/30 ${
                                        card.accepted ? 'border-l-2 border-l-emerald-500 dark:border-l-emerald-500 shadow-md ring-2 ring-emerald-500/10 dark:ring-emerald-500/20' : ''
                                      }`}
                                    >
                                      <div className="text-[8.5px] font-bold text-slate-700 dark:text-text leading-tight">{card.title}</div>
                                      <div className="text-[7.5px] text-slate-400 leading-none">{card.company} • {card.template}</div>
                                      {card.info && (
                                        <div className="flex gap-1.5 mt-0.5">
                                          <span className="bg-ai/10 text-ai text-[6.5px] font-bold px-1.5 py-0.5 rounded leading-none">{card.info}</span>
                                        </div>
                                      )}
                                      {card.accepted && (
                                        <div className="text-[6.5px] text-emerald-500 font-extrabold mt-0.5 animate-bounce leading-none">🎉 ¡Aceptada!</div>
                                      )}
                                    </m.div>
                                  ))}
                                  {colCards.length === 0 && (
                                    <div className="flex-1 flex items-center justify-center border border-dashed border-slate-200 dark:border-white/5 rounded-xl py-6 text-center text-[7px] text-slate-400">
                                      Arrastra aquí
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </FeatureCard>
                    </m.div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Templates Section */}
      <section id="templates" className="py-24 bg-canvas scroll-mt-24 relative overflow-hidden transition-colors duration-300">
        <div className="absolute top-[30%] left-[-15%] w-[40%] h-[40%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

          <div className="text-center mb-20">
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-text mb-4">
              {t('landing.templates.title')}
            </h2>
            <p className="text-text-muted max-w-2xl mx-auto font-light">
              {t('landing.templates.subtitle')}
            </p>
          </div>

          <div className="flex justify-center py-10">
            <div className="w-[300px] md:w-[320px]">
              <TemplateFlipCard
                title="Harvard"
                badgeText="Harvard (Básico)"
                badgeColorClass="bg-surface-muted text-slate-700 dark:bg-surface-muted/80 dark:text-text border-slate-200 dark:border-slate-700"
                desc={t('landing.templates.harvard.desc')}
                ctaText={t('landing.templates.harvard.cta')}
                imagePath="/assets/images/cvs/harvard.jpg"
                session={session}
                t={t}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-subtle bg-white py-20 dark:border-white/5 dark:bg-canvas sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-ai">{t('landing.conversion.proof.eyebrow')}</p>
            <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-text sm:text-4xl">{t('landing.conversion.proof.title')}</h2>
            <p className="mt-4 text-base leading-7 text-text-muted dark:text-slate-300">{t('landing.conversion.proof.subtitle')}</p>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {[
              ['landing.conversion.proof.item1Title', 'landing.conversion.proof.item1Desc'],
              ['landing.conversion.proof.item2Title', 'landing.conversion.proof.item2Desc'],
              ['landing.conversion.proof.item3Title', 'landing.conversion.proof.item3Desc'],
            ].map(([titleKey, descKey]) => (
              <article key={titleKey} className="rounded-2xl border border-text/9 bg-canvas p-6 dark:border-white/8 dark:bg-surface">
                <CheckCircle className="h-6 w-6 text-success-text" strokeWidth={1.75} />
                <h3 className="mt-5 font-display text-lg font-extrabold text-text">{t(titleKey)}</h3>
                <p className="mt-3 text-sm leading-6 text-text-muted dark:text-slate-300">{t(descKey)}</p>
              </article>
            ))}
          </div>
          <p className="mx-auto mt-7 max-w-3xl text-center text-xs leading-5 text-text-muted">{t('landing.conversion.proof.disclaimer')}</p>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-24 border-y border-subtle bg-surface-muted py-20 sm:py-24" ref={pricingInViewRef}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-ai">{t('landing.conversion.pricing.eyebrow')}</p>
            <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-text sm:text-4xl">{t('landing.conversion.pricing.title')}</h2>
            <p className="mt-4 text-base leading-7 text-text-muted dark:text-slate-300">{t('landing.conversion.pricing.subtitle')}</p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <article className="order-2 flex flex-col rounded-2xl border border-subtle bg-white p-6 shadow-sm dark:border-white/10 dark:bg-surface sm:p-8 md:order-1">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-text-muted">{t('landing.conversion.pricing.freeLabel')}</p>
              <h3 className="mt-3 font-display text-xl font-extrabold text-text">{t('landing.conversion.pricing.freeAudience')}</h3>
              <div className="mt-6 flex items-end gap-2"><span className="font-display text-5xl font-black text-text">0 €</span><span className="pb-1 text-sm text-text-muted">{t('landing.conversion.pricing.freePeriod')}</span></div>
              <ul className="mt-8 flex-1 space-y-4 text-sm text-text">
                {[1, 2, 3, 4].map((index) => <li key={index} className="flex items-start gap-3"><CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success-text" strokeWidth={1.75} /><span>{t(`landing.conversion.pricing.freeFeature${index}`)}</span></li>)}
              </ul>
              <ButtonLink href="/try?source=pricing-free" variant="secondary" className="mt-8 w-full">{t('landing.conversion.pricing.freeCta')}</ButtonLink>
              <p className="mt-3 text-center text-xs leading-5 text-text-muted">{t('landing.conversion.pricing.freeNote')}</p>
            </article>

            <article className="relative order-1 flex flex-col rounded-2xl border border-ai/40 bg-white p-6 shadow-[0_18px_60px_-28px_rgba(139,92,246,0.55)] dark:bg-surface sm:p-8 md:order-2">
              <span className="absolute right-5 top-0 -translate-y-1/2 rounded-full bg-ai-action px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-on-ai-action shadow-md">{t('landing.conversion.pricing.proBadge')}</span>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-ai">{t('landing.conversion.pricing.proLabel')}</p>
              <h3 className="mt-3 font-display text-xl font-extrabold text-text">{t('landing.conversion.pricing.proAudience')}</h3>
              <div className="mt-6 flex flex-wrap items-end gap-x-2 gap-y-1"><span className="font-display text-5xl font-black text-text">10 €</span><span className="pb-1 text-sm text-text-muted">{t('landing.conversion.pricing.proPeriod')}</span><span className="w-full text-xs font-bold text-ai">{t('landing.conversion.pricing.proDaily')}</span></div>
              <ul className="mt-8 flex-1 space-y-4 text-sm text-text">
                {[1, 2, 3, 4].map((index) => <li key={index} className="flex items-start gap-3"><CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success-text" strokeWidth={1.75} /><span>{t(`landing.conversion.pricing.proFeature${index}`)}</span></li>)}
              </ul>
              <ButtonLink href={session ? '/api/stripe/checkout?source=landing-pricing' : '/register?plan=pro&source=landing-pricing&next=%2Fapi%2Fstripe%2Fcheckout%3Fsource%3Dlanding-pricing'} className="mt-8 w-full">{t('landing.conversion.pricing.proCta')}</ButtonLink>
              <p className="mt-3 text-center text-xs leading-5 text-text-muted">{t('landing.conversion.pricing.proNote')}</p>
            </article>
          </div>

          <div className="mt-10 overflow-hidden rounded-2xl border border-subtle bg-white dark:border-white/10 dark:bg-surface">
            <div className="border-b border-text/8 px-5 py-4 dark:border-white/8"><h3 className="font-display text-lg font-extrabold text-text">{t('landing.conversion.pricing.compareTitle')}</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead><tr className="bg-surface-muted dark:bg-canvas"><th className="px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-text-muted">{t('landing.conversion.pricing.compareCapability')}</th><th className="px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-text-muted">{t('landing.conversion.pricing.compareFree')}</th><th className="px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-ai">{t('landing.conversion.pricing.comparePro')}</th></tr></thead>
                <tbody>
                  {[1, 2, 3, 4, 5, 6].map((index) => { const [capability, freeValue, proValue] = t(`landing.conversion.pricing.row${index}`).split('|'); return <tr key={capability} className="border-t border-text/7 dark:border-white/7"><th scope="row" className="px-5 py-3.5 font-semibold text-text">{capability}</th><td className="px-5 py-3.5 text-text-muted dark:text-slate-300">{freeValue}</td><td className="px-5 py-3.5 font-semibold text-text">{proValue}</td></tr>; })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-subtle bg-white p-5 dark:border-white/10 dark:bg-surface sm:p-6">
            <h3 className="font-display text-lg font-extrabold text-text">{t('landing.conversion.pricing.calculatorTitle')}</h3>
            <label htmlFor="application-volume" className="mt-4 flex items-center justify-between gap-3 text-sm font-semibold text-text-muted dark:text-slate-300"><span>{t('landing.conversion.pricing.calculatorLabel')}</span><span className="rounded-md bg-ai/10 px-2.5 py-1 font-extrabold text-ai-text dark:text-ai">{applications}</span></label>
            <input id="application-volume" type="range" min="2" max="30" value={applications} onChange={(event) => setApplications(Number(event.target.value))} className="mt-3 w-full accent-ai" />
            <div className="mt-5 rounded-xl bg-[#1e1b4b] p-4 text-white"><p className="text-xs text-white/65">{t('landing.conversion.pricing.calculatorPrefix')}</p><p className="mt-1 font-display text-2xl font-black">{(10 / applications).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })}</p><p className="mt-1 text-xs text-white/65">{t('landing.conversion.pricing.calculatorSuffix')}</p></div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 dark:bg-canvas sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="text-center"><p className="text-xs font-black uppercase tracking-[0.16em] text-ai">{t('landing.conversion.faq.eyebrow')}</p><h2 className="mt-4 font-display text-3xl font-extrabold text-text sm:text-4xl">{t('landing.conversion.faq.title')}</h2></div>
          <div className="mt-10 divide-y divide-subtle rounded-2xl border border-subtle bg-canvas px-5 dark:divide-white/8 dark:border-white/10 dark:bg-surface sm:px-7">
            {[1, 2, 3, 4, 5].map((index) => <details key={index} className="group py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-base font-extrabold text-text">{t(`landing.conversion.faq.q${index}`)}<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-text/5 text-text-muted transition-transform duration-300 ease-out group-open:rotate-45 dark:bg-white/8 dark:text-slate-300">+</span></summary><p className="faq-answer max-w-2xl pb-1 pr-10 pt-3 text-sm leading-6 text-text-muted dark:text-slate-300">{t(`landing.conversion.faq.a${index}`)}</p></details>)}
          </div>
        </div>
      </section>

      <section className="bg-[#1e1b4b] py-16 text-center text-white dark:bg-surface sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-ai">{t('landing.conversion.final.eyebrow')}</p><h2 className="mt-4 font-display text-3xl font-black sm:text-4xl">{t('landing.conversion.final.title')}</h2><p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/70">{t('landing.conversion.final.subtitle')}</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/try?source=final-cta" className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-action px-6 py-4 font-display font-extrabold text-on-action hover:bg-action-hover">{t('landing.conversion.final.primary')}<ArrowRight className="h-5 w-5" strokeWidth={1.75} /></Link><Link href={session ? '/api/stripe/checkout?source=landing-pricing' : '/register?plan=pro&source=landing-pricing&next=%2Fapi%2Fstripe%2Fcheckout%3Fsource%3Dlanding-pricing'} className="inline-flex items-center justify-center rounded-[8px] border border-white/20 bg-white/10 px-6 py-4 font-display font-extrabold text-white hover:bg-white/15">{t('landing.conversion.final.secondary')}</Link></div></div>
      </section>

      <footer className="border-t border-subtle bg-canvas py-12 dark:border-white/10 dark:bg-canvas">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:grid-cols-[1.3fr_0.7fr_0.7fr] sm:px-6 lg:px-8">
          <div><Logo iconSize="sm" textSize="md" /><p className="mt-4 max-w-sm text-sm leading-6 text-text-muted">{t('landing.conversion.footer.tagline')}</p><p className="mt-4 text-xs font-semibold text-text-muted">{t('landing.conversion.footer.payments')}</p></div>
          <div><h2 className="text-xs font-black uppercase tracking-[0.14em] text-text-muted">{t('landing.conversion.footer.product')}</h2><nav className="mt-4 flex flex-col gap-3 text-sm font-semibold text-text-muted dark:text-slate-300"><a href="#features">{t('landing.conversion.footer.how')}</a><a href="#templates">{t('landing.conversion.footer.templates')}</a><a href="#pricing">{t('landing.conversion.footer.pricing')}</a></nav></div>
          <div><h2 className="text-xs font-black uppercase tracking-[0.14em] text-text-muted">{t('landing.conversion.footer.trust')}</h2><nav className="mt-4 flex flex-col gap-3 text-sm font-semibold text-text-muted dark:text-slate-300"><Link href="/privacy">{t('landing.conversion.footer.privacy')}</Link><Link href="/terms">{t('landing.conversion.footer.terms')}</Link><Link href="/cookies">{t('landing.conversion.footer.cookies')}</Link><a href="mailto:soporte@matchply.com">{t('landing.conversion.footer.support')}</a></nav></div>
        </div>
        <div className="mx-auto mt-10 max-w-7xl border-t border-text/8 px-4 pt-6 text-xs text-text-muted dark:border-white/8 dark:text-text-muted">© {new Date().getFullYear()} Matchply. {t('landing.footer.tagline')}</div>
      </footer>
    </div>
    </LazyMotion>
  );
}
