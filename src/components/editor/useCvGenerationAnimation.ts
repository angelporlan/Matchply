'use client';
import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import type { OptimizeModeId } from '@/lib/optimize-modes';
type Preview = {modeId:OptimizeModeId; content:string};

/** Reveal only text already received, including fast responses that finish between polls. */
export function useCvGenerationAnimation() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const mounted = useRef(true);
  const target = useRef<Preview | null>(null);
  const visible = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drained = useRef<Array<()=>void>>([]);
  const tick = useCallback(function paint() {
    timer.current = null;
    const next = target.current;
    if (!next) { visible.current=''; setPreview(null); drained.current.splice(0).forEach(resolve=>resolve()); return; }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    visible.current = reduce ? next.content : next.content.slice(0, Math.min(next.content.length, visible.current.length + 24));
    setPreview({...next,content:visible.current});
    if (visible.current !== next.content) timer.current=setTimeout(paint,25);
    else drained.current.splice(0).forEach(resolve=>resolve());
  }, []);
  const update = useCallback((value:SetStateAction<Preview|null>) => {
    if (!mounted.current) return;
    const next = typeof value === 'function' ? value(target.current) : value;
    if (!next || next.modeId !== target.current?.modeId || !next.content.startsWith(visible.current)) visible.current='';
    target.current=next;
    if (timer.current) { clearTimeout(timer.current); timer.current=null; }
    tick();
  }, [tick]);
  const finish = useCallback((next:Preview) => {
    if (!mounted.current) return Promise.resolve();
    update(next);
    return visible.current === next.content ? Promise.resolve() : new Promise<void>(resolve=>drained.current.push(resolve));
  }, [update]);
  useEffect(()=>{
    mounted.current=true;
    return ()=>{ mounted.current=false; if (timer.current) clearTimeout(timer.current); drained.current.splice(0).forEach(resolve=>resolve()); };
  },[]);
  return {preview,update,finish};
}
