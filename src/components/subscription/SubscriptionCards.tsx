'use client';

import { useMemo } from 'react';
import {
  Check,
  Sparkles,
  Zap,
  ShieldCheck,
  CreditCard,
  ExternalLink,
  Clock,
  Layers,
  ArrowRight,
} from 'lucide-react';
import type { PlanConfig } from '@/lib/plan-config';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { Button, ButtonLink } from '@/components/ui/Button';
import { usePlanUsage } from './PlanUsageProvider';
import { useBillingManager } from './useBillingManager';

interface SubscriptionCardsProps {
  config: PlanConfig;
  isPremium: boolean;
}

export function SubscriptionCards({ config, isPremium }: SubscriptionCardsProps) {
  const { t, language } = useLanguage();
  const { data: usageData } = usePlanUsage();
  const {
    catalog,
    catalogLoading,
    interval,
    setInterval,
    checkout,
    checkoutPending,
    checkoutError,
    subscriberInterval,
    scheduleIntervalChange,
    schedulePending,
    scheduleSaved,
    formatAmount,
  } = useBillingManager(isPremium, 'subscription-cards');

  const discountPercent = catalog?.discountPercent ?? 20;

  // Monthly equivalent price for annual
  const annualMonthlyEquivalent = useMemo(() => {
    if (!catalog?.annual.amount) return null;
    const monthlyVal = catalog.annual.amount / 12;
    return formatAmount(monthlyVal);
  }, [catalog, formatAmount]);

  const isTrial = isPremium && usageData?.trial?.active;

  return (
    <div className="space-y-10">
      {/* 1. Header con estado del usuario */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-[12px] border border-subtle bg-surface p-5 sm:p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isPremium
                  ? 'bg-success-surface text-success-text border border-success-text/30'
                  : 'bg-surface-muted text-text-muted border border-border-subtle'
              }`}
            >
              {isPremium ? <Sparkles className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
              {isTrial ? 'Pro (Prueba Gratuita)' : isPremium ? 'Plan Pro Activo' : 'Plan Básico Gratuito'}
            </span>
            {usageData?.trial?.endAt && (
              <span className="text-xs text-text-muted flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Termina el {new Date(usageData.trial.endAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-GB')}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-text">
            {isPremium ? 'Tu suscripción y beneficios' : 'Elige el plan ideal para tu búsqueda'}
          </h1>
          <p className="text-sm text-text-muted max-w-xl">
            {isPremium
              ? 'Dispones de acceso completo a todas las herramientas de optimización IA y análisis de candidaturas.'
              : 'Empieza gratis y desbloquea el potencial ilimitado de IA cuando estés listo para multiplicar tus entrevistas.'}
          </p>
        </div>

        {isPremium && (
          <ButtonLink href="/api/stripe/portal" variant="secondary" className="shrink-0 gap-2">
            <CreditCard className="w-4 h-4" />
            {t('plans.manage')}
            <ExternalLink className="w-3.5 h-3.5 opacity-60" />
          </ButtonLink>
        )}
      </div>

      {/* 2. Selector de periodicidad Mensual / Anual */}
      <div className="flex flex-col items-center justify-center space-y-3">
        <div className="inline-flex items-center p-1 rounded-full bg-surface-muted border border-border-subtle shadow-inner">
          <button
            type="button"
            onClick={() => setInterval('monthly')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
              interval === 'monthly'
                ? 'bg-surface text-text shadow-sm font-semibold'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {t('plans.month')}
          </button>
          <button
            type="button"
            onClick={() => setInterval('annual')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all ${
              interval === 'annual'
                ? 'bg-surface text-text shadow-sm font-semibold'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <span>{t('plans.year')}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-success-surface text-success-text border border-success-text/20">
              {t('plans.saving', { percent: discountPercent })}
            </span>
          </button>
        </div>
        <p className="text-xs text-text-muted">
          {interval === 'annual'
            ? 'Pago anual con factura simplificada y el máximo descuento garantizado.'
            : 'Cancela o cambia de frecuencia cuando quieras desde tu panel.'}
        </p>
      </div>

      {/* 3. Tarjetas de Precios Comparativas (Free vs Pro) */}
      <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto items-stretch">
        {/* TARJETA FREE */}
        <div className="relative rounded-[16px] border border-subtle bg-surface p-6 sm:p-8 flex flex-col justify-between transition-all">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-display font-bold text-text">{t('plans.free')}</h3>
                <p className="text-xs text-text-muted mt-0.5">Para dar los primeros pasos</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-muted text-text-muted border border-subtle">
                Gratis
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-display font-extrabold text-text">0 €</span>
                <span className="text-sm text-text-muted">/ para siempre</span>
              </div>
              <p className="text-xs text-text-muted">Sin necesidad de introducir tarjeta</p>
            </div>

            <div className="border-t border-subtle pt-6 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Incluye:</p>
              <ul className="space-y-2.5 text-sm text-text">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                  <span><strong>{config.free.maxCvs ?? 3} CVs</strong> guardados ({config.free.maxBaseCvs} base + {config.free.maxAdaptedCvs} adaptados)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                  <span><strong>{config.free.generalAiMonthly} acciones de IA</strong> al mes</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                  <span><strong>{config.free.matchingMonthly} ofertas</strong> analizadas con scoring</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                  <span>Tablero CRM de postulaciones y notas</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                  <span>Plantilla Harvard profesional en PDF</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-4">
            {!isPremium ? (
              <div className="w-full py-3 px-4 rounded-[8px] bg-surface-muted border border-subtle text-center text-sm font-medium text-text-muted">
                Tu plan actual
              </div>
            ) : (
              <ButtonLink href="/dashboard" variant="secondary" className="w-full justify-center">
                Volver al tablero
              </ButtonLink>
            )}
          </div>
        </div>

        {/* TARJETA PRO */}
        <div className="relative rounded-[16px] border-2 border-[var(--ai-accent)] bg-surface p-6 sm:p-8 flex flex-col justify-between shadow-lg shadow-[var(--ai-accent)]/5">
          {/* Badge recomendado */}
          <div className="absolute -top-3.5 right-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--ai-action)] text-white shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              Más recomendado
            </span>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-display font-bold text-text flex items-center gap-2">
                  {t('plans.pro')}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--ai-surface)] text-[var(--ai-text)] font-semibold">
                    Todo Ilimitado
                  </span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">Para profesionales en búsqueda activa</p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-display font-extrabold text-text">
                  {interval === 'annual' && annualMonthlyEquivalent
                    ? annualMonthlyEquivalent
                    : catalog
                    ? formatAmount(catalog[interval].amount)
                    : '12 €'}
                </span>
                <span className="text-sm font-medium text-text-muted">/ mes</span>
              </div>
              <p className="text-xs text-text-muted">
                {interval === 'annual' && catalog?.annual.amount
                  ? `Facturado anualmente: ${formatAmount(catalog.annual.amount)} / año`
                  : 'Facturación mensual flexible'}
              </p>
            </div>

            {/* Trial callout */}
            {catalog?.trialEligible && (
              <div className="rounded-[10px] bg-info-surface/80 border border-info-text/20 p-3 space-y-1">
                <p className="text-xs font-semibold text-info-text flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  {t('plans.trial', { days: catalog.trialDays })}
                </p>
                <p className="text-[11px] leading-relaxed text-info-text">
                  Prueba todas las funciones sin coste hoy. Si cancelas antes de que termine el periodo, no se te cobrará nada.
                </p>
              </div>
            )}

            <div className="border-t border-subtle pt-6 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Todo lo de Free, y además:
              </p>
              <ul className="space-y-2.5 text-sm text-text">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-success-text shrink-0 mt-0.5 font-bold" />
                  <span><strong>CVs y versiones ilimitadas</strong> sin restricciones</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-success-text shrink-0 mt-0.5" />
                  <span><strong>{config.pro.generalAiMonthly} acciones de IA</strong> (adaptación ATS profunda)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-success-text shrink-0 mt-0.5" />
                  <span><strong>{config.pro.matchingMonthly} ofertas analizadas</strong> al mes</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-success-text shrink-0 mt-0.5" />
                  <span><strong>Matching por lote</strong> (hasta {config.pro.matchBatchSize} ofertas simultáneas)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-success-text shrink-0 mt-0.5" />
                  <span><strong>{config.pro.researchMonthly} investigaciones de empresa</strong> a fondo</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-success-text shrink-0 mt-0.5" />
                  <span>Extensión de LinkedIn, cartas de presentación y claves API</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-4 space-y-2">
            {!isPremium ? (
              <>
                <Button
                  type="button"
                  variant="primary"
                  loading={checkoutPending}
                  disabled={catalogLoading || !catalog?.[interval].available}
                  onClick={() => void checkout()}
                  className="w-full justify-center text-base py-3"
                >
                  {checkoutPending
                    ? t('plans.checkoutLoading')
                    : catalog?.trialEligible
                    ? `Empezar prueba de ${catalog.trialDays} días`
                    : 'Actualizar a Pro'}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
                {checkoutError && (
                  <p className="text-xs text-center text-danger-text">{checkoutError}</p>
                )}
                <p className="text-[11px] text-center text-text-muted">
                  {t('plans.noChargeToday')}
                </p>
              </>
            ) : (
              <div className="space-y-2">
                <ButtonLink href="/api/stripe/portal" variant="secondary" className="w-full justify-center">
                  Gestionar en Stripe
                </ButtonLink>
                <p className="text-xs text-center text-success-text font-medium">
                  ✓ Tu suscripción Pro está completamente activa
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Panel de Consumo Actual del Usuario */}
      {usageData && (
        <div className="rounded-[16px] border border-subtle bg-surface p-6 sm:p-8 space-y-6 max-w-4xl mx-auto shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-subtle pb-4">
            <div>
              <h3 className="text-lg font-display font-semibold text-text flex items-center gap-2">
                <Zap className="w-5 h-5 text-[var(--ai-accent)]" />
                Tu consumo de recursos este mes
              </h3>
              <p className="text-xs text-text-muted">
                Las cuotas se renuevan automáticamente al inicio de cada mes natural.
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-surface-muted text-text-muted border border-subtle w-fit">
              Plan actual: {isPremium ? 'Pro' : 'Gratis'}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* IA Actions */}
            <div className="rounded-[12px] border border-subtle bg-canvas/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text">{t('plans.general')}</span>
                <span className="text-xs font-medium text-text-muted">
                  {usageData.usage.general.used} / {usageData.usage.general.limit}
                </span>
              </div>
              <div className="w-full bg-surface-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300 bg-[var(--ai-action)]"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (usageData.usage.general.used / Math.max(1, usageData.usage.general.limit)) * 100
                      )
                    )}%`,
                  }}
                />
              </div>
              <p className="text-xs text-text-muted flex items-center justify-between">
                <span>{usageData.usage.general.remaining} disponibles</span>
                {usageData.usage.general.resetAt && (
                  <span>Renueva: {new Date(usageData.usage.general.resetAt).toLocaleDateString()}</span>
                )}
              </p>
            </div>

            {/* Matching */}
            <div className="rounded-[12px] border border-subtle bg-canvas/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text">{t('plans.matching')}</span>
                <span className="text-xs font-medium text-text-muted">
                  {usageData.usage.matching.used} / {usageData.usage.matching.limit}
                </span>
              </div>
              <div className="w-full bg-surface-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300 bg-[var(--action)]"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (usageData.usage.matching.used / Math.max(1, usageData.usage.matching.limit)) * 100
                      )
                    )}%`,
                  }}
                />
              </div>
              <p className="text-xs text-text-muted flex items-center justify-between">
                <span>{usageData.usage.matching.remaining} disponibles</span>
                {usageData.usage.matching.resetAt && (
                  <span>Renueva: {new Date(usageData.usage.matching.resetAt).toLocaleDateString()}</span>
                )}
              </p>
            </div>

            {/* Research */}
            <div className="rounded-[12px] border border-subtle bg-canvas/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text">{t('plans.research')}</span>
                <span className="text-xs font-medium text-text-muted">
                  {usageData.usage.research.limit === 0 ? 'Solo Pro' : `${usageData.usage.research.used} / ${usageData.usage.research.limit}`}
                </span>
              </div>
              <div className="w-full bg-surface-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300 bg-info-text"
                  style={{
                    width: `${
                      usageData.usage.research.limit === 0
                        ? 0
                        : Math.min(
                            100,
                            Math.round(
                              (usageData.usage.research.used / Math.max(1, usageData.usage.research.limit)) * 100
                            )
                          )
                    }%`,
                  }}
                />
              </div>
              <p className="text-xs text-text-muted flex items-center justify-between">
                <span>{usageData.usage.research.remaining} disponibles</span>
                {usageData.usage.research.limit === 0 && <span className="text-xs text-[var(--ai-text)]">Desbloquea con Pro</span>}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 5. Si es suscriptor Pro: Programar cambio de frecuencia */}
      {isPremium && subscriberInterval?.canChange && (
        <div className="rounded-[16px] border border-subtle bg-surface p-6 max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-display font-semibold text-text">
                {t('plans.intervalTitle')}
              </h4>
              <p className="text-xs text-text-muted mt-0.5">
                {t('plans.intervalHelp')}
              </p>
            </div>
            {subscriberInterval.currentInterval && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-muted text-text">
                Actual: {subscriberInterval.currentInterval === 'annual' ? 'Anual' : 'Mensual'}
              </span>
            )}
          </div>

          {subscriberInterval.scheduled && (
            <div className="p-3 rounded-[8px] bg-info-surface text-xs text-info-text">
              {t('plans.scheduledBilling', {
                interval: subscriberInterval.scheduled.interval === 'annual' ? 'anual' : 'mensual',
                date: new Date(subscriberInterval.scheduled.effectiveAt).toLocaleDateString(),
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <span className="text-sm font-medium text-text">Cambiar periodicidad en la próxima renovación:</span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={schedulePending}
              disabled={subscriberInterval.currentInterval === 'monthly'}
              onClick={() => void scheduleIntervalChange('monthly')}
            >
              Cambiar a Mensual
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={schedulePending}
              disabled={subscriberInterval.currentInterval === 'annual'}
              onClick={() => void scheduleIntervalChange('annual')}
            >
              Cambiar a Anual ({t('plans.saving', { percent: discountPercent })})
            </Button>
            {scheduleSaved && (
              <span className="text-xs text-success-text font-medium">✓ {t('plans.intervalSaved')}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
