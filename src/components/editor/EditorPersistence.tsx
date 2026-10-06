'use client';
import { createContext, useContext, useEffect, useRef } from 'react';
import { saveCvContent } from '@/app/dashboard/actions';
import type { VariantSaveContext } from '@/lib/cv-optimization/types';

export const EditorPersistenceContext = createContext(false);
export const useManagedEditorSave = () => useContext(EditorPersistenceContext);

/** One serialized writer for sheet, Markdown and section forms. */
export function useEditorPersistence(cvId: string, initial: string, context: VariantSaveContext | undefined,
  status: (state: 'saved' | 'saving' | 'error') => void, error: (message: string) => void) {
  const draft = useRef(initial);
  const saved = useRef(initial);
  const ctx = useRef(context);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<boolean> | null>(null);
  const callbacks = useRef({ status, error }); callbacks.current = { status, error };
  const reset = (content: string, next?: VariantSaveContext) => {
    if (timer.current) clearTimeout(timer.current);
    draft.current = content; saved.current = content; ctx.current = next;
  };
  const flush = (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    if (inflight.current) return inflight.current.then(ok => ok ? flush() : false);
    if (draft.current === saved.current) return Promise.resolve(true);
    const content = draft.current; const captured = ctx.current ? { ...ctx.current } : undefined;
    callbacks.current.status('saving');
    inflight.current = (async () => {
      try {
        const result = await saveCvContent(cvId, content, captured);
        if (!result.success) { callbacks.current.status('error'); callbacks.current.error(result.error || 'No se pudo guardar.'); return false; }
        saved.current = content;
        if (captured && result.revision !== undefined) ctx.current = { ...captured, revision: result.revision };
        callbacks.current.status(draft.current === content ? 'saved' : 'saving');
        return true;
      } catch { callbacks.current.status('error'); callbacks.current.error('No se pudo guardar. Conserva tu borrador y reintenta.'); return false; }
    })();
    return inflight.current.then(ok => { inflight.current = null; return ok && draft.current !== saved.current ? flush() : ok; });
  };
  const changed = (content: string) => {
    if (content === draft.current) return;
    draft.current = content; callbacks.current.status('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, 900);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); void flush(); }, [cvId]); // eslint-disable-line react-hooks/exhaustive-deps
  return { changed, flush, reset };
}
