'use client';

import { useTransition } from 'react';
import { Sparkles, RotateCcw, LogOut, Loader2 } from 'lucide-react';
import { resetSimulationAction, stopSimulationAction } from '@/app/dashboard/profile/simulation-actions';
import { Button } from '@/components/ui/Button';

export default function SimulationBanner() {
  const [isResetPending, startResetTransition] = useTransition();
  const [isStopPending, startStopTransition] = useTransition();

  const handleReset = () => {
    startResetTransition(async () => {
      await resetSimulationAction();
    });
  };

  const handleStop = () => {
    startStopTransition(async () => {
      await stopSimulationAction();
    });
  };

  return (
    <div className="absolute top-2.5 inset-x-0 z-50 pointer-events-none flex justify-center px-4">
      <div className="pointer-events-auto flex flex-wrap items-center justify-between sm:justify-start gap-3 px-4 py-1.5 rounded-full border border-ai/40 bg-surface/95 dark:bg-canvas/95 backdrop-blur-md shadow-dialog text-text text-xs">
        <div className="flex items-center gap-2 font-medium">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-ai/20 text-ai shrink-0">
            <Sparkles className="w-3 h-3" />
          </span>
          <span>
            <strong className="text-ai font-display">Modo Simulación:</strong> Nuevo usuario (0 datos)
          </span>
        </div>

        <div className="h-3.5 w-px bg-subtle hidden sm:block" />

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleReset}
            disabled={isResetPending || isStopPending}
            className="text-[11px] h-6 px-2 flex items-center gap-1 font-medium"
          >
            {isResetPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RotateCcw className="w-3 h-3" />
            )}
            <span>Reiniciar a cero</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleStop}
            disabled={isResetPending || isStopPending}
            className="text-[11px] h-6 px-2 flex items-center gap-1 border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-medium"
          >
            {isStopPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <LogOut className="w-3 h-3" />
            )}
            <span>Salir de simulación</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
