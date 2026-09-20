'use client';

import { useMemo, useState } from 'react';
import { AI_FUNCTION_KEYS, AI_FUNCTION_LABELS, type AiRuntimeConfig } from '@/lib/ai-runtime-config';
import { resetAiRuntimeConfigAction, restoreAiRuntimeConfigAction, saveAiRuntimeConfigAction, testAiModelAction } from '@/app/admin/ai/actions';
import { Button } from '@/components/ui/Button';
import type { AiProvider } from '@/lib/models';

type CatalogState = {
  catalogs: Record<AiProvider, { value: Array<{ id: string; name: string; pricing?: { prompt?: string; completion?: string } }>; error?: string; fetchedAt: number }>;
  credentials: Record<AiProvider, boolean>;
};

const PROVIDERS: AiProvider[] = ['gemini', 'deepseek', 'openrouter'];

export default function AiConfigForm({
  initialConfig,
  version,
  catalogs,
  history,
}: {
  initialConfig: AiRuntimeConfig;
  version: number;
  catalogs: CatalogState;
  history: Array<{ id: string; version: number; createdAt: Date | string }>;
}) {
  const [config, setConfig] = useState(initialConfig);
  const [expectedVersion, setExpectedVersion] = useState(version);
  const [message, setMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const modelsByProvider = useMemo(() => {
    const map: Record<string, Array<{ id: string; name: string }>> = { gemini: [], deepseek: [], openrouter: [] };
    for (const provider of PROVIDERS) {
      map[provider] = catalogs.catalogs[provider]?.value || [];
    }
    return map;
  }, [catalogs]);

  function setGeneral(plan: 'free' | 'pro', field: 'provider' | 'model', value: string) {
    setConfig((prev) => ({
      ...prev,
      general: {
        ...prev.general,
        [plan]: { ...prev.general[plan], [field]: value },
      },
    }));
  }

  async function onTest(provider: string, model: string) {
    setTestResult('Probando…');
    const result = await testAiModelAction(provider, model);
    if (result.success) {
      setConfig((prev) => ({
        ...prev,
        tested: [
          ...prev.tested.filter((item) => !(item.provider === provider && item.model === model)),
          { provider: provider as AiProvider, model, testedAt: result.testedAt!, ok: true },
        ],
      }));
      setTestResult(`${provider}:${model} OK (${result.latencyMs} ms). ${result.warning} Respuesta: ${result.sample}`);
    } else {
      setTestResult(result.error || 'Fallo');
    }
  }

  return (
    <div className="space-y-6">
      {message && <p role="status" className="text-sm">{message}</p>}
      {testResult && <p className="text-sm text-text-muted whitespace-pre-wrap">{testResult}</p>}

      <section className="rounded-[12px] border border-subtle bg-surface p-5 space-y-4">
        <h3 className="font-display font-semibold">Credenciales</h3>
        <ul className="text-sm space-y-1">
          {PROVIDERS.map((provider) => (
            <li key={provider}>{provider}: {catalogs.credentials[provider] ? 'configurada' : 'no configurada'}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-[12px] border border-subtle bg-surface p-5 space-y-4">
        <h3 className="font-display font-semibold">Modelo general</h3>
        {(['free', 'pro'] as const).map((plan) => (
          <fieldset key={plan} className="grid sm:grid-cols-2 gap-3">
            <legend className="text-sm font-medium mb-1">{plan === 'free' ? 'Gratis' : 'Pro'}</legend>
            <label className="text-sm">Proveedor
              <select
                className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3"
                value={config.general[plan].provider}
                onChange={(event) => setGeneral(plan, 'provider', event.target.value)}
              >
                {PROVIDERS.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
              </select>
            </label>
            <label className="text-sm">Modelo
              <input
                className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3 font-mono text-sm"
                value={config.general[plan].model}
                onChange={(event) => setGeneral(plan, 'model', event.target.value)}
                list={`${plan}-models`}
              />
              <datalist id={`${plan}-models`}>
                {modelsByProvider[config.general[plan].provider]?.map((model) => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </datalist>
            </label>
            <Button type="button" variant="secondary" onClick={() => onTest(config.general[plan].provider, config.general[plan].model)}>
              Probar {plan}
            </Button>
          </fieldset>
        ))}
      </section>

      <section className="rounded-[12px] border border-subtle bg-surface p-5 space-y-4">
        <h3 className="font-display font-semibold">Excepciones por función</h3>
        <p className="text-sm text-text-muted">Vacío = hereda el modelo general. No cambia qué funciones permite cada plan.</p>
        {AI_FUNCTION_KEYS.map((key) => (
          <fieldset key={key} className="border-t border-subtle pt-3 space-y-2">
            <legend className="font-medium text-sm">{AI_FUNCTION_LABELS[key].es}</legend>
            {(['free', 'pro'] as const).map((plan) => {
              const override = config.overrides[key]?.[plan];
              const inherited = !override;
              return (
                <div key={plan} className="grid sm:grid-cols-[80px_1fr_1fr] gap-2 items-center">
                  <span className="text-xs uppercase text-text-muted">{plan}</span>
                  <select
                    className="min-h-[44px] rounded-[8px] border border-control bg-canvas px-3"
                    value={override?.provider || ''}
                    onChange={(event) => {
                      const provider = event.target.value as AiProvider | '';
                      setConfig((prev) => {
                        const current = { ...(prev.overrides[key] || {}) };
                        if (!provider) {
                          delete current[plan];
                        } else {
                          current[plan] = { provider, model: current[plan]?.model || '' };
                        }
                        return { ...prev, overrides: { ...prev.overrides, [key]: current } };
                      });
                    }}
                  >
                    <option value="">Hereda ({config.general[plan].provider})</option>
                    {PROVIDERS.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
                  </select>
                  <input
                    className="min-h-[44px] rounded-[8px] border border-control bg-canvas px-3 font-mono text-sm"
                    placeholder={inherited ? config.general[plan].model : 'modelo'}
                    value={override?.model || ''}
                    onChange={(event) => {
                      setConfig((prev) => ({
                        ...prev,
                        overrides: {
                          ...prev.overrides,
                          [key]: {
                            ...(prev.overrides[key] || {}),
                            [plan]: {
                              provider: (prev.overrides[key]?.[plan]?.provider || config.general[plan].provider),
                              model: event.target.value,
                            },
                          },
                        },
                      }));
                    }}
                  />
                </div>
              );
            })}
          </fieldset>
        ))}
      </section>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={async () => {
          const result = await saveAiRuntimeConfigAction({ expectedVersion, config });
          setMessage(result.success ? 'Configuración guardada.' : result.error || 'Error');
          if (result.success) setExpectedVersion(expectedVersion + 1);
        }}>Guardar</Button>
        <Button type="button" variant="secondary" onClick={async () => {
          const result = await resetAiRuntimeConfigAction();
          setMessage(result.success ? 'Restaurada la predeterminada.' : result.error || 'Error');
        }}>Restaurar predeterminada</Button>
      </div>

      <section className="rounded-[12px] border border-subtle bg-surface p-5 space-y-3">
        <h3 className="font-display font-semibold">Historial</h3>
        {history.length === 0 ? <p className="text-sm text-text-muted">Aún no hay versiones guardadas.</p> : (
          <ul className="space-y-2 text-sm">
            {history.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <span>v{item.version} · {new Date(item.createdAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</span>
                <Button type="button" variant="ghost" size="sm" onClick={async () => {
                  const result = await restoreAiRuntimeConfigAction(item.version);
                  setMessage(result.success ? `Restaurada v${item.version}` : result.error || 'Error');
                }}>Restaurar</Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
