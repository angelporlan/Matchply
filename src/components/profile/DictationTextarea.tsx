"use client";

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Mic, MicOff } from 'lucide-react';

type SpeechRecognitionAlternativeLike = { transcript: string };
type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
  length: number;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};
type SpeechRecognitionErrorLike = { error: string };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

function joinSpoken(base: string, spoken: string) {
  const spokenClean = spoken.replace(/\s+/g, ' ').trim();
  if (!spokenClean) return base;
  if (!base.trim()) return spokenClean;
  const separator = /[\s\n]$/.test(base) ? '' : ' ';
  return `${base}${separator}${spokenClean}`;
}

interface DictationTextareaProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  label: string;
}

export default function DictationTextarea({
  id,
  value,
  onChange,
  placeholder,
  rows = 8,
  label,
}: DictationTextareaProps) {
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  const prefixRef = useRef(value);
  const committedRef = useRef('');
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    setSupported(!!getSpeechRecognitionCtor());
  }, []);

  useEffect(() => {
    return () => {
      listeningRef.current = false;
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  const stopListening = () => {
    listeningRef.current = false;
    setListening(false);
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
  };

  const startListening = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      setHint('Tu navegador no soporta dictado. Usa Chrome o Edge, o pega el texto.');
      return;
    }

    setHint(null);
    prefixRef.current = valueRef.current;
    committedRef.current = '';

    const recognition = new Ctor();
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      let newlyFinal = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || '';
        if (result.isFinal) newlyFinal += transcript;
        else interim += transcript;
      }
      if (newlyFinal) {
        committedRef.current = joinSpoken(committedRef.current, newlyFinal);
      }
      onChange(joinSpoken(prefixRef.current, joinSpoken(committedRef.current, interim)));
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setHint('No hay permiso de micrófono. Actívalo en el navegador para dictar.');
        stopListening();
        return;
      }
      if (event.error === 'network') {
        setHint('Error de red en el reconocimiento de voz. Prueba de nuevo o pega el texto.');
        stopListening();
        return;
      }
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      setHint('No se pudo transcribir el audio. Pega el texto o inténtalo otra vez.');
    };

    recognition.onend = () => {
      if (!listeningRef.current) return;
      try {
        recognition.start();
      } catch {
        stopListening();
      }
    };

    recognitionRef.current = recognition;
    listeningRef.current = true;
    setListening(true);
    try {
      recognition.start();
    } catch {
      setHint('No se pudo iniciar el micrófono. Revisa los permisos del navegador.');
      stopListening();
    }
  };

  const toggleListening = () => {
    if (listeningRef.current) {
      stopListening();
      return;
    }
    startListening();
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="block text-xs font-bold text-[#1e1b4b] dark:text-white font-display">
          {label}
        </label>
        <button
          type="button"
          onClick={toggleListening}
          disabled={supported !== true}
          aria-pressed={listening}
          aria-label={listening ? 'Detener dictado' : 'Dictar por micrófono'}
          title={
            supported === false
              ? 'Dictado no disponible en este navegador'
              : listening
                ? 'Detener dictado'
                : 'Dictar (Chrome / Edge)'
          }
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
            listening
              ? 'bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/40 shadow-sm shadow-[#8B5CF6]/20 animate-pulse'
              : 'bg-[#fafafa] dark:bg-[#0b0f19] text-[#8B5CF6] border-[#8B5CF6]/25 hover:border-[#8B5CF6]/50 hover:bg-[#8B5CF6]/5'
          }`}
        >
          {listening ? (
            <MicOff className="w-3.5 h-3.5 stroke-[1.75]" />
          ) : (
            <Mic className="w-3.5 h-3.5 stroke-[1.75]" />
          )}
          <span>{listening ? 'Escuchando…' : 'Dictar'}</span>
        </button>
      </div>

      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(event) => {
          if (listeningRef.current) stopListening();
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        className="w-full rounded-xl bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3.5 py-2.5 text-xs text-[#1e1b4b] dark:text-white placeholder-[#1e1b4b]/35 dark:placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6] transition-all font-sans leading-relaxed resize-y min-h-[140px]"
      />

      {hint && (
        <p className="flex items-start gap-1.5 text-[11px] text-[#1e1b4b]/70 dark:text-slate-400 font-sans">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 stroke-[1.75]" />
          <span>{hint}</span>
        </p>
      )}
    </div>
  );
}
