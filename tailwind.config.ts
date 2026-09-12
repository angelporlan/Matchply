import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Outfit', 'sans-serif'],
      },
      colors: {
        canvas: 'var(--canvas)',
        surface: {
          DEFAULT: 'var(--surface)',
          muted: 'var(--surface-muted)',
        },
        text: {
          DEFAULT: 'var(--text)',
          muted: 'var(--text-muted)',
        },
        subtle: 'var(--border-subtle)',
        control: 'var(--border-control)',
        focus: 'var(--focus)',
        border: 'var(--border-subtle)',
        input: 'var(--border-control)',
        ring: 'var(--focus)',
        background: 'var(--canvas)',
        foreground: 'var(--text)',
        action: {
          DEFAULT: 'var(--action)',
          hover: 'var(--action-hover)',
        },
        'on-action': 'var(--on-action)',
        ai: {
          DEFAULT: 'var(--ai-accent)',
          action: 'var(--ai-action)',
          hover: 'var(--ai-hover)',
          text: 'var(--ai-text)',
          surface: 'var(--ai-surface)',
        },
        'on-ai-action': 'var(--on-ai-action)',
        success: {
          text: 'var(--success-text)',
          surface: 'var(--success-surface)',
        },
        warning: {
          text: 'var(--warning-text)',
          surface: 'var(--warning-surface)',
        },
        danger: {
          text: 'var(--danger-text)',
          surface: 'var(--danger-surface)',
        },
        info: {
          text: 'var(--info-text)',
          surface: 'var(--info-surface)',
        },
      },
      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '6px',
      },
      boxShadow: {
        card: '0 2px 8px rgba(30, 27, 75, 0.04)',
        dialog: '0 16px 48px rgba(11, 15, 25, 0.18)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.02)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-subtle': 'pulse-subtle 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
