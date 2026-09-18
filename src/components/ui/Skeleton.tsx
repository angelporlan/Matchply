import { cn } from '@/lib/utils';

export function Bone({ className }: { className?: string }) {
  return <span aria-hidden className={cn('skeleton-bone block rounded-[8px]', className)} />;
}

export function times(count: number) {
  return Array.from({ length: count }, (_, index) => index);
}

export function ScreenBusy({ label = 'Cargando' }: { label?: string }) {
  return (
    <span className="sr-only" role="status" aria-live="polite">
      {label}
    </span>
  );
}
