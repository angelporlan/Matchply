import { loadAiAdminState } from './actions';
import { requireAdminContext } from '@/lib/request-context';
import { AdminErrorState } from '@/components/admin/AdminStates';
import AiConfigForm from '@/components/admin/AiConfigForm';
import { publicOptimizeModes } from '@/lib/optimize-modes';

export const dynamic = 'force-dynamic';

export default async function AdminAiPage() {
  await requireAdminContext();
  try {
    const state = await loadAiAdminState();
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold font-display">IA</h2>
          <p className="text-sm text-text-muted mt-1">Los prompts viven en código. El selector del editor muestra estos modos:</p>
          <ul className="mt-2 text-sm list-disc pl-5">
            {publicOptimizeModes().map((mode) => (
              <li key={mode.id}><span className="font-mono">{mode.id}</span> · {mode.name}</li>
            ))}
          </ul>
        </div>
        <AiConfigForm
          initialConfig={state.config}
          version={state.version}
          catalogs={state.catalogs}
          history={state.history}
        />
        <section className="rounded-[12px] border border-subtle bg-surface p-5 space-y-2">
          <h3 className="font-display font-semibold">Ejecuciones (7 días)</h3>
          <p className="text-sm text-text-muted">Sin CVs ni prompts. Coste solo si hay precios verificables.</p>
          {state.runStats.length === 0 ? (
            <p className="text-sm text-text-muted">Aún no hay estadísticas.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {state.runStats.map((row) => (
                <li key={`${row.functionKey}-${row.success}`}>
                  {row.functionKey} · {row.success ? 'ok' : 'error'} · {row.count}
                  {row.avgLatencyMs != null ? ` · ${Math.round(Number(row.avgLatencyMs))} ms` : ''}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  } catch (error: any) {
    return <AdminErrorState title="No se pudo cargar la configuración de IA" description={error.message || 'Inténtalo de nuevo.'} />;
  }
}
