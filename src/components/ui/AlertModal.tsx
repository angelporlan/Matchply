"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export type AlertModalType = 'info' | 'warning' | 'danger' | 'success';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: AlertModalType;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  isPending?: boolean;
}

const TYPE_CONFIG: Record<
  AlertModalType,
  { icon: React.ReactNode; badge: string; variant: 'primary' | 'strong' | 'danger' }
> = {
  success: {
    icon: <CheckCircle2 className="w-5 h-5" />,
    badge: 'bg-success-surface text-success-text border-success-text/20',
    variant: 'primary',
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5" />,
    badge: 'bg-warning-surface text-warning-text border-warning-text/20',
    variant: 'strong',
  },
  danger: {
    icon: <AlertCircle className="w-5 h-5" />,
    badge: 'bg-danger-surface text-danger-text border-danger-text/20',
    variant: 'danger',
  },
  info: {
    icon: <Info className="w-5 h-5" />,
    badge: 'bg-info-surface text-info-text border-info-text/20',
    variant: 'strong',
  },
};

export default function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmLabel,
  cancelLabel = 'Cancelar',
  onConfirm,
  isPending = false,
}: AlertModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isPending) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isPending]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const config = TYPE_CONFIG[type];

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node) && !isPending) {
      onClose();
    }
  };

  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return createPortal(
    <div
      onClick={(e) => {
        e.stopPropagation();
        handleOverlayClick(e);
      }}
      onMouseDown={stopPropagation}
      onMouseUp={stopPropagation}
      onTouchStart={stopPropagation}
      onTouchEnd={stopPropagation}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm transition-opacity duration-300"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-modal-title"
        className="w-full max-w-md bg-surface border border-subtle rounded-2xl p-6 md:p-7 shadow-dialog relative overflow-hidden transition-all duration-300"
      >
        {!isPending && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-text-muted hover:text-text p-1.5 rounded-lg hover:bg-surface-muted transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4 stroke-[1.75]" />
          </button>
        )}

        <div className="flex items-start gap-4">
          <div className={`p-2.5 rounded-xl border shrink-0 ${config.badge}`}>{config.icon}</div>
          <div className="space-y-1.5 flex-1 pr-6">
            <h3 id="alert-modal-title" className="text-base font-bold text-text tracking-tight font-display">
              {title}
            </h3>
            <p className="text-sm text-text-muted leading-relaxed font-sans whitespace-pre-line">
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-subtle">
          {onConfirm ? (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isPending}>
                {cancelLabel}
              </Button>
              <Button
                type="button"
                variant={config.variant}
                size="sm"
                onClick={onConfirm}
                disabled={isPending}
                loading={isPending}
              >
                {confirmLabel || 'Confirmar'}
              </Button>
            </>
          ) : (
            <Button type="button" variant={config.variant} size="sm" onClick={onClose}>
              {confirmLabel || 'Entendido'}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
