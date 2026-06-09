'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Sparkles, FileText, CheckCircle, ArrowRight, ChevronRight, ChevronLeft, BarChart2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import LandingHeader from '@/components/landing/LandingHeader';
import AgentFirstEffect from '@/components/landing/AgentFirstEffect';
import Logo from '@/components/ui/Logo';

// ----------------------------------------------------
// Sub-component: Interactive Particles/Grid Canvas
// ----------------------------------------------------
export function ParticlesCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
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
      if (!canvas) return;
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || 650;
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      const count = Math.min(Math.floor((canvas.width * canvas.height) / 13000), 75);
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.45,
          vy: (Math.random() - 0.5) * 0.45,
          radius: Math.random() * 3 + 1.5,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

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
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    handleResize();
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none opacity-70 dark:opacity-85 z-0" />;
}

// ----------------------------------------------------
// Sub-component: Scroll-revealing Character Stagger Text
// ----------------------------------------------------
function FeatureDescription({ text }: { text: string }) {
  const words = text.split(' ');

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.006,
      },
    },
  };

  const charVariants = {
    hidden: { opacity: 0.15 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.28,
        ease: "easeOut" as any,
      },
    },
  };

  return (
    <motion.span
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      className="inline-block"
      aria-label={text}
    >
      {words.map((word, wordIdx) => (
        <span
          key={wordIdx}
          className="inline-block whitespace-nowrap mr-[0.25em]"
          aria-hidden="true"
        >
          {Array.from(word).map((char, charIdx) => (
            <motion.span
              key={charIdx}
              variants={charVariants}
              className="inline-block relative"
            >
              {char}
            </motion.span>
          ))}
        </span>
      ))}
    </motion.span>
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
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
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
        background: isHovered
          ? `radial-gradient(300px circle at ${coords.x}px ${coords.y}px, rgba(139, 92, 246, 0.09), transparent 85%)`
          : undefined,
      }}
    >
      {/* Dynamic border highlighting cursor */}
      {isHovered && (
        <div
          className="absolute pointer-events-none rounded-[12px] border border-[#8b5cf6]/20 transition-opacity duration-300"
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
  isPeeking = false,
}: {
  title: string;
  badgeText: string;
  badgeColorClass: string;
  desc: string;
  ctaText: string;
  imagePath: string;
  session: any;
  t: any;
  isPeeking?: boolean;
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
          transform: isFlipped ? 'rotateY(180deg)' : isPeeking ? 'rotateY(30deg)' : 'rotateY(0deg)',
        }}
      >

        {/* Front Face */}
        <div className="backface-hidden absolute inset-0 bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300">
          <div>
            <div className={`p-2 py-1 rounded-[8px] border text-[11px] font-bold font-display w-fit mb-4 ${badgeColorClass}`}>
              {badgeText}
            </div>
            <h4 className="text-xl font-bold font-display text-[#1e1b4b] dark:text-white mb-2">{title}</h4>
            <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs font-light leading-relaxed">
              {desc}
            </p>
          </div>

          {/* Decorative mini layout of the CV inside card */}
          <div className="border-t border-[#1e1b4b]/5 dark:border-white/5 pt-4 flex flex-col gap-2 opacity-50 group-hover:opacity-85 transition-opacity">
            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-sm" />
            <div className="h-1.5 w-5/6 bg-slate-200 dark:bg-slate-700 rounded-sm" />
            <div className="h-1.5 w-4/6 bg-slate-200 dark:bg-slate-700 rounded-sm" />
            <div className="flex gap-1.5 mt-1 items-center">
              <div className="h-3 w-3 rounded-full bg-[#8b5cf6]/30" />
              <div className="h-1.5 w-12 bg-[#2ecc71]/25 rounded-sm" />
            </div>
          </div>

          <div className="mt-4 text-[#8b5cf6] text-xs font-bold flex items-center gap-1 font-display">
            {ctaText} <ChevronRight className="w-3.5 h-3.5 stroke-[1.75] group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Back Face (CV Visual) */}
        <div className="backface-hidden rotate-y-180 absolute inset-0 bg-[#1e1b4b] dark:bg-[#0b0f19] rounded-[12px] border border-[#8b5cf6]/40 overflow-hidden shadow-lg shadow-[#8b5cf6]/10">
          <img
            src={imagePath}
            alt={title}
            loading="lazy"
            fetchPriority="low"
            className="w-full h-full object-cover object-top opacity-90 group-hover:scale-105 transition-transform duration-700"
          />
          {/* Overlay containing "Use This Template" Action */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f19]/95 via-[#0b0f19]/35 to-transparent flex flex-col justify-end p-5">
            <h5 className="text-white font-bold font-display text-sm mb-1">{title} Template</h5>
            <p className="text-slate-300 text-[10px] font-light mb-3 leading-tight">{desc.substring(0, 50)}...</p>
            <Link
              href={session ? "/dashboard" : "/register"}
              className="w-full bg-[#8b5cf6] hover:bg-[#8b5cf6]/90 text-white text-center font-bold py-2.5 rounded-[8px] text-[11px] transition-all shadow-md shadow-[#8b5cf6]/20 font-display flex items-center justify-center gap-1 hover-shimmer-btn"
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
// Sub-component: 3D Carousel Card Wrapper
// ----------------------------------------------------
export function CarouselCard({
  i,
  rotation,
  children,
}: {
  i: number;
  rotation: any;
  children: React.ReactNode;
}) {
  const transform = useTransform(rotation, (r: number) => {
    const angle = (i * 72) + r;
    return `rotateY(${angle}deg) translateZ(var(--carousel-radius)) rotateY(${-angle}deg)`;
  });

  const opacity = useTransform(rotation, (r: number) => {
    const angle = ((i * 72) + r) % 360;
    const normalizedAngle = angle < 0 ? angle + 360 : angle;
    const cos = Math.cos((normalizedAngle * Math.PI) / 180);
    // At cos = -1 (back), opacity is 0.15. At cos = 1 (front), opacity is 1.0.
    return 0.15 + (cos + 1) * 0.425;
  });

  const pointerEvents = useTransform(rotation, (r: number) => {
    const angle = ((i * 72) + r) % 360;
    const normalizedAngle = angle < 0 ? angle + 360 : angle;
    const cos = Math.cos((normalizedAngle * Math.PI) / 180);
    // Only allow interaction if the card is in the front half (cos > 0)
    return cos > 0 ? 'auto' : 'none';
  });

  return (
    <motion.div
      className="absolute inset-0 w-full h-full"
      style={{
        transform,
        opacity,
        pointerEvents,
        transformStyle: 'preserve-3d',
      }}
    >
      {children}
    </motion.div>
  );
}

// ----------------------------------------------------
// Sub-component: Mini IDE Real-Time Compiler Mockup
// ----------------------------------------------------
export function MiniEditorMockup() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(prev => (prev + 1) % 4);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mt-8 bg-slate-950 dark:bg-slate-900 rounded-xl p-4 font-mono text-[9px] border border-white/10 dark:border-white/5 shadow-2xl flex gap-3 h-44 overflow-hidden relative select-none">
      
      {/* Left Side: Markdown Editor with line numbers */}
      <div className="w-1/2 flex flex-col gap-2 text-slate-400 text-left border-r border-white/10 pr-2 relative">
        <div className="flex items-center justify-between text-[8px] text-slate-500 font-semibold mb-1">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6] animate-pulse" />
            <span>fernando_cv.md</span>
          </div>
          <span className="text-[7px] text-slate-600 bg-white/5 px-1.5 py-0.5 rounded">Markdown</span>
        </div>
        
        {/* Editor Body: Lines and Line Numbers */}
        <div className="flex gap-2 flex-1">
          {/* Line Numbers */}
          <div className="flex flex-col text-slate-600 text-right select-none text-[8.5px] gap-[4.5px]">
            <div>1</div>
            <div>2</div>
            <div>3</div>
            <div>4</div>
            <div>5</div>
          </div>
          
          {/* Code content */}
          <div className="flex flex-col gap-[4.5px] flex-1 text-[8.5px]">
            {/* Line 1 */}
            <motion.div
              animate={{ opacity: step >= 0 ? 1 : 0.2 }}
              className="text-[#8b5cf6] font-bold animate-pulse"
            >
              # Fernando González
            </motion.div>
            
            {/* Line 2 */}
            <motion.div
              animate={{ opacity: step >= 1 ? 1 : 0.15 }}
              className="text-slate-500 font-semibold"
            >
              ## Experiencia
            </motion.div>
            
            {/* Line 3 */}
            <motion.div
              animate={{ opacity: step >= 2 ? 1 : 0.15 }}
              className="text-emerald-400"
            >
              * Admin Contable
            </motion.div>
            
            {/* Line 4 */}
            <motion.div
              animate={{ opacity: step >= 3 ? 1 : 0.15 }}
              className="text-[#8b5cf6]/80 pl-2"
            >
              - Método STAR activado
            </motion.div>
            
            {/* Line 5 (Blinking Typing Cursor) */}
            <div className="flex items-center">
              <span className="text-slate-500 pl-2">
                {step === 0 && ""}
                {step === 1 && ""}
                {step === 2 && ""}
                {step === 3 && ""}
              </span>
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="w-1 h-3 bg-[#8b5cf6] ml-0.5"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: PDF Compiler Viewer */}
      <div className="w-1/2 bg-white/5 dark:bg-white/5 rounded-lg p-3 flex flex-col gap-2.5 relative border border-white/5">
        {/* PDF Header controls */}
        <div className="flex items-center justify-between text-[7px] text-slate-500 border-b border-white/10 pb-1 mb-0.5">
          <span>Vista Previa PDF</span>
          <div className="flex gap-1 items-center">
            <span className="px-1 bg-white/5 rounded font-bold">75%</span>
            <span className="w-2 h-2 rounded bg-white/10 hover:bg-white/20" />
          </div>
        </div>

        {/* PDF Document Preview elements linked to editor step */}
        <div className="flex flex-col gap-2 flex-1">
          {/* Header element (linked to step 0) */}
          <motion.div
            animate={{ 
              opacity: step >= 0 ? 1 : 0.15,
              scale: step === 0 ? [1, 1.03, 1] : 1
            }}
            className="flex flex-col gap-1"
          >
            <div className="h-2 w-14 bg-[#8b5cf6] rounded" />
            <div className="h-1 w-8 bg-slate-400/50 rounded animate-pulse" />
          </motion.div>

          {/* Experiencia title (linked to step 1) */}
          <motion.div
            animate={{ 
              opacity: step >= 1 ? 1 : 0.15,
              scale: step === 1 ? [1, 1.03, 1] : 1
            }}
            className="h-1.5 w-10 bg-slate-300 rounded"
          />

          {/* Job Item lines (linked to step 2) */}
          <motion.div
            animate={{ 
              opacity: step >= 2 ? 1 : 0.15,
              scale: step === 2 ? [1, 1.03, 1] : 1
            }}
            className="flex flex-col gap-1 pl-1"
          >
            <div className="h-1 w-full bg-slate-300/40 rounded" />
            <div className="h-1 w-5/6 bg-slate-300/40 rounded" />
          </motion.div>

          {/* Optimized STAR highlights (linked to step 3) */}
          <motion.div
            animate={{ 
              opacity: step >= 3 ? 1 : 0.15,
              scale: step === 3 ? [1, 1.02, 1] : 1
            }}
            className="h-3 w-full bg-emerald-500/10 border border-emerald-500/30 rounded pl-1 flex items-center overflow-hidden"
          >
            <div className="h-1 w-4/5 bg-emerald-400/70 rounded relative overflow-hidden">
              <motion.div
                animate={{ x: ['-100%', '100%'] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
              />
            </div>
          </motion.div>
        </div>
        
        {/* PDF Status Indicator */}
        <div className="flex gap-1.5 items-center mt-auto">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
          <span className="text-[7px] text-emerald-400 font-sans font-bold">Compilado Ok</span>
        </div>
      </div>
    </div>
  );
}

interface KanbanCardType {
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
  const { t, language } = useLanguage();

  const [typedPart1, setTypedPart1] = useState('');
  const [typedPart2, setTypedPart2] = useState('');
  const [typedPart3, setTypedPart3] = useState('');
  const [activePart, setActivePart] = useState(1);

  const part1Text = t('landing.hero.titleBefore') + ' ';
  const part2Text = t('landing.hero.titleHighlight') + ' ';
  const part3Text = t('landing.hero.titleAfter');

  useEffect(() => {
    setTypedPart1('');
    setTypedPart2('');
    setTypedPart3('');
    setActivePart(1);
  }, [language]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (activePart === 1) {
      let idx = 0;
      timer = setInterval(() => {
        idx++;
        setTypedPart1(part1Text.slice(0, idx));
        if (idx >= part1Text.length) {
          clearInterval(timer);
          setActivePart(2);
        }
      }, 50);
    } else if (activePart === 2) {
      let idx = 0;
      timer = setInterval(() => {
        idx++;
        setTypedPart2(part2Text.slice(0, idx));
        if (idx >= part2Text.length) {
          clearInterval(timer);
          setActivePart(3);
        }
      }, 50);
    } else if (activePart === 3) {
      let idx = 0;
      timer = setInterval(() => {
        idx++;
        setTypedPart3(part3Text.slice(0, idx));
        if (idx >= part3Text.length) {
          clearInterval(timer);
          setActivePart(4);
        }
      }, 50);
    }

    return () => clearInterval(timer);
  }, [activePart, part1Text, part2Text, part3Text]);

  const [headlineInViewRef, headlineInView] = useInView({ triggerOnce: true, threshold: 0.1 });
  const [pricingInViewRef, pricingInView] = useInView({ triggerOnce: true, threshold: 0.1 });

  const rotation = useMotionValue(0);
  const [isCarouselHovered, setIsCarouselHovered] = useState(false);
  const [peekingCardIndex, setPeekingCardIndex] = useState<number | null>(null);

  // Mini Kanban state on landing page
  const [kanbanCards, setKanbanCards] = useState<KanbanCardType[]>([
    { id: '1', title: 'Software Engineer', company: 'Google', template: 'Harvard CV', status: 'postulado' },
    { id: '2', title: 'Data Analyst', company: 'Netflix', template: 'Modern CV', status: 'postulado' },
    { id: '3', title: 'Fullstack Dev', company: 'Stripe', template: 'Swiss CV', status: 'entrevista', info: 'Mañana 10:00' },
    { id: '4', title: 'AI Lead', company: 'OpenAI', template: 'Minimal CV', status: 'oferta', accepted: true },
  ]);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);

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
    setKanbanCards(prev => prev.map(card => {
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

  // Auto-rotation animation loop using framer-motion's animate
  useEffect(() => {
    if (isCarouselHovered) return;

    // Slow elegant continuous rotation
    const controls = animate(rotation, rotation.get() + 360, {
      duration: 36, // 36 seconds per full rotation
      ease: 'linear',
      repeat: Infinity,
    });

    return () => controls.stop();
  }, [isCarouselHovered]);

  // Periodic partial wiggling (peeking) hint animation
  useEffect(() => {
    const interval = setInterval(() => {
      if (isCarouselHovered) return;

      // Choose a random card to wiggle
      const randomIndex = Math.floor(Math.random() * 5);
      setPeekingCardIndex(randomIndex);

      // Reset peeking state after wiggle is done
      setTimeout(() => {
        setPeekingCardIndex(null);
      }, 1400);
    }, 5000); // Trigger every 5 seconds

    return () => clearInterval(interval);
  }, [isCarouselHovered]);

  // Navigation handlers
  const handleNext = () => {
    const current = rotation.get();
    // Step forward by 72deg to the next nearest slot
    const target = Math.floor(current / 72) * 72 - 72;
    animate(rotation, target, {
      type: 'spring',
      stiffness: 80,
      damping: 18,
    });
  };

  const handlePrev = () => {
    const current = rotation.get();
    // Step backward by 72deg to the previous nearest slot
    const target = Math.ceil(current / 72) * 72 + 72;
    animate(rotation, target, {
      type: 'spring',
      stiffness: 80,
      damping: 18,
    });
  };



  // State counters on floating mockup in Hero
  const [mockScore, setMockScore] = useState(0);
  const [mockMatch, setMockMatch] = useState(0);

  useEffect(() => {
    // Animate mockup indicators after delay
    const scoreTimer = setTimeout(() => {
      let currentScore = 0;
      const interval = setInterval(() => {
        currentScore += 2;
        if (currentScore >= 98) {
          setMockScore(98);
          clearInterval(interval);
        } else {
          setMockScore(currentScore);
        }
      }, 25);
    }, 1500);

    const matchTimer = setTimeout(() => {
      let currentMatch = 0;
      const interval = setInterval(() => {
        currentMatch += 2;
        if (currentMatch >= 95) {
          setMockMatch(95);
          clearInterval(interval);
        } else {
          setMockMatch(currentMatch);
        }
      }, 30);
    }, 2000);

    return () => {
      clearTimeout(scoreTimer);
      clearTimeout(matchTimer);
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#fafafa] dark:bg-[#0b0f19] pt-16 text-[#1e1b4b] dark:text-[#f3f4f6] font-sans transition-colors duration-300">
      {/* Background radial glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#8b5cf6]/4 dark:bg-[#8b5cf6]/6 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[20%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[#2ecc71]/4 dark:bg-[#8b5cf6]/8 blur-[130px] pointer-events-none z-0" />

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
          <ParticlesCanvas />
        </div>

        {/* 1. Centered Logo at the top */}
        <motion.div 
          className="mb-10 select-none flex items-center justify-center"
          initial={{ opacity: 0, y: -25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <Logo iconSize="md" textSize="lg" className="scale-125 sm:scale-150 transform origin-center" />
        </motion.div>

        {/* 2. Header Container */}
        <div className="max-w-4xl mx-auto mb-8">
          <h1 className="font-display font-black text-4.5xl sm:text-6xl tracking-tight leading-[1.15] text-[#1E1B4B] dark:text-white min-h-[5.5rem] sm:min-h-[7rem]">
            <span>{typedPart1}</span>
            <span className="bg-gradient-to-r from-[#8b5cf6] to-[#2ecc71] dark:to-emerald-400 bg-clip-text text-transparent">
              {typedPart2}
            </span>
            <span>{typedPart3}</span>
            {/* Blinking typewriter caret */}
            <span className="inline-block w-[3px] h-[0.85em] bg-[#8b5cf6] dark:bg-[#2ecc71] ml-1 rounded-sm align-middle animate-blink" />
          </h1>
        </div>

        {/* 4. Welcome CTA Row */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.8 }}
        >
          <Link
            href={session ? "/dashboard" : "/register"}
            className="w-full sm:w-auto bg-[#2ecc71] hover:bg-[#2ecc71]/95 text-white font-bold px-8 py-4 rounded-[8px] shadow-md shadow-[#2ecc71]/10 hover:shadow-[#2ecc71]/25 transition-all flex items-center justify-center gap-2 text-base group font-display hover-shimmer-btn"
          >
            {t('landing.hero.primaryCta')}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform stroke-[1.75]" />
          </Link>
          <a
            href="#templates"
            className="w-full sm:w-auto bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/5 text-[#1e1b4b]/80 dark:text-slate-200 hover:bg-[#fafafa] dark:hover:bg-[#1f2937]/80 hover:text-[#1e1b4b] dark:hover:text-white px-8 py-4 rounded-[8px] font-semibold transition-all flex items-center justify-center gap-2 text-base font-display shadow-sm"
          >
            {t('landing.hero.secondaryCta')}
          </a>
        </motion.div>
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
                    <motion.div
                      initial={{ opacity: 0, y: 35 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-100px' }}
                      transition={{ duration: 0.6, delay: 0.15 }}
                    >
                      <FeatureCard className="bg-slate-50 dark:bg-[#1f2937]/30 p-6 sm:p-8 rounded-2xl border border-[#1e1b4b]/8 dark:border-white/5 shadow-md overflow-hidden relative">
                        <MiniEditorMockup />
                      </FeatureCard>
                    </motion.div>
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
                    <motion.div
                      initial={{ opacity: 0, y: 35 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-100px' }}
                      transition={{ duration: 0.6, delay: 0.15 }}
                    >
                      <FeatureCard className="bg-slate-50 dark:bg-[#1f2937]/30 p-6 sm:p-8 rounded-2xl border border-[#1e1b4b]/8 dark:border-white/5 shadow-md overflow-hidden relative">
                        {/* Visual conceptual AI Optimization CV & Keyword link Streams */}
                        <div className="flex flex-col items-center justify-center relative h-52 overflow-hidden bg-slate-500/5 dark:bg-slate-900/10 rounded-xl border border-[#1e1b4b]/5 dark:border-white/5 select-none w-full">
                          {/* Glowing background aura */}
                          <div className="absolute inset-0 bg-[#8b5cf6]/5 rounded-full blur-2xl animate-pulse" />

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
                                <motion.path
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
                            <motion.div
                              animate={{ y: [0, -3, 0] }}
                              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                              className="bg-emerald-500/15 border border-emerald-500/35 text-emerald-600 dark:text-emerald-400 text-[8.5px] font-black px-2.5 py-0.5 rounded-full mb-2.5 flex items-center gap-0.5 shadow-sm shadow-emerald-500/5"
                            >
                              <Sparkles className="w-2.5 h-2.5 animate-pulse text-emerald-500" />
                              <span>98% ATS Match</span>
                            </motion.div>

                            <motion.div
                              whileHover={{ scale: 1.05, y: -2 }}
                              className="w-14 h-18 bg-white dark:bg-slate-950 rounded-lg shadow-xl border border-[#8b5cf6]/25 dark:border-[#8b5cf6]/35 flex flex-col p-2 gap-1.5 relative overflow-hidden"
                            >
                              <div className="flex gap-1 items-center">
                                <div className="w-3 h-3 rounded-full bg-[#8b5cf6]/15 flex items-center justify-center">
                                  <div className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6]/40" />
                                </div>
                                <div className="flex-1 flex flex-col gap-0.5">
                                  <div className="h-1 w-6 bg-[#8b5cf6] rounded-full" />
                                  <div className="h-0.5 w-4 bg-slate-200 dark:bg-slate-800 rounded-full" />
                                </div>
                              </div>

                              <div className="flex flex-col gap-1 mt-1">
                                <div className="h-0.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full" />
                                <div className="h-0.5 w-5/6 bg-slate-200 dark:bg-slate-800 rounded-full" />
                                <div className="h-0.5 w-4/6 bg-slate-200 dark:bg-slate-800 rounded-full" />
                              </div>

                              <div className="h-2 w-full bg-emerald-500/15 rounded border border-emerald-500/25 overflow-hidden relative flex items-center justify-center mt-auto">
                                <motion.div
                                  animate={{ x: ['-100%', '100%'] }}
                                  transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                                />
                              </div>
                            </motion.div>
                          </div>

                          {/* Keywords */}
                          <motion.div
                            animate={{ y: [0, -4, 0] }}
                            transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
                            className="absolute left-[10%] top-[12%] bg-[#8b5cf6]/8 hover:bg-[#8b5cf6]/15 border border-[#8b5cf6]/20 text-[#8b5cf6] dark:text-[#a78bfa] text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm cursor-default"
                          >
                            STAR
                          </motion.div>

                          <motion.div
                            animate={{ y: [0, -4, 0] }}
                            transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut", delay: 0.5 }}
                            className="absolute right-[10%] top-[12%] bg-emerald-500/8 hover:bg-emerald-500/15 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm cursor-default"
                          >
                            Keywords
                          </motion.div>

                          <motion.div
                            animate={{ y: [0, 4, 0] }}
                            transition={{ repeat: Infinity, duration: 3.4, ease: "easeInOut", delay: 1 }}
                            className="absolute left-[4%] top-[45%] bg-indigo-500/8 hover:bg-indigo-500/15 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[8px] font-bold px-2.5 py-0.5 rounded-full shadow-sm cursor-default"
                          >
                            ATS
                          </motion.div>

                          <motion.div
                            animate={{ y: [0, 4, 0] }}
                            transition={{ repeat: Infinity, duration: 3.1, ease: "easeInOut", delay: 1.5 }}
                            className="absolute right-[4%] top-[45%] bg-[#2ecc71]/8 hover:bg-[#2ecc71]/15 border border-[#2ecc71]/20 text-[#2ecc71] dark:text-emerald-400 text-[8px] font-bold px-2.5 py-0.5 rounded-full shadow-sm cursor-default"
                          >
                            Impacto
                          </motion.div>

                          <motion.div
                            animate={{ y: [0, -4, 0] }}
                            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", delay: 2 }}
                            className="absolute left-[10%] bottom-[12%] bg-violet-500/8 hover:bg-violet-500/15 border border-violet-500/20 text-violet-600 dark:text-violet-400 text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm cursor-default"
                          >
                            Logros
                          </motion.div>

                          <motion.div
                            animate={{ y: [0, -4, 0] }}
                            transition={{ repeat: Infinity, duration: 3.3, ease: "easeInOut", delay: 2.5 }}
                            className="absolute right-[10%] bottom-[12%] bg-purple-500/8 hover:bg-purple-500/15 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-[8px] font-bold px-2 py-0.5 rounded-full shadow-sm cursor-default"
                          >
                            Skills
                          </motion.div>
                        </div>
                      </FeatureCard>
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Item 3: Kanban Applications Pipeline */}
            <div className="feature-item">
              <div className="grid-row">
                <div className="grid-col col-xs-4 col-md-4">
                  <div className="feature-copy">
                    <span className="heading-4 feature-title">{t('landing.features.kanban.title')}</span>
                    <p className="body feature-description" aria-label={t('landing.features.kanban.desc')}>
                      <FeatureDescription text={t('landing.features.kanban.desc')} />
                    </p>
                  </div>
                </div>
                <div className="grid-col col-xs-4 col-md-offset-2 col-md-6">
                  <div className="feature-media">
                    <motion.div
                      initial={{ opacity: 0, y: 35 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-100px' }}
                      transition={{ duration: 0.6, delay: 0.15 }}
                    >
                      <FeatureCard className="bg-slate-50 dark:bg-[#1f2937]/30 p-6 sm:p-8 rounded-2xl border border-[#1e1b4b]/8 dark:border-white/5 shadow-md overflow-hidden relative">
                        {/* Right Column: Mini Kanban UI Preview */}
                        <div className="w-full bg-slate-50 dark:bg-slate-800/40 border border-[#1e1b4b]/10 dark:border-white/5 rounded-xl p-5 shadow-inner flex gap-4 h-[220px] overflow-hidden relative">
                          {[
                            { id: 'postulado', name: 'Postulado', colorClass: 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10', dotColor: 'bg-yellow-500' },
                            { id: 'entrevista', name: 'Entrevista', colorClass: 'text-[#8b5cf6] bg-[#8b5cf6]/10', dotColor: 'bg-[#8b5cf6]' },
                            { id: 'oferta', name: 'Oferta', colorClass: 'text-emerald-500 bg-emerald-500/10', dotColor: 'bg-emerald-500' },
                          ].map(col => {
                            const colCards = kanbanCards.filter(c => c.status === col.id);
                            const isActive = activeColumn === col.id;
                            
                            return (
                              <div
                                key={col.id}
                                onDragOver={handleDragOver}
                                onDragEnter={(e) => handleDragEnter(e, col.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, col.id)}
                                className={`flex-1 flex flex-col gap-2.5 rounded-xl transition-all duration-200 p-1 select-none ${
                                  isActive ? 'bg-[#8b5cf6]/5 outline-2 outline-dashed outline-[#8b5cf6]/20' : ''
                                }`}
                              >
                                <div className={`flex items-center justify-between text-[8px] font-bold px-2.5 py-1 rounded-md border border-transparent ${col.colorClass}`}>
                                  <span>{col.name}</span>
                                  <span className={`w-1.5 h-1.5 rounded-full ${col.dotColor} ${col.id === 'oferta' ? 'animate-pulse' : ''}`} />
                                </div>
                                
                                <div className="flex-1 flex flex-col gap-2 overflow-y-auto scrollbar-none pr-0.5">
                                  {colCards.map(card => (
                                    <motion.div
                                      key={card.id}
                                      layout
                                      draggable
                                      onDragStart={(e: any) => handleDragStart(e, card.id)}
                                      whileDrag={{ scale: 1.05, rotate: 1.5 }}
                                      className={`bg-white dark:bg-slate-950 p-2.5 rounded-xl shadow-sm border border-slate-100 dark:border-white/5 flex flex-col gap-1.5 cursor-grab active:cursor-grabbing transition-all hover:border-[#8b5cf6]/30 ${
                                        card.accepted ? 'border-l-2 border-l-emerald-500 dark:border-l-emerald-500 shadow-md ring-2 ring-emerald-500/10 dark:ring-emerald-500/20' : ''
                                      }`}
                                    >
                                      <div className="text-[8.5px] font-bold text-slate-700 dark:text-slate-200 leading-tight">{card.title}</div>
                                      <div className="text-[7.5px] text-slate-400 leading-none">{card.company} • {card.template}</div>
                                      {card.info && (
                                        <div className="flex gap-1.5 mt-0.5">
                                          <span className="bg-[#8b5cf6]/10 text-[#8b5cf6] text-[6.5px] font-bold px-1.5 py-0.5 rounded leading-none">{card.info}</span>
                                        </div>
                                      )}
                                      {card.accepted && (
                                        <div className="text-[6.5px] text-emerald-500 font-extrabold mt-0.5 animate-bounce leading-none">🎉 ¡Aceptada!</div>
                                      )}
                                    </motion.div>
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
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Templates Section (Horizontal Stagger + 3D Flip) */}
      <section id="templates" className="py-24 bg-[#fafafa] dark:bg-[#0b0f19] scroll-mt-24 relative overflow-hidden transition-colors duration-300">
        <div className="absolute top-[30%] left-[-15%] w-[40%] h-[40%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

          <div className="text-center mb-20">
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-[#1e1b4b] dark:text-white mb-4">
              {t('landing.templates.title')}
            </h2>
            <p className="text-[#1e1b4b]/60 dark:text-slate-400 max-w-2xl mx-auto font-light">
              {t('landing.templates.subtitle')}
            </p>
          </div>

          <div
            className="relative w-full h-[500px] flex items-center justify-center overflow-visible select-none py-10"
            onMouseEnter={() => setIsCarouselHovered(true)}
            onMouseLeave={() => setIsCarouselHovered(false)}
          >
            {/* Navigation Buttons */}
            <button
              onClick={handlePrev}
              className="absolute left-4 lg:left-12 z-40 bg-white/80 dark:bg-[#1f2937]/80 hover:bg-white dark:hover:bg-[#1f2937] text-[#1e1b4b] dark:text-white p-3 rounded-full shadow-lg border border-[#1e1b4b]/5 dark:border-white/5 backdrop-blur-md transition-all active:scale-95 group"
              aria-label="Previous Template"
            >
              <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
            </button>

            <button
              onClick={handleNext}
              className="absolute right-4 lg:right-12 z-40 bg-white/80 dark:bg-[#1f2937]/80 hover:bg-white dark:hover:bg-[#1f2937] text-[#1e1b4b] dark:text-white p-3 rounded-full shadow-lg border border-[#1e1b4b]/5 dark:border-white/5 backdrop-blur-md transition-all active:scale-95 group"
              aria-label="Next Template"
            >
              <ChevronRight className="w-6 h-6 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Carousel Container */}
            <div
              className="relative w-[280px] sm:w-[300px] md:w-[320px] h-[380px] carousel-container"
              style={{ transformStyle: 'preserve-3d' }}
            >

              {/* Card 0: Harvard */}
              <CarouselCard i={0} rotation={rotation}>
                <TemplateFlipCard
                  title="Harvard"
                  badgeText="Harvard (Básico)"
                  badgeColorClass="bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                  desc={t('landing.templates.harvard.desc')}
                  ctaText={t('landing.templates.harvard.cta')}
                  imagePath="/assets/images/cvs/harvard.jpg"
                  session={session}
                  t={t}
                  isPeeking={peekingCardIndex === 0}
                />
              </CarouselCard>

              {/* Card 1: Modern */}
              <CarouselCard i={1} rotation={rotation}>
                <TemplateFlipCard
                  title="Modern"
                  badgeText="Modern (PRO)"
                  badgeColorClass="bg-[#8b5cf6]/10 text-[#8b5cf6] border-[#8b5cf6]/20"
                  desc={t('landing.templates.modern.desc')}
                  ctaText={t('landing.templates.modern.cta')}
                  imagePath="/assets/images/cvs/modern.jpg"
                  session={session}
                  t={t}
                  isPeeking={peekingCardIndex === 1}
                />
              </CarouselCard>

              {/* Card 2: Minimal */}
              <CarouselCard i={2} rotation={rotation}>
                <TemplateFlipCard
                  title="Minimal"
                  badgeText="Minimal (PRO)"
                  badgeColorClass="bg-[#1e1b4b]/5 dark:bg-white/5 text-[#1e1b4b] dark:text-slate-300 border-[#1e1b4b]/10 dark:border-white/10"
                  desc={t('landing.templates.minimal.desc')}
                  ctaText={t('landing.templates.minimal.cta')}
                  imagePath="/assets/images/cvs/minimal.jpg"
                  session={session}
                  t={t}
                  isPeeking={peekingCardIndex === 2}
                />
              </CarouselCard>

              {/* Card 3: Creative */}
              <CarouselCard i={3} rotation={rotation}>
                <TemplateFlipCard
                  title="Creative"
                  badgeText="Creative (PRO)"
                  badgeColorClass="bg-pink-500/10 text-pink-600 border-pink-500/20"
                  desc={t('landing.templates.creative.desc')}
                  ctaText={t('landing.templates.creative.cta')}
                  imagePath="/assets/images/cvs/creative.jpg"
                  session={session}
                  t={t}
                  isPeeking={peekingCardIndex === 3}
                />
              </CarouselCard>

              {/* Card 4: Swiss */}
              <CarouselCard i={4} rotation={rotation}>
                <TemplateFlipCard
                  title="Swiss"
                  badgeText="Swiss (PRO)"
                  badgeColorClass="bg-red-500/10 text-red-600 border-red-500/20"
                  desc={t('landing.templates.swiss.desc')}
                  ctaText={t('landing.templates.swiss.cta')}
                  imagePath="/assets/images/cvs/swiss.jpg"
                  session={session}
                  t={t}
                  isPeeking={peekingCardIndex === 4}
                />
              </CarouselCard>

            </div>
          </div>
        </div>
      </section>

      {/* Pricing Grid */}
      <section id="pricing" className="py-24 border-t border-[#1e1b4b]/5 dark:border-white/5 bg-white dark:bg-[#0b0f19] relative scroll-mt-24 transition-colors duration-300" ref={pricingInViewRef}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

          <div className="text-center mb-20">
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-[#1e1b4b] dark:text-white mb-4">
              {t('landing.pricing.title')}
            </h2>
            <p className="text-[#1e1b4b]/60 dark:text-slate-400 font-light max-w-xl mx-auto">
              {t('landing.pricing.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">

            {/* Free Plan */}
            <motion.div
              className="bg-white dark:bg-[#1f2937] p-8 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex flex-col justify-between shadow-sm relative"
              initial={{ opacity: 0, x: -30 }}
              animate={pricingInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6 }}
            >
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#1e1b4b]/50 dark:text-slate-400 font-display">{t('landing.pricing.free.kicker')}</span>
                <h3 className="text-2xl font-bold text-[#1e1b4b] dark:text-white font-display mt-2 mb-4">{t('landing.pricing.free.name')}</h3>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-black text-[#1e1b4b] dark:text-white font-display">€0</span>
                  <span className="text-xs text-[#1e1b4b]/60 dark:text-slate-400">{t('landing.pricing.free.period')}</span>
                </div>
                <ul className="space-y-4 text-xs sm:text-sm font-light text-[#1e1b4b]/80 dark:text-slate-200">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-[#2ecc71] stroke-[1.75]" />
                    <span>{t('landing.pricing.free.feature1')}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-[#2ecc71] stroke-[1.75]" />
                    <span>{t('landing.pricing.free.feature2')}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-[#2ecc71] stroke-[1.75]" />
                    <span>{t('landing.pricing.free.feature3')}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-[#2ecc71] stroke-[1.75]" />
                    <span>{t('landing.pricing.free.feature4')}</span>
                  </li>
                </ul>
              </div>
              <Link
                href={session ? "/dashboard" : "/register"}
                className="w-full mt-8 bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 hover:bg-[#fafafa] dark:hover:bg-[#1f2937]/80 text-[#1e1b4b] dark:text-slate-200 text-center font-bold py-3.5 rounded-[8px] transition-all shadow-sm font-display text-sm"
              >
                {t('landing.pricing.free.cta')}
              </Link>
            </motion.div>

            {/* PRO Plan (Interactive Highlight + Shimmer Button) */}
            <motion.div
              className="bg-white dark:bg-[#1f2937] p-8 rounded-[12px] border border-[#8b5cf6]/40 relative flex flex-col justify-between transition-shadow duration-700"
              style={{
                boxShadow: pricingInView
                  ? '0 0 50px -12px rgba(139, 92, 246, 0.45)'
                  : '0 4px 6px -1px rgba(0,0,0,0.05)',
              }}
              initial={{ opacity: 0, x: 30 }}
              animate={pricingInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6 }}
            >
              {/* Badge Recommended */}
              <div className="absolute -top-3 right-6 bg-gradient-to-r from-[#8b5cf6] to-[#2ecc71] text-white text-[10px] font-black uppercase tracking-wider px-3.5 py-1 rounded-full font-display shadow-md shadow-[#8b5cf6]/20">
                {t('landing.pricing.pro.badge')}
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#8b5cf6] font-display">{t('landing.pricing.pro.kicker')}</span>
                <h3 className="text-2xl font-bold text-[#1e1b4b] dark:text-white font-display mt-2 mb-4">{t('landing.pricing.pro.name')}</h3>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-black text-[#1e1b4b] dark:text-white font-display">€10</span>
                  <span className="text-xs text-[#1e1b4b]/60 dark:text-slate-400">{t('landing.pricing.pro.period')}</span>
                </div>
                <ul className="space-y-4 text-xs sm:text-sm font-light text-[#1e1b4b]/80 dark:text-slate-200">
                  <li className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-[#2ecc71] stroke-[1.75]" />
                    <span className="font-semibold text-[#1e1b4b] dark:text-white">{t('landing.pricing.pro.feature1')}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-[#2ecc71] stroke-[1.75]" />
                    <span>{t('landing.pricing.pro.feature2')}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-[#2ecc71] stroke-[1.75]" />
                    <span>{t('landing.pricing.pro.feature3')}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-[#2ecc71] stroke-[1.75]" />
                    <span className="font-semibold text-[#1e1b4b] dark:text-white">{t('landing.pricing.pro.feature4')}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-[#2ecc71] stroke-[1.75]" />
                    <span>{t('landing.pricing.pro.feature5')}</span>
                  </li>
                </ul>
              </div>

              {session ? (
                <a
                  href="/api/stripe/checkout"
                  className="w-full mt-8 bg-[#1e1b4b] dark:bg-white text-white dark:text-[#0b0f19] text-center font-extrabold py-4 rounded-[8px] transition-all shadow-md shadow-[#1e1b4b]/10 dark:shadow-white/5 font-display text-sm hover-shimmer-btn"
                >
                  {t('landing.pricing.pro.checkoutCta')}
                </a>
              ) : (
                <Link
                  href="/register"
                  className="w-full mt-8 bg-[#1e1b4b] dark:bg-white text-white dark:text-[#0b0f19] text-center font-extrabold py-4 rounded-[8px] transition-all shadow-md shadow-[#1e1b4b]/10 dark:shadow-white/5 font-display text-sm hover-shimmer-btn"
                >
                  {t('landing.pricing.pro.registerCta')}
                </Link>
              )}
            </motion.div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-[#1e1b4b]/10 dark:border-white/10 text-center text-xs text-[#1e1b4b]/40 dark:text-slate-500 font-light bg-[#fafafa] dark:bg-[#0b0f19] transition-colors duration-300 relative z-10">
        <p>&copy; {new Date().getFullYear()} Matchply. {t('landing.footer.tagline')}</p>
      </footer>
    </div>
  );
}
