import {
  LANDING_EXPERIMENT_ID,
  landingExperimentEvent,
  landingExperimentStorageKey,
  type LandingExperiment,
  type LandingExperimentStage,
  type LandingVariant,
} from '@/lib/landing-experiment';
import { shouldTrackUmamiPath, umamiPagePayload, type UmamiConversionEvent } from '@/lib/umami';

type PagePayload = ReturnType<typeof umamiPagePayload>;
export type UmamiPayload = Record<string, unknown>;
export type UmamiTrack = (payload: (base: UmamiPayload) => UmamiPayload) => unknown;
export type UmamiClientConfig = {
  enabled: boolean;
  administrator: boolean;
  impersonating: boolean;
  experiment: LandingExperiment;
};
type PendingEvent = {
  name?: string;
  page: PagePayload;
  variant?: LandingVariant;
  stage?: LandingExperimentStage;
};
const PENDING_EXPERIMENT_STORAGE_KEY = `matchply:${LANDING_EXPERIMENT_ID}:pending`;
const EXPERIMENT_STAGES: LandingExperimentStage[] = ['exposed', 'cta', 'first_pdf', 'signup'];
const EXPERIMENT_PATHS = [
  '/', '/try', '/register', '/login', '/editor/:cvId', '/dashboard',
  '/dashboard/applications', '/dashboard/profile', '/dashboard/subscription',
] as const;
type DeferredExperiment = { variant: LandingVariant; stage: LandingExperimentStage; pathname: string };

/** Persist only fixed funnel fields: never document titles, referrers or private resource IDs. */
function deferredExperimentPath(pathname: string) {
  if (pathname.startsWith('/editor/')) return '/editor/:cvId';
  for (const prefix of ['/dashboard/applications', '/dashboard/profile', '/dashboard/subscription']) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return prefix;
  }
  if (pathname.startsWith('/dashboard/')) return '/dashboard';
  return EXPERIMENT_PATHS.some((path) => path === pathname) ? pathname : '/';
}

/** One dispatcher keeps deferred events and experiment deduplication independent of React mounts. */
export function createUmamiClient(input: {
  page: () => { pathname: string; title: string; referrer: string; doNotTrack: boolean };
  transport: () => UmamiTrack | undefined;
  storage: () => Pick<Storage, 'getItem' | 'setItem'> | null;
}) {
  let config: UmamiClientConfig = {
    enabled: false,
    administrator: false,
    impersonating: false,
    experiment: { enabled: false, variant: null },
  };
  let pending: PendingEvent[] = [];
  let configured = false;
  const sent = new Set<string>();
  const queued = new Set<string>();
  let lastPage = '';

  function allowed() {
    const page = input.page();
    return config.enabled && !config.administrator && !config.impersonating
      && !page.doNotTrack && shouldTrackUmamiPath(page.pathname);
  }

  function hasStage(variant: LandingVariant, stage: LandingExperimentStage) {
    const key = landingExperimentStorageKey(variant, stage);
    return queued.has(key) || stageWasSent(variant, stage);
  }

  function stageWasSent(variant: LandingVariant, stage: LandingExperimentStage) {
    const key = landingExperimentStorageKey(variant, stage);
    if (sent.has(key)) return true;
    try { return input.storage()?.getItem(key) === '1'; } catch { return false; }
  }

  function persistPendingExperiments() {
    const deferred: DeferredExperiment[] = [];
    for (const event of pending) {
      if (!event.variant || !event.stage || !config.experiment.enabled
        || event.variant !== config.experiment.variant || stageWasSent(event.variant, event.stage)) continue;
      deferred.push({ variant: event.variant, stage: event.stage, pathname: deferredExperimentPath(event.page.url) });
    }
    try {
      const storage = input.storage();
      // Clearing an existing queue must not create measurement storage for an excluded visitor.
      if (storage && (deferred.length || storage.getItem(PENDING_EXPERIMENT_STORAGE_KEY) !== null)) {
        storage.setItem(PENDING_EXPERIMENT_STORAGE_KEY, JSON.stringify(deferred));
      }
    } catch { /* Memory queue still applies. */ }
  }

  function restorePendingExperiments() {
    if (!config.experiment.enabled || !config.experiment.variant) return;
    let deferred: unknown;
    try {
      const raw = input.storage()?.getItem(PENDING_EXPERIMENT_STORAGE_KEY);
      if (!raw || raw.length > 4096) return;
      deferred = JSON.parse(raw);
    } catch { return; }
    if (!Array.isArray(deferred)) return;
    const valid: DeferredExperiment[] = [];
    for (const entry of deferred.slice(0, 8)) {
      if (!entry || typeof entry !== 'object' || entry.variant !== config.experiment.variant
        || !EXPERIMENT_STAGES.includes(entry.stage) || !EXPERIMENT_PATHS.some((path) => path === entry.pathname)) continue;
      valid.push({ variant: entry.variant, stage: entry.stage, pathname: entry.pathname });
    }
    // Exposure must be dispatched before a deferred conversion can use its denominator.
    valid.sort((a, b) => Number(b.stage === 'exposed') - Number(a.stage === 'exposed'));
    for (const event of valid) {
      if (hasStage(event.variant, event.stage) || pending.length >= 64) continue;
      if ((event.stage === 'first_pdf' || event.stage === 'signup') && !hasStage(event.variant, 'exposed')) continue;
      queued.add(landingExperimentStorageKey(event.variant, event.stage));
      pending.push({
        name: landingExperimentEvent(event.variant, event.stage),
        variant: event.variant,
        stage: event.stage,
        page: umamiPagePayload({ pathname: event.pathname }),
      });
    }
  }

  function flush() {
    // Script onReady can run before the tracking component's configuration effect.
    if (!configured) return;
    if (!allowed()) {
      pending = [];
      queued.clear();
      lastPage = '';
      persistPendingExperiments();
      return;
    }
    pending = pending.filter((event) => {
      if (!event.variant || !event.stage) return true;
      if (config.experiment.enabled && event.variant === config.experiment.variant && !stageWasSent(event.variant, event.stage)) return true;
      queued.delete(landingExperimentStorageKey(event.variant, event.stage));
      return false;
    });
    restorePendingExperiments();
    persistPendingExperiments();
    const track = input.transport();
    if (!track) return;
    const batch = pending;
    pending = [];
    for (const event of batch) {
      const key = event.variant && event.stage
        ? landingExperimentStorageKey(event.variant, event.stage) : null;
      if (event.variant && event.stage && stageWasSent(event.variant, event.stage)) {
        if (key) queued.delete(key);
        continue;
      }
      if (event.variant && (!config.experiment.enabled || event.variant !== config.experiment.variant)) {
        if (key) queued.delete(key);
        continue;
      }
      if (event.variant && (event.stage === 'first_pdf' || event.stage === 'signup')
        && !hasStage(event.variant, 'exposed')) {
        if (key) queued.delete(key);
        continue;
      }
      try {
        track((base) => ({
          website: base.website,
          hostname: base.hostname,
          screen: base.screen,
          language: base.language,
          ...event.page,
          ...(event.name ? { name: event.name } : {}),
        }));
        if (key) {
          sent.add(key);
          queued.delete(key);
          try { input.storage()?.setItem(key, '1'); } catch { /* Memory deduplication still applies. */ }
        }
      } catch {
        // Analytics must never interrupt signup, navigation or downloading a CV.
        if (key) queued.delete(key);
      }
    }
    persistPendingExperiments();
  }

  function enqueue(event: Omit<PendingEvent, 'page'>) {
    if (!allowed()) {
      flush();
      return false;
    }
    if (pending.length >= 64) return false;
    const page = input.page();
    pending.push({ ...event, page: umamiPagePayload(page) });
    flush();
    return true;
  }

  function experiment(stage: LandingExperimentStage, expectedVariant?: LandingVariant) {
    const { variant, enabled } = config.experiment;
    if (!allowed()) {
      flush();
      return false;
    }
    if (!enabled || !variant || (expectedVariant && variant !== expectedVariant)) return false;
    if (hasStage(variant, stage)) return true;
    if ((stage === 'first_pdf' || stage === 'signup') && !hasStage(variant, 'exposed')) return false;
    const key = landingExperimentStorageKey(variant, stage);
    queued.add(key);
    const accepted = enqueue({ name: landingExperimentEvent(variant, stage), variant, stage });
    if (!accepted) queued.delete(key);
    return accepted;
  }

  return {
    configure(next: UmamiClientConfig) {
      configured = true;
      config = next;
      flush();
    },
    setExperiment(experiment: LandingExperiment) {
      config = { ...config, experiment };
      flush();
    },
    flush,
    experiment,
    conversion(event: UmamiConversionEvent) {
      const accepted = enqueue({ name: event });
      if (accepted && event === 'cv_downloaded') experiment('first_pdf');
      if (accepted && event === 'signup_completed') experiment('signup');
      return accepted;
    },
    pageview() {
      if (!allowed()) return;
      const pathname = input.page().pathname;
      if (pathname === lastPage) return;
      if (enqueue({})) lastPage = pathname;
    },
  };
}
