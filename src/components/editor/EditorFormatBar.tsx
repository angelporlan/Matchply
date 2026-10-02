"use client";

import { Minus, Plus } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { PdfZoom } from './PdfViewer';

const COLOR_PRESETS = [
  { name: 'Classic Blue', hex: '#1e3a8a' },
  { name: 'Teal Depth', hex: '#0f766e' },
  { name: 'Emerald', hex: '#047857' },
  { name: 'Burgundy', hex: '#881337' },
  { name: 'Slate Gray', hex: '#334155' },
  { name: 'Warm Amber', hex: '#b45309' },
];

export function bodyPointSize(scale: number): string {
  const points = Math.round(scale * 9 * 10) / 10;
  return Number.isInteger(points) ? String(points) : points.toFixed(1);
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
}) {
  const { t } = useLanguage();
  const points = bodyPointSize(scale);
  const zoomPercent = zoom === 'fit' ? 100 : zoom;
  const zoomReadout = zoom === 'fit' ? t('editor.toolbar.fit') : `${zoomPercent}%`;

  const stepZoom = (direction: -1 | 1) => {
    const current = zoom === 'fit' ? 100 : zoom;
    onZoomChange(Math.min(150, Math.max(50, current + direction * 10)));
  };

  return (
    <div className="w-full bg-surface border-b border-subtle flex items-stretch shrink-0">
    <div className="min-w-0 flex-1 overflow-x-auto">
    <div className="w-max lg:w-auto px-4 sm:px-6 py-2 flex flex-nowrap lg:flex-wrap items-end gap-x-4 gap-y-3">
      <label className="flex flex-col gap-1 min-w-[9rem] shrink-0">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider font-display">{t('editor.toolbar.font')}</span>
        <select
          value={fontFamily}
          onChange={(event) => onFontChange(event.target.value)}
          className="bg-canvas border border-control rounded-[8px] px-2 min-h-11 text-sm text-text focus:outline-none focus:border-text"
        >
          <option value="helvetica">{t('editor.toolbar.fonts.helvetica')}</option>
          <option value="times">{t('editor.toolbar.fonts.times')}</option>
          <option value="courier">{t('editor.toolbar.fonts.courier')}</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 shrink-0">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider font-display">
          {t('editor.toolbar.printSize').replace('{size}', points)}
        </span>
        <input
          type="range"
          min="0.6"
          max="1.4"
          step="0.1"
          value={scale}
          onChange={(event) => onScaleChange(parseFloat(event.target.value))}
          aria-valuemin={0.6}
          aria-valuemax={1.4}
          aria-valuenow={scale}
          aria-valuetext={t('editor.toolbar.printSize').replace('{size}', points)}
          className="w-28 accent-text min-h-11 cursor-pointer"
        />
      </label>

      <label className="flex flex-col gap-1 shrink-0">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider font-display">
          {t('editor.toolbar.margin').replace('{margin}', String(pageMargin))}
        </span>
        <input
          type="range"
          min="18"
          max="72"
          step="6"
          value={pageMargin}
          onChange={(event) => onMarginChange(parseFloat(event.target.value))}
          aria-valuemin={18}
          aria-valuemax={72}
          aria-valuenow={pageMargin}
          aria-valuetext={t('editor.toolbar.margin').replace('{margin}', String(pageMargin))}
          className="w-28 accent-text min-h-11 cursor-pointer"
        />
      </label>

      <div className="flex flex-col gap-1 shrink-0">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider font-display">{t('editor.toolbar.accent')}</span>
        <div className="flex items-center gap-1.5 min-h-11">
          {COLOR_PRESETS.map((preset) => {
            const selected = accentColor.toLowerCase() === preset.hex.toLowerCase();
            return (
              <button
                key={preset.hex}
                type="button"
                onClick={() => onAccentChange(preset.hex)}
                className="min-h-11 min-w-11 inline-flex items-center justify-center"
                aria-label={`${t('editor.toolbar.accent')} ${preset.hex}`}
                aria-pressed={selected}
              >
                <span
                  className={`w-5 h-5 rounded-full border border-black/20 ${selected ? 'ring-2 ring-text ring-offset-2 ring-offset-surface' : ''}`}
                  style={{ backgroundColor: preset.hex }}
                />
              </button>
            );
          })}
          <label className="relative min-h-11 min-w-11 inline-flex items-center justify-center cursor-pointer">
            <span className="sr-only">{t('editor.toolbar.customColor')}</span>
            <span className="w-5 h-5 rounded-full border border-control" style={{ backgroundColor: accentColor }} />
            <input
              type="color"
              value={accentColor}
              onChange={(event) => onAccentChange(event.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-1 shrink-0">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider font-display">{t('editor.toolbar.paperLabel')}</span>
        <div className="min-h-11 inline-flex items-center px-3 rounded-[8px] border border-control text-xs font-semibold text-text">
          {t('editor.toolbar.paper')}
        </div>
      </div>

      <div className="flex flex-col gap-1 shrink-0">
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider font-display">{t('editor.toolbar.screenZoom')}</span>
        <div className="flex items-center gap-1 min-h-11">
          <button
            type="button"
            onClick={() => onZoomChange('fit')}
            aria-pressed={zoom === 'fit'}
            className={`min-h-11 px-3 rounded-[8px] border text-xs font-semibold ${zoom === 'fit' ? 'border-text bg-surface-muted text-text' : 'border-control text-text-muted'}`}
          >
            {t('editor.toolbar.fit')}
          </button>
          <button
            type="button"
            onClick={() => onZoomChange(100)}
            aria-pressed={zoom === 100}
            className={`min-h-11 px-3 rounded-[8px] border text-xs font-semibold ${zoom === 100 ? 'border-text bg-surface-muted text-text' : 'border-control text-text-muted'}`}
          >
            {t('editor.toolbar.zoom100')}
          </button>
          <button
            type="button"
            onClick={() => stepZoom(-1)}
            className="min-h-11 min-w-11 rounded-[8px] border border-control text-text-muted hover:text-text flex items-center justify-center"
            aria-label={t('editor.toolbar.zoomOut')}
          >
            <Minus className="w-4 h-4 stroke-[1.75]" aria-hidden />
          </button>
          <span className="min-w-[4.5rem] text-center text-xs font-mono text-text" aria-live="polite">{zoomReadout}</span>
          <button
            type="button"
            onClick={() => stepZoom(1)}
            className="min-h-11 min-w-11 rounded-[8px] border border-control text-text-muted hover:text-text flex items-center justify-center"
            aria-label={t('editor.toolbar.zoomIn')}
          >
            <Plus className="w-4 h-4 stroke-[1.75]" aria-hidden />
          </button>
        </div>
      </div>

    </div>
    </div>
      <p className="shrink-0 self-center border-l border-subtle px-3 text-xs text-text-muted" aria-live="polite">{saveLabel}</p>
    </div>
  );
}
