"use client";

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { deleteCv, duplicateCv, renameCv } from '@/app/dashboard/actions';
import AlertModal from '@/components/ui/AlertModal';
import { Button } from '@/components/ui/Button';
import { ModalScrim } from '@/components/ui/ModalScrim';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export type EditorCvChoice = {
  id: string;
  title: string;
  isBase: boolean;
  isPrincipal: boolean;
};

export default function EditorCvMenu({
  cvId,
  title,
  isGuest,
  choices,
  onTitleChange,
  onOpenChange,
}: {
  cvId: string;
  title: string;
  isGuest: boolean;
  choices: EditorCvChoice[];
  onTitleChange: (title: string) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [draft, setDraft] = useState(title);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState<'rename' | 'duplicate' | 'delete' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const setMenuOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
    if (!next) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setMenuOpen(false);
      }
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  useEffect(() => {
    if (renameOpen) renameInputRef.current?.focus();
  }, [renameOpen]);

  const saveRename = async () => {
    setPending('rename');
    setRenameError(null);
    const result = await renameCv(cvId, draft);
    setPending(null);
    if (!result.success || !result.title) {
      setRenameError(result.error === 'INVALID_TITLE' || result.error === 'TITLE_TOO_LONG'
        ? t('editor.menu.invalidTitle')
        : (result.error || t('editor.menu.invalidTitle')));
      return;
    }
    onTitleChange(result.title);
    setRenameOpen(false);
    triggerRef.current?.focus();
  };

  const duplicate = async () => {
    setPending('duplicate');
    setActionError(null);
    const result = await duplicateCv(cvId);
    setPending(null);
    if (result.success && result.cvId) {
      setMenuOpen(false);
      router.push(`/editor/${result.cvId}`);
      return;
    }
    setActionError(result.error || t('editor.footer.error'));
  };

  const remove = async () => {
    setPending('delete');
    const result = await deleteCv(cvId);
    setPending(null);
    if (result.success) {
      router.push(isGuest ? '/try' : '/dashboard');
    }
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="min-h-11 inline-flex items-center gap-1.5 rounded-[8px] px-2 text-left hover:bg-surface-muted"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setMenuOpen(!open)}
      >
        <span className="font-display text-sm font-bold text-text">{title}</span>
        <ChevronDown className="w-4 h-4 text-text-muted stroke-[1.75]" aria-hidden />
        <span className="sr-only">{t('editor.menu.label')}</span>
      </button>
      {open && (
        <div
          ref={panelRef}
          id={menuId}
          role="menu"
          aria-label={t('editor.menu.label')}
          className="absolute left-0 top-full z-40 mt-1 w-72 max-h-[70vh] overflow-y-auto rounded-[12px] border border-subtle bg-surface p-2 shadow-dialog"
        >
          <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">{t('editor.menu.switch')}</p>
          {choices.map((choice) => (
            <Link
              key={choice.id}
              role="menuitem"
              href={`/editor/${choice.id}`}
              aria-current={choice.id === cvId ? 'page' : undefined}
              className={`flex items-center justify-between gap-2 rounded-[8px] px-2 py-2 text-sm min-h-11 ${choice.id === cvId ? 'bg-surface-muted font-semibold text-text' : 'text-text hover:bg-surface-muted'}`}
            >
              <span className="truncate">{choice.title}</span>
              {choice.isPrincipal && <span className="shrink-0 text-[10px] uppercase text-text-muted">{t('editor.menu.principal')}</span>}
            </Link>
          ))}
          <div className="my-1 border-t border-subtle" />
          <button
            type="button"
            role="menuitem"
            className="w-full text-left rounded-[8px] px-2 py-2 text-sm min-h-11 hover:bg-surface-muted"
            onClick={() => {
              setDraft(title);
              setRenameError(null);
              setRenameOpen(true);
              setMenuOpen(false);
            }}
          >
            {t('editor.menu.rename')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full text-left rounded-[8px] px-2 py-2 text-sm min-h-11 hover:bg-surface-muted disabled:opacity-50"
            disabled={pending === 'duplicate'}
            onClick={duplicate}
          >
            {t('editor.menu.duplicate')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full text-left rounded-[8px] px-2 py-2 text-sm min-h-11 text-danger-text hover:bg-danger-surface"
            onClick={() => {
              setMenuOpen(false);
              setDeleteOpen(true);
            }}
          >
            {t('editor.menu.delete')}
          </button>
          {actionError && <p className="px-2 py-1 text-sm text-danger-text" role="alert">{actionError}</p>}
        </div>
      )}

      {renameOpen && (
        <ModalScrim>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-cv-title"
            className="w-full max-w-md rounded-2xl border border-subtle bg-surface p-6 shadow-dialog"
          >
            <h2 id="rename-cv-title" className="font-display text-lg font-bold text-text">{t('editor.menu.renameTitle')}</h2>
            <label className="mt-4 block">
              <span className="sr-only">{t('editor.menu.renameTitle')}</span>
              <input
                ref={renameInputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void saveRename();
                  }
                }}
                maxLength={120}
                className="w-full min-h-11 rounded-[8px] border border-control bg-canvas px-3 text-sm text-text"
              />
            </label>
            {renameError && <p className="mt-2 text-sm text-danger-text" role="alert">{renameError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => { setRenameOpen(false); triggerRef.current?.focus(); }}>
                {t('editor.menu.renameCancel')}
              </Button>
              <Button type="button" variant="strong" loading={pending === 'rename'} onClick={() => void saveRename()}>
                {t('editor.menu.renameSave')}
              </Button>
            </div>
          </div>
        </ModalScrim>
      )}

      <AlertModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        type="danger"
        title={t('editor.menu.deleteTitle')}
        message={t('editor.menu.deleteMessage', { title })}
        confirmLabel={t('editor.menu.deleteConfirm')}
        cancelLabel={t('editor.menu.renameCancel')}
        isPending={pending === 'delete'}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
