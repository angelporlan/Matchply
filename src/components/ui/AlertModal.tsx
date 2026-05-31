"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, X, Sparkles, Loader2 } from 'lucide-react';

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

  // Cerrar al pulsar la tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isPending) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isPending]);

  // Bloquear el scroll de la página de fondo al estar abierto
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

  // Configuración de estilos e iconos basados en el tipo
  const getConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-400" />,
          glow: 'bg-emerald-500/5',
          border: 'border-emerald-500/20 hover:border-emerald-500/30',
          badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          accentColor: 'text-emerald-400',
          btnConfirm: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/20 focus:ring-emerald-500',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-400" />,
          glow: 'bg-amber-500/5',
          border: 'border-amber-500/20 hover:border-amber-500/30',
          badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          accentColor: 'text-amber-400',
          btnConfirm: 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/20 focus:ring-amber-500',
        };
      case 'danger':
        return {
          icon: <AlertCircle className="w-6 h-6 text-rose-400" />,
          glow: 'bg-rose-500/5',
          border: 'border-rose-500/20 hover:border-rose-500/30',
          badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          accentColor: 'text-rose-400',
          btnConfirm: 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/20 focus:ring-rose-500',
        };
      case 'info':
      default:
        return {
          icon: <Sparkles className="w-6 h-6 text-sky-400" />,
          glow: 'bg-sky-500/5',
          border: 'border-slate-800/80 hover:border-sky-500/20',
          badgeBg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
          accentColor: 'text-sky-400',
          btnConfirm: 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-sky-950/20 focus:ring-sky-500',
        };
    }
  };

  const config = getConfig();

  // Prevenir clics dentro del modal de cerrar el mismo
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node) && !isPending) {
      onClose();
    }
  };

  // Prevenir propagación de eventos al componente padre (como tarjetas drag-and-drop o contenedores interactivos)
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity duration-300 animate-fadeIn"
    >
      <div
        ref={modalRef}
        className={`w-full max-w-md bg-[#070b17] border rounded-2xl p-6 md:p-7 shadow-2xl shadow-black/80 relative overflow-hidden transition-all duration-300 transform scale-100 ${config.border}`}
      >
        {/* Glow effects de fondo */}
        <div className={`absolute top-[-20%] right-[-20%] w-48 h-48 rounded-full filter blur-[60px] pointer-events-none ${config.glow}`} />
        <div className="absolute bottom-[-10%] left-[-10%] w-40 h-40 bg-indigo-500/5 rounded-full filter blur-[50px] pointer-events-none" />

        {/* Botón de cierre en esquina superior derecha */}
        {!isPending && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-450 hover:text-white p-1.5 rounded-lg hover:bg-slate-900/60 border border-transparent hover:border-slate-800/60 transition-all"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Cabecera / Icono e Información */}
        <div className="flex items-start gap-4 mt-2">
          <div className={`p-2.5 rounded-xl border shrink-0 ${config.badgeBg}`}>
            {config.icon}
          </div>
          <div className="space-y-1.5 flex-1 pr-6">
            <h3 className="text-base font-bold text-white tracking-tight Outfit font-display">
              {title}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-light font-sans whitespace-pre-line">
              {message}
            </p>
          </div>
        </div>

        {/* Acciones principales (Botones) */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-900/80">
          {onConfirm ? (
            // Variante Confirm (Dos botones)
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-transparent border border-slate-900 hover:bg-slate-900/60 hover:border-slate-800 transition-all disabled:opacity-40"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isPending}
                className={`flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all transform hover:-translate-y-0.5 shadow-lg active:translate-y-0 focus:outline-none focus:ring-1 disabled:opacity-50 disabled:pointer-events-none ${config.btnConfirm}`}
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {confirmLabel || 'Confirmar'}
              </button>
            </>
          ) : (
            // Variante Alert (Un solo botón)
            <button
              type="button"
              onClick={onClose}
              className={`w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all text-center focus:outline-none focus:ring-1 ${config.btnConfirm}`}
            >
              {confirmLabel || 'Entendido'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
