'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { isAiPromptsDebugEnabled, type AiPromptDebugRequest, type AiPromptDebugResponse } from '@/lib/ai-prompts-debug';
import AiPromptDebugModal from './AiPromptDebugModal';

interface AiPromptDebugContextType {
  inspectOrExecutePrompt: (request: AiPromptDebugRequest) => Promise<boolean>;
  isDebugEnabled: boolean;
}

const AiPromptDebugContext = createContext<AiPromptDebugContextType>({
  inspectOrExecutePrompt: async () => true,
  isDebugEnabled: false,
});

export function useAiPromptDebug() {
  return useContext(AiPromptDebugContext);
}

export function AiPromptDebugProvider({
  children,
  initialDebugEnabled,
}: {
  children: React.ReactNode;
  initialDebugEnabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugData, setDebugData] = useState<AiPromptDebugResponse | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const [isDebugEnabled, setIsDebugEnabled] = useState<boolean>(() => {
    if (typeof initialDebugEnabled === 'boolean') return initialDebugEnabled;
    return isAiPromptsDebugEnabled();
  });

  useEffect(() => {
    if (typeof initialDebugEnabled === 'boolean') {
      setIsDebugEnabled(initialDebugEnabled);
    }
  }, [initialDebugEnabled]);

  const inspectOrExecutePrompt = useCallback(
    async (request: AiPromptDebugRequest): Promise<boolean> => {
      let enabled = isDebugEnabled || isAiPromptsDebugEnabled();

      if (!enabled) {
        try {
          const res = await fetch('/api/ai/debug-prompt');
          if (res.ok) {
            const data = await res.json();
            if (data.enabled) {
              enabled = true;
              setIsDebugEnabled(true);
            }
          }
        } catch {
          // fallback
        }
      }

      if (!enabled) {
        return true;
      }

      setIsOpen(true);
      setLoading(true);
      setError(null);
      setDebugData(null);

      try {
        const response = await fetch('/api/ai/debug-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });

        const data = await response.json();
        if (response.ok && data.success) {
          setDebugData(data);
        } else {
          setError(data.error || 'Error al obtener el prompt de depuración.');
        }
      } catch (err: any) {
        setError(err?.message || 'Error de conexión con el servidor.');
      } finally {
        setLoading(false);
      }

      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
      });
    },
    [isDebugEnabled],
  );

  const handleExecute = () => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  };

  const handleCancelOrClose = () => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  };

  return (
    <AiPromptDebugContext.Provider value={{ inspectOrExecutePrompt, isDebugEnabled }}>
      {children}
      <AiPromptDebugModal
        isOpen={isOpen}
        loading={loading}
        error={error}
        debugData={debugData}
        onExecute={handleExecute}
        onCopyAndClose={handleCancelOrClose}
        onCancel={handleCancelOrClose}
      />
    </AiPromptDebugContext.Provider>
  );
}
