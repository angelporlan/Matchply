"use client";

import { useState, useRef, useEffect } from 'react';
import { 
  Minus, 
  Plus, 
  Type, 
  MoveHorizontal, 
  ChevronDown,
  Maximize2,
  FileCode2,
  GitCompare,
  Sparkles
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { PdfZoom } from './PdfViewer';
import { OPTIMIZE_MODE_IDS, type OptimizeModeId } from '@/lib/optimize-modes';
import type { CvVariant } from '@/lib/cv-optimization/types';

const COLOR_PRESETS = [
  { name: 'Classic Blue', hex: '#1e3a8a' },
  { name: 'Teal Depth', hex: '#0f766e' },
  { name: 'Emerald', hex: '#047857' },
  { name: 'Burgundy', hex: '#881337' },
  { name: 'Slate Gray', hex: '#334155' },
  { name: 'Warm Amber', hex: '#b45309' },
];

export function bodyPointSize(scale: number): string {
  return String(Number((scale * 9).toFixed(6)));
}

function PointValueInput({ value, min, max, label, onChange }: {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const commit = (raw: string) => {
    const parsed = Number(raw);
    if (!raw.trim() || !Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = Math.min(max, Math.max(min, parsed));
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <label className="flex shrink-0 items-center gap-1 font-mono text-ai-action cursor-text">
      <input
        type="number"
        inputMode="decimal"
        aria-label={`${label} (pt)`}
        title={`${min}–${max} pt · Enter para aplicar, Escape para cancelar`}
        min={min}
        max={max}
        step="any"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={(event) => commit(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.value = String(value);
            setDraft(String(value));
            event.currentTarget.blur();
          }
        }}
        style={{ width: `${Math.max(draft.length, 1)}ch`, font: 'inherit' }}
        className="appearance-none rounded-none border-0 bg-transparent p-0 text-right text-inherit cursor-text [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      />
      <span aria-hidden="true">pt</span>
    </label>
  );
}

export default function EditorFormatBar({
  fontFamily,
  pageMargin,
  scale,
  accentColor,
  onFontChange,
  onMarginChange,
  onScaleChange,
  onAccentChange,
  zoom,
  onZoomChange,
  saveLabel,
  surface = 'document',
  onToggleMarkdown,
  hasDiff = false,
  onToggleDiff,
  variants,
  activeMode,
  onSelectVariant,
  onRetryVariant,
  variantBusy = false,
}: {
  fontFamily: string;
  pageMargin: number;
  scale: number;
  accentColor: string;
  onFontChange: (value: string) => void;
  onMarginChange: (value: number) => void;
  onScaleChange: (value: number) => void;
  onAccentChange: (value: string) => void;
  zoom: PdfZoom;
  onZoomChange: (zoom: PdfZoom) => void;
  saveLabel: string;
  surface?: 'document' | 'source' | 'diff';
  onToggleMarkdown?: () => void;
  hasDiff?: boolean;
  onToggleDiff?: () => void;
  variants?: Array<Pick<CvVariant, 'modeId' | 'status' | 'error'>>;
  activeMode?: OptimizeModeId;
  onSelectVariant?: (mode: OptimizeModeId) => void;
  onRetryVariant?: (mode: OptimizeModeId) => void;
  variantBusy?: boolean;
}) {
  const { t } = useLanguage();

  // Popover state for active menu
  const [openPopover, setOpenPopover] = useState<'font' | 'margin' | 'color' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const focused = document.activeElement;
        if (focused instanceof HTMLInputElement && containerRef.current.contains(focused)) {
          focused.blur();
        }
        setOpenPopover(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const points = bodyPointSize(scale);
  const zoomPercent = zoom === 'fit' ? 100 : zoom;

  const stepZoom = (direction: -1 | 1) => {
    const current = zoom === 'fit' ? 100 : zoom;
    onZoomChange(Math.min(150, Math.max(50, current + direction * 10)));
  };

  const fontName = 
    fontFamily === 'times' 
      ? t('editor.toolbar.fonts.times') 
      : fontFamily === 'courier' 
        ? t('editor.toolbar.fonts.courier') 
        : t('editor.toolbar.fonts.helvetica');

  return (
    <div 
      ref={containerRef}
      className="w-full bg-surface border-b border-subtle shrink-0 px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 min-h-[38px] select-none"
    >
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        {/* Píldora 1: Tipografía y Tamaño */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenPopover(openPopover === 'font' ? null : 'font')}
            aria-expanded={openPopover === 'font'}
            aria-haspopup="true"
            className={`h-7 px-2.5 rounded-md border text-xs font-medium flex items-center gap-1.5 transition-all ${
              openPopover === 'font'
                ? 'border-ai-action bg-ai-surface text-ai-action'
                : 'border-control/50 hover:border-text text-text bg-canvas'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>{fontName}</span>
            <span className="text-text-muted font-mono text-[11px]">{points}pt</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {openPopover === 'font' && (
            <div className="absolute left-0 top-8.5 z-40 w-60 bg-surface border border-subtle rounded-xl p-3.5 shadow-dialog space-y-3">
              <div>
                <span className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                  {t('editor.toolbar.font')}
                </span>
                <select
                  value={fontFamily}
                  onChange={(e) => onFontChange(e.target.value)}
                  className="w-full bg-canvas border border-control/60 rounded-md px-2 py-1.5 text-xs text-text focus:outline-none focus:border-ai-action"
                >
                  <option value="helvetica">{t('editor.toolbar.fonts.helvetica')}</option>
                  <option value="times">{t('editor.toolbar.fonts.times')}</option>
                  <option value="courier">{t('editor.toolbar.fonts.courier')}</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-text mb-1">
                  <span>Tamaño del texto</span>
                  <PointValueInput
                    label="Tamaño del texto"
                    value={Number(points)}
                    min={5.4}
                    max={12.6}
                    onChange={(value) => onScaleChange(value / 9)}
                  />
                </div>
                <input
                  type="range"
                  aria-label="Tamaño del texto (pt)"
                  min="5.4"
                  max="12.6"
                  step="0.1"
                  value={Number(points)}
                  onChange={(e) => onScaleChange(parseFloat(e.target.value) / 9)}
                  className="w-full accent-text cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-text-muted mt-1">
                  <span>Compacto (5.4pt)</span>
                  <span>Grande (12.6pt)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Píldora 2: Margen */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenPopover(openPopover === 'margin' ? null : 'margin')}
            aria-expanded={openPopover === 'margin'}
            aria-haspopup="true"
            className={`h-7 px-2.5 rounded-md border text-xs font-medium flex items-center gap-1.5 transition-all ${
              openPopover === 'margin'
                ? 'border-ai-action bg-ai-surface text-ai-action'
                : 'border-control/50 hover:border-text text-text bg-canvas'
            }`}
          >
            <MoveHorizontal className="w-3.5 h-3.5" />
            <span>Margen</span>
            <span className="text-text-muted font-mono text-[11px]">{pageMargin}pt</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {openPopover === 'margin' && (
            <div className="absolute left-0 top-8.5 z-40 w-52 bg-surface border border-subtle rounded-xl p-3.5 shadow-dialog">
              <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-text mb-1.5">
                <span>Margen de página</span>
                <PointValueInput
                  label="Margen de página"
                  value={pageMargin}
                  min={18}
                  max={72}
                  onChange={onMarginChange}
                />
              </div>
              <input
                type="range"
                aria-label="Margen de página (pt)"
                min="18"
                max="72"
                step="0.1"
                value={pageMargin}
                onChange={(e) => onMarginChange(parseFloat(e.target.value))}
                className="w-full accent-text cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-text-muted mt-1">
                <span>Estrecho (18pt)</span>
                <span>Ancho (72pt)</span>
              </div>
            </div>
          )}
        </div>

        {/* Píldora 3: Color de acento */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenPopover(openPopover === 'color' ? null : 'color')}
            aria-expanded={openPopover === 'color'}
            aria-haspopup="true"
            className={`h-7 px-2.5 rounded-md border text-xs font-medium flex items-center gap-1.5 transition-all ${
              openPopover === 'color'
                ? 'border-ai-action bg-ai-surface text-ai-action'
                : 'border-control/50 hover:border-text text-text bg-canvas'
            }`}
          >
            <span
              className="w-3.5 h-3.5 rounded-full border border-black/20"
              style={{ backgroundColor: accentColor }}
            />
            <span>Color</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {openPopover === 'color' && (
            <div className="absolute left-0 top-8.5 z-40 w-56 bg-surface border border-subtle rounded-xl p-3.5 shadow-dialog">
              <span className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
                Color de encabezados
              </span>
              <div className="grid grid-cols-6 gap-2 mb-2.5">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => onAccentChange(preset.hex)}
                    className="p-1 rounded hover:bg-surface-muted flex items-center justify-center transition-transform hover:scale-105"
                    title={preset.name}
                  >
                    <span
                      className={`w-5 h-5 rounded-full border border-black/20 ${
                        accentColor.toLowerCase() === preset.hex.toLowerCase()
                          ? 'ring-2 ring-text ring-offset-1 scale-105'
                          : ''
                      }`}
                      style={{ backgroundColor: preset.hex }}
                    />
                  </button>
                ))}
              </div>
              <label className="flex items-center justify-between text-xs text-text font-medium pt-2 border-t border-subtle cursor-pointer">
                <span>Personalizado</span>
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => onAccentChange(e.target.value)}
                  className="w-6 h-6 rounded border border-control cursor-pointer p-0"
                />
              </label>
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-subtle" />

        {/* Zoom Segmentado Continuo */}
        <div className="flex items-center bg-surface-muted rounded-md border border-subtle p-0.5">
          <button
            type="button"
            onClick={() => stepZoom(-1)}
            className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text hover:bg-surface transition-colors"
            title={t('editor.toolbar.zoomOut')}
          >
            <Minus className="w-3 h-3 stroke-[2]" />
          </button>
          <button
            type="button"
            onClick={() => onZoomChange(100)}
            className={`w-11 h-6 text-[11px] font-mono rounded transition-colors flex items-center justify-center ${
              zoom === 100 ? 'bg-surface font-semibold text-text shadow-xs' : 'text-text-muted hover:text-text'
            }`}
            title="Restablecer zoom al 100%"
          >
            {zoomPercent}%
          </button>
          <button
            type="button"
            onClick={() => stepZoom(1)}
            className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text hover:bg-surface transition-colors"
            title={t('editor.toolbar.zoomIn')}
          >
            <Plus className="w-3 h-3 stroke-[2]" />
          </button>

          <div className="w-px h-3.5 bg-subtle mx-0.5" />

          <button
            type="button"
            onClick={() => onZoomChange(zoom === 'fit' ? 100 : 'fit')}
            className={`px-2 h-6 text-[11px] font-medium rounded flex items-center gap-1 transition-colors ${
              zoom === 'fit' ? 'bg-surface font-semibold text-text shadow-xs' : 'text-text-muted hover:text-text'
            }`}
            title="Ajustar automáticamente al ancho de pantalla"
          >
            <Maximize2 className="w-3 h-3" />
            <span>{t('editor.toolbar.fit')}</span>
          </button>
        </div>

        {/* Modos de visualización: Markdown y Cambios (Diff) como iconos */}
        {(onToggleMarkdown || (hasDiff && onToggleDiff)) && (
          <>
            <div className="w-px h-4 bg-subtle" />

            <div className="flex items-center gap-1">
              {onToggleMarkdown && (
                <button
                  type="button"
                  onClick={onToggleMarkdown}
                  aria-pressed={surface === 'source'}
                  className={`h-7 px-2 rounded-md border flex items-center gap-1.5 transition-all text-xs font-medium ${
                    surface === 'source'
                      ? 'border-ai-action bg-ai-surface text-ai-action shadow-xs font-semibold'
                      : 'border-control/50 hover:border-text text-text-muted hover:text-text bg-canvas'
                  }`}
                  title={surface === 'source' ? 'Volver al diseño del documento' : 'Ver editor Markdown'}
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  <span className="sr-only">Markdown</span>
                </button>
              )}

              {hasDiff && onToggleDiff && (
                <button
                  type="button"
                  onClick={onToggleDiff}
                  aria-pressed={surface === 'diff'}
                  className={`h-7 px-2 rounded-md border flex items-center gap-1.5 transition-all text-xs font-medium ${
                    surface === 'diff'
                      ? 'border-ai-action bg-ai-surface text-ai-action shadow-xs font-semibold'
                      : 'border-control/50 hover:border-text text-text-muted hover:text-text bg-canvas'
                  }`}
                  title={surface === 'diff' ? 'Volver al diseño del documento' : 'Ver comparativa de cambios'}
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  <span className="sr-only">Cambios</span>
                </button>
              )}
            </div>
          </>
        )}
        {variants && (
          <div role="group" aria-label={t('variants.label')} className="flex flex-wrap items-center gap-1 border-l border-subtle pl-2">
            {OPTIMIZE_MODE_IDS.map(mode => {
              const variant = variants.find(v => v.modeId === mode);
              return <div key={mode} className="flex items-center gap-1">
                <button type="button" aria-pressed={activeMode === mode && variant?.status === 'ready'} disabled={variantBusy || !variant || ['pending', 'generating', 'error'].includes(variant.status)}
                  title={t(`variants.descriptions.${mode}`)}
                  onClick={() => onSelectVariant?.(mode)}
                  className={`min-h-11 px-2.5 rounded-[8px] text-xs font-semibold border transition-colors disabled:opacity-50 ${activeMode === mode ? 'bg-surface-muted border-control text-text' : 'bg-canvas border-subtle text-text-muted hover:text-text'}`}>
                  {variant?.status === 'idle' && <Sparkles className="mr-1 inline h-3.5 w-3.5" aria-hidden />}{t(`variants.names.${mode}`)}{variant && !['ready','idle'].includes(variant.status) && <span className="ml-1 font-normal">· {t(`variants.status.${variant.status}`)}</span>}
                </button>
                {variant?.status === 'error' && <button type="button" disabled={variantBusy} onClick={() => onRetryVariant?.(mode)} aria-label={`${t('variants.retry')}: ${t(`variants.names.${mode}`)}`} className="min-h-11 px-2 text-xs font-semibold text-text underline disabled:opacity-50">{t('variants.retry')}</button>}
              </div>;
            })}
          </div>
        )}
      </div>

      {/* Estado de guardado / persistencia */}
      <p className="shrink-0 text-xs text-text-muted font-medium ml-auto" aria-live="polite">
        {saveLabel}
      </p>
    </div>
  );
}
