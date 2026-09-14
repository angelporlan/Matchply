"use client";

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Lock, Pencil, RotateCcw, Save, Star, Trash2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export type ApplicationViewOption = {
  id: string;
  name: string;
  isDefault: boolean;
  isSystem: boolean;
};

interface ApplicationViewsMenuProps {
  views: ApplicationViewOption[];
  activeViewId: string;
  isDirty: boolean;
  saving?: boolean;
  onSelect: (id: string) => void;
  onSave: () => void;
  onSaveAs: (name: string) => void;
  onSetDefault: () => void;
  onDelete: () => void;
  onRevert: () => void;
}

export default function ApplicationViewsMenu({
  views,
  activeViewId,
  isDirty,
  saving = false,
  onSelect,
  onSave,
  onSaveAs,
  onSetDefault,
  onDelete,
  onRevert,
}: ApplicationViewsMenuProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isNaming, setIsNaming] = useState(false);
  const [name, setName] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activeView = views.find((view) => view.id === activeViewId) || views[0];

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsNaming(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setIsNaming(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const systemViews = views.filter((view) => view.isSystem);
  const customViews = views.filter((view) => !view.isSystem);

  const renderOption = (view: ApplicationViewOption) => {
    const isActive = view.id === activeViewId;
    return (
      <button
        key={view.id}
        type="button"
        onClick={() => {
          onSelect(view.id);
          setIsOpen(false);
        }}
        className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-[8px] text-xs font-semibold transition-colors ${
          isActive ? 'bg-canvas dark:bg-surface-muted text-text' : 'text-text-muted hover:bg-canvas dark:hover:bg-surface-muted hover:text-text'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          {view.isSystem ? <Lock className="w-3 h-3 opacity-50 stroke-[1.75] shrink-0" /> : <Save className="w-3 h-3 opacity-50 stroke-[1.75] shrink-0" />}
          <span className="truncate">{view.name}</span>
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          {view.isDefault && <Star className="w-3 h-3 text-amber-500 fill-amber-500 stroke-[1.75]" />}
          {isActive && <Check className="w-3.5 h-3.5 text-ai stroke-[2]" />}
        </span>
      </button>
    );
  };

  return (
    <div ref={containerRef} className="relative font-display">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`flex items-center gap-2 px-3 py-2.5 rounded-[8px] border text-xs font-bold transition-all shadow-sm ${
          isDirty ? 'border-ai/40 bg-ai/5 text-ai' : 'border-subtle bg-surface text-text-muted hover:text-text dark:hover:text-white'
        }`}
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 stroke-[1.75]" />}
        <span className="max-w-[160px] truncate">{activeView?.name || t('applications.views.label')}</span>
        {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-ai shrink-0" title={t('applications.views.modified')} />}
        <ChevronDown className="w-3.5 h-3.5 opacity-70 stroke-[2]" />
      </button>

      {isOpen && (
        <div role="menu" className="absolute left-0 top-full z-30 mt-1.5 w-72 rounded-[12px] border border-subtle bg-surface p-2 shadow-xl animate-in fade-in duration-100">
          <p className="px-2.5 pt-1.5 pb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">
            {t('applications.views.systemGroup')}
          </p>
          <div className="space-y-0.5">{systemViews.map(renderOption)}</div>

          {customViews.length > 0 && (
            <>
              <p className="px-2.5 pt-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                {t('applications.views.customGroup')}
              </p>
              <div className="space-y-0.5">{customViews.map(renderOption)}</div>
            </>
          )}

          <div className="mt-2 pt-2 border-t border-subtle space-y-0.5">
            {isNaming ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const cleanName = name.trim();
                  if (!cleanName) return;
                  onSaveAs(cleanName);
                  setName('');
                  setIsNaming(false);
                  setIsOpen(false);
                }}
                className="p-2 space-y-2"
              >
                <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  {t('applications.views.saveAsTitle')}
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t('applications.views.saveAsPlaceholder')}
                  maxLength={60}
                  className="w-full bg-canvas border border-control rounded-[8px] px-3 py-2 text-xs text-text placeholder-text-muted focus:outline-none focus:border-ai transition-all font-sans"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNaming(false)}
                    className="px-3 py-1.5 rounded-[8px] text-[11px] font-semibold text-text-muted hover:text-text transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={!name.trim() || saving}
                    className="px-3 py-1.5 rounded-[8px] text-[11px] font-bold bg-ai-action hover:bg-ai-hover text-on-ai-action disabled:opacity-50 transition-all"
                  >
                    {t('common.save')}
                  </button>
                </div>
              </form>
            ) : (
              <>
                {isDirty && (
                  <button
                    type="button"
                    onClick={() => {
                      onRevert();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-xs font-semibold text-text-muted hover:bg-canvas dark:hover:bg-surface-muted hover:text-text transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 stroke-[1.75]" />
                    {t('applications.views.revert')}
                  </button>
                )}

                {!activeView?.isSystem && (
                  <button
                    type="button"
                    onClick={() => {
                      onSave();
                    }}
                    disabled={saving}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-xs font-semibold text-text-muted hover:bg-canvas dark:hover:bg-surface-muted hover:text-text transition-colors disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5 stroke-[1.75]" />
                    {t('applications.views.save')}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsNaming(true)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-xs font-semibold text-text-muted hover:bg-canvas dark:hover:bg-surface-muted hover:text-text transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 stroke-[1.75]" />
                  {t('applications.views.saveAs')}
                </button>

                {!activeView?.isSystem && !activeView?.isDefault && (
                  <button
                    type="button"
                    onClick={() => {
                      onSetDefault();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-xs font-semibold text-text-muted hover:bg-canvas dark:hover:bg-surface-muted hover:text-text transition-colors"
                  >
                    <Star className="w-3.5 h-3.5 stroke-[1.75]" />
                    {t('applications.views.setDefault')}
                  </button>
                )}

                {!activeView?.isSystem && (
                  <button
                    type="button"
                    onClick={() => {
                      onDelete();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
                    {t('applications.views.delete')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
