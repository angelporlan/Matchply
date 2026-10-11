'use client';

import { useRef, useState } from 'react';
import { defaultPlanConfig, parsePlanConfig, renderPaywallCopy, type PlanConfig, type PlanLimits } from '@/lib/plan-config';
import { loadHistoricPlanConfigAction, loadPlansAdminState, savePlansConfigAction } from '@/app/admin/plans/actions';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { nextPlanTabIndex } from '@/lib/plan-presentation';
import { usePaywallPrices } from '@/components/subscription/usePaywallPrices';

type AdminState = Awaited<ReturnType<typeof loadPlansAdminState>>;
const FIELDS: Array<{ key: keyof PlanLimits; label: string; storage?: boolean }> = [
  { key: 'maxCvs', label: 'cvs', storage: true }, { key: 'maxBaseCvs', label: 'baseCvs', storage: true },
  { key: 'maxAdaptedCvs', label: 'adaptedCvs', storage: true }, { key: 'generalAiMonthly', label: 'general' },
  { key: 'matchingMonthly', label: 'matching' }, { key: 'researchMonthly', label: 'research' },
  { key: 'matchBatchSize', label: 'batch' }, { key: 'apiKeys', label: 'keys' }, { key: 'apiRequestsPerMinute', label: 'requests' },
];

export default function PlansConfigForm({ initialState }: { initialState: AdminState }) {
  const { t, language } = useLanguage();
  const prices = usePaywallPrices();
  const [state, setState] = useState(initialState);
  const [draft, setDraft] = useState<PlanConfig>(initialState.config);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'limits' | 'paywall' | 'results'>('limits');
  const tabButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const tabs = ['limits', 'paywall', 'results'] as const;
  const [previewVariant, setPreviewVariant] = useState<'a' | 'b'>('a');
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.config);
  const preview = renderPaywallCopy(draft.paywall.copy[previewVariant][language], draft.pro, prices);
  const inputClass = 'mt-1 min-h-11 w-full rounded-[8px] border border-control bg-canvas px-3 py-2 text-base text-text';

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    setPending(true); setError(''); setMessage('');
    try {
      try { parsePlanConfig(draft); } catch (validationError) {
        const detail = validationError instanceof Error ? validationError.message : '';
        setActiveTab(/paywall|experimentVersion/.test(detail) ? 'paywall' : 'limits');
        setError(`${t('plans.adminError')} ${detail}`); return;
      }
      const result = await savePlansConfigAction({ expectedVersion: state.config.version, config: draft });
      if (!result.success) {
        setError(result.code === 'PLAN_CONFIG_CONFLICT' ? t('plans.conflict')
          : result.code === 'EXPERIMENT_VERSION_REQUIRED' ? t('plans.experimentChange') : `${t('plans.adminError')} ${result.code}`);
        return;
      }
      setDraft(result.config);
      setState(previous => ({ ...previous, config: result.config }));
      setMessage(t('plans.adminSaved'));
      setState(await loadPlansAdminState());
    } catch { setError(t('plans.adminError')); }
    finally { setPending(false); }
  }

  async function reload() {
    setPending(true); setError('');
    try {
      const latest = await loadPlansAdminState();
      setState(latest);
      // Keep the editable draft after a conflict. The latest version is now the comparison baseline.
      setDraft(previous => ({ ...previous, version: latest.config.version, guest: latest.config.guest }));
      setMessage(t('plans.reloadDone'));
    } catch { setError(t('plans.loadError')); }
    finally { setPending(false); }
  }

  function updateLimit(plan: 'free' | 'pro', key: keyof PlanLimits, value: number | null) {
    setDraft(previous => ({ ...previous, [plan]: { ...previous[plan], [key]: value } }));
  }

  return <div className="space-y-6">
    <div><h2 className="text-xl font-semibold font-display">{t('plans.adminTitle')}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">{t('plans.adminHelp')}</p><p className="mt-2 text-xs text-text-muted">{t('plans.version', { version: state.config.version })}</p></div>
    <div role="tablist" aria-label={t('plans.adminTitle')} className="flex gap-2 border-b border-subtle pb-3 overflow-x-auto">
      {tabs.map((tab, index) => <button key={tab} ref={element => { tabButtons.current[index] = element; }} id={`plans-tab-${tab}`} type="button" role="tab" aria-controls={`plans-panel-${tab}`} aria-selected={activeTab === tab} tabIndex={activeTab === tab ? 0 : -1} onClick={() => setActiveTab(tab)} onKeyDown={event => { const next = nextPlanTabIndex(event.key, index); if (next !== null) { event.preventDefault(); setActiveTab(tabs[next]); tabButtons.current[next]?.focus(); } }} className={`min-h-11 rounded-[8px] border px-4 text-sm font-semibold ${activeTab === tab ? 'border-control bg-surface-muted text-text' : 'border-subtle bg-surface text-text-muted'}`}>{t(`plans.${tab}`)}</button>)}
    </div>
    <form noValidate onSubmit={event => void publish(event)} className="space-y-6">
      <section id="plans-panel-limits" role="tabpanel" aria-labelledby="plans-tab-limits" hidden={activeTab !== 'limits'} className="space-y-4">
      <fieldset disabled={pending} className="rounded-[12px] border border-subtle bg-surface p-5 space-y-4">
        <legend className="font-display font-semibold">{t('plans.compare')}</legend>
        <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm text-left">
          <thead><tr><th scope="col" className="p-3">{t('plans.limitLabel')}</th><th scope="col" className="p-3">{t('plans.free')}</th><th scope="col" className="p-3">{t('plans.pro')}</th></tr></thead>
          <tbody>{FIELDS.map(field => <tr key={field.key} className="border-t border-subtle">
            <th scope="row" className="p-3 font-medium">{t(`plans.${field.label}`)}<span className="block text-xs font-normal text-text-muted">{field.storage ? t('plans.storedUnit') : ['generalAiMonthly', 'matchingMonthly', 'researchMonthly'].includes(field.key) ? t('plans.monthly') : field.key === 'apiKeys' ? t('plans.activeKeysUnit') : field.key === 'matchBatchSize' ? t('plans.batchUnit') : ''}</span></th>
            {(['free', 'pro'] as const).map(plan => <td key={plan} className="p-3 align-top">
              <label className="sr-only" htmlFor={`${plan}-${field.key}`}>{t(`plans.${field.label}`)} · {t(`plans.${plan}`)}</label>
              <input id={`${plan}-${field.key}`} type="number" min="0" max="1000000" step="1" required={draft[plan][field.key] !== null} disabled={draft[plan][field.key] === null} value={draft[plan][field.key] ?? ''} className={inputClass} onChange={event => updateLimit(plan, field.key, event.target.value === '' ? Number.NaN : Number(event.target.value))} />
              {field.storage && <label className="mt-2 flex items-center gap-2 text-xs text-text-muted"><input type="checkbox" checked={draft[plan][field.key] === null} onChange={event => updateLimit(plan, field.key, event.target.checked ? null : 0)} />{t('plans.unlimitedLabel')}</label>}
            </td>)}
          </tr>)}</tbody>
        </table></div>
      </fieldset>
      <p className="text-xs leading-5 text-text-muted">{t('plans.zeroHelp')} {t('plans.limitValidationHelp')}</p>
      <aside className="rounded-[12px] border border-subtle bg-surface p-5 space-y-2">
        <h3 className="font-display font-semibold">{t('plans.references')}</h3>
        <p className="text-sm text-text-muted">Stripe · {t('plans.month')}: {prices.monthlyPrice || t('plans.priceUnavailable')} · {t('plans.year')}: {prices.annualPrice || t('plans.priceUnavailable')}</p>
        <p className="text-sm text-text-muted">{t('plans.free')} · {state.modelReferences.free.provider} / {state.modelReferences.free.model}</p>
        <p className="text-sm text-text-muted">{t('plans.pro')} · {state.modelReferences.pro.provider} / {state.modelReferences.pro.model}</p>
        <Link href="/admin/ai" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">{t('plans.manageModels')}</Link>
      </aside>
      </section>
      <section id="plans-panel-paywall" role="tabpanel" aria-labelledby="plans-tab-paywall" hidden={activeTab !== 'paywall'} className="space-y-5">
      <fieldset disabled={pending} className="rounded-[12px] border border-subtle bg-surface p-5 space-y-4">
        <legend className="font-display font-semibold">{t('plans.experiment')}</legend>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">{t('plans.experimentVersion')}<input type="number" required min={state.config.paywall.experimentVersion} max="1000000" step="1" className={inputClass} value={draft.paywall.experimentVersion} onChange={event => setDraft(previous => ({ ...previous, paywall: { ...previous.paywall, experimentVersion: Number(event.target.value) } }))} /></label>
          <label className="text-sm">{t('plans.mode')}<select className={inputClass} value={draft.paywall.mode} onChange={event => setDraft(previous => ({ ...previous, paywall: { ...previous.paywall, mode: event.target.value as PlanConfig['paywall']['mode'] } }))}>{(['ab', 'a', 'b', 'paused'] as const).map(mode => <option key={mode} value={mode}>{t(`plans.${mode}`)}</option>)}</select></label>
        </div>
        <p className="text-xs leading-5 text-text-muted">{t('plans.placeholders')}</p>
        {(['a', 'b'] as const).map(variant => <fieldset key={variant} className="border-t border-subtle pt-4">
          <legend className="font-semibold text-sm">{t('plans.copy', { variant: variant.toUpperCase() })}</legend>
          <div className="grid gap-5 md:grid-cols-2">{(['es', 'en'] as const).map(locale => <div key={locale} className="space-y-3"><h3 className="text-sm font-semibold">{locale === 'es' ? 'Español' : 'English'}</h3>
            {(['title', 'body', 'cta'] as const).map(key => <label key={key} className="block text-sm">{t(`plans.${key === 'title' ? 'copyTitle' : key === 'body' ? 'copyBody' : 'copyCta'}`)}
              <textarea rows={key === 'body' ? 4 : 2} required maxLength={key === 'body' ? 1000 : 160} className={inputClass} value={draft.paywall.copy[variant][locale][key]} onChange={event => setDraft(previous => ({ ...previous, paywall: { ...previous.paywall, copy: { ...previous.paywall.copy, [variant]: { ...previous.paywall.copy[variant], [locale]: { ...previous.paywall.copy[variant][locale], [key]: event.target.value } } } } }))} />
            </label>)}
          </div>)}</div>
        </fieldset>)}
      </fieldset>
      <section className="rounded-[12px] border border-subtle bg-surface p-5 space-y-3" aria-label={t('plans.preview')}>
        <h3 className="font-display font-semibold">{t('plans.preview')}</h3><div className="flex gap-3">{(['a', 'b'] as const).map(variant => <label key={variant} className="inline-flex gap-2 items-center text-sm"><input type="radio" name="preview-variant" checked={previewVariant === variant} onChange={() => setPreviewVariant(variant)} />{variant.toUpperCase()}</label>)}</div>
        <h4 className="font-display font-semibold">{preview.title}</h4><p className="text-sm leading-6 text-text-muted">{preview.body}</p><span className="inline-flex min-h-11 items-center rounded-[8px] border border-control px-4 text-sm font-semibold">{preview.cta}</span>
      </section>
      </section>
      <div hidden={activeTab === 'results'} className="space-y-3"><p className="text-sm text-text-muted">{t(dirty ? 'plans.changes' : 'plans.noChanges')}</p>
        {message && <p role="status" className="text-sm text-success-text">{message}</p>}{error && <p role="alert" className="text-sm text-danger-text">{error}</p>}
        <div className="flex flex-wrap gap-3"><Button type="submit" variant="strong" loading={pending} disabled={!dirty}>{t(pending ? 'plans.publishing' : 'plans.publish')}</Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => setDraft({ ...defaultPlanConfig(), version: state.config.version, guest: state.config.guest, paywall: { ...defaultPlanConfig().paywall, experimentVersion: state.config.paywall.experimentVersion + 1 } })}>{t('plans.reset')}</Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={() => void reload()}>{t('plans.reload')}</Button>
        </div>
      </div>
    </form>
    <section id="plans-panel-results" role="tabpanel" aria-labelledby="plans-tab-results" hidden={activeTab !== 'results'} className="space-y-5">
    <section className="rounded-[12px] border border-subtle bg-surface p-5 space-y-3"><h3 className="font-display font-semibold">{t('plans.metrics')}</h3>
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr><th scope="col" className="p-2">A/B</th>{(['exposed', 'cta', 'checkouts', 'trials', 'paid', 'conversion', 'matureTrials', 'matureTrialPaid', 'trialConversion'] as const).map(key => <th key={key} scope="col" className="p-2">{t(`plans.${key}`)}</th>)}</tr></thead><tbody>{(['a', 'b'] as const).map(variant => { const item = state.metrics.variants[variant]; return <tr key={variant} className="border-t border-subtle"><th scope="row" className="p-2">{variant.toUpperCase()}</th>{[item.exposed, item.cta, item.checkouts, item.trials, item.paid, `${Number(item.conversionRate).toFixed(1)} %`, item.matureTrials, item.matureTrialPaid, `${Number(item.trialConversionRate).toFixed(1)} %`].map((value, index) => <td key={index} className="p-2">{value}</td>)}</tr>; })}</tbody></table></div>
    </section>
    <section className="rounded-[12px] border border-subtle bg-surface p-5 space-y-3"><h3 className="font-display font-semibold">{t('plans.history')}</h3>
      <p className="text-xs text-text-muted">{t('plans.version', { version: state.config.paywall.experimentVersion })} · {t('plans.metricsHelp')}</p>
      {state.history.length === 0 ? <p className="text-sm text-text-muted">{t('plans.noHistory')}</p> : <ul className="space-y-2">{state.history.map(item => <li key={item.version} className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>v{item.version} · {new Date(item.createdAt).toLocaleString(language === 'es' ? 'es-ES' : 'en-GB', { timeZone: 'Europe/Madrid' })} · {item.author || t('plans.systemAuthor')}</span><Button type="button" variant="ghost" size="sm" disabled={pending} onClick={async () => { setPending(true); setError(''); try { const historic = await loadHistoricPlanConfigAction(item.version); setActiveTab('limits'); setDraft({ ...historic, version: state.config.version, guest: state.config.guest, paywall: { ...historic.paywall, experimentVersion: state.config.paywall.experimentVersion + 1 } }); } catch { setError(t('plans.loadError')); } finally { setPending(false); } }}>{t('plans.restore')}</Button></li>)}</ul>}
    </section>
    </section>
  </div>;
}
