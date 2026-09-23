'use client';

import { forwardRef } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** primary: alta (verde). ai: IA. strong: tinta, solo guardar sin IA ni alta. secondary: outline. ghost: filtros. danger: destruir. Un sólido por cabecera. */
export type ButtonVariant =
  | 'primary'
  | 'ai'
  | 'strong'
  | 'secondary'
  | 'ghost'
  | 'danger';

export type ButtonSize = 'hero' | 'md' | 'sm';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: '',
  ai: 'btn-raised--ai',
  strong: 'btn-raised--strong',
  secondary: 'btn-raised--secondary',
  ghost: 'btn-raised--ghost',
  danger: 'btn-raised--danger',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  hero: 'btn-raised--hero',
  md: '',
  sm: 'btn-raised--sm',
};

export function buttonClassName({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn('btn-raised', VARIANT_CLASS[variant], SIZE_CLASS[size], className);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={buttonClassName({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';

type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClassName({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}
