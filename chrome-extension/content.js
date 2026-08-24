(() => {
  "use strict";

  const selectors = {
    title: [
      ".job-details-jobs-unified-top-card__job-title h1",
      ".job-details-jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__job-title",
      "main h1",
    ],
    company: [
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name",
      ".job-details-jobs-unified-top-card__primary-description-container a",
    ],
    location: [
      ".job-details-jobs-unified-top-card__tertiary-description-container span",
      ".jobs-unified-top-card__bullet",
      ".job-details-jobs-unified-top-card__primary-description-container span",
    ],
    description: [
      "#job-details",
      ".jobs-description__content",
      ".jobs-box__html-content",
      ".jobs-description-content__text",
    ],
  };

  const config = {
    mode: "auto",
    delay: 3,
    showWidget: true,
  };

  let jobWatchTimer = null;
  let captureRetryTimer = null;
  let countdownInterval = null;
  let countdownStartedAt = 0;
  let captureInProgress = false;
  let lastCompletedJobId = "";
  let candidateJobId = "";
  let candidateSignature = "";
  let skippedJobs = new Set();
  let widgetHost = null;
  let shadowRoot = null;
  let widgetCard = null;
  let widgetKind = "";

  function clampDelay(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 3;
    return Math.min(20, Math.max(1, Math.round(n)));
  }

  async function loadConfig() {
    const stored = await chrome.storage.local.get([
      "captureMode",
      "captureDelaySec",
      "showWidget",
      "matchplyCaptureMode",
      "matchplyCaptureDelay",
      "matchplyShowWidget",
    ]);
    config.mode = stored.captureMode || stored.matchplyCaptureMode || "auto";
    config.delay = clampDelay(stored.captureDelaySec ?? stored.matchplyCaptureDelay ?? 3);
    config.showWidget = stored.showWidget ?? stored.matchplyShowWidget ?? true;
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    let restart = false;
    if (changes.captureMode) {
      config.mode = changes.captureMode.newValue || "auto";
      restart = true;
    }
    if (changes.captureDelaySec) {
      config.delay = clampDelay(changes.captureDelaySec.newValue);
      restart = true;
    }
    if (changes.showWidget !== undefined) {
      config.showWidget = changes.showWidget.newValue !== false;
    }
    if (restart) {
      candidateJobId = "";
      clearInterval(countdownInterval);
      countdownInterval = null;
      schedule(50);
    } else {
      renderWidget();
    }
  });

  function clean(value) {
    return String(value || "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  function firstText(candidates) {
    for (const selector of candidates) {
      const element = document.querySelector(selector);
      const text = clean(element?.innerText || element?.textContent);
      if (text) return text;
    }
    return "";
  }

  function extractWorkplace(text) {
    if (/\b(en remoto|remote)\b/i.test(text)) return "Remoto";
    if (/\b(h[ií]brido|hybrid)\b/i.test(text)) return "Híbrido";
    if (/\b(presencial|on[ -]?site)\b/i.test(text)) return "Presencial";
    return "";
  }

  function extractEmployment(text) {
    if (/\b(jornada completa|full[ -]?time)\b/i.test(text)) return "Jornada completa";
    if (/\b(media jornada|part[ -]?time)\b/i.test(text)) return "Media jornada";
    if (/\b(pr[aá]cticas|internship)\b/i.test(text)) return "Prácticas";
    if (/\b(temporal|temporary)\b/i.test(text)) return "Temporal";
    if (/\b(contrato|contract|freelance)\b/i.test(text)) return "Contrato";
    return "";
  }

  function currentJobId() {
    const direct = location.pathname.match(/\/jobs\/view\/(?:[^/?]*-)?(\d+)/);
    if (direct) return direct[1];
    const candidate = new URL(location.href).searchParams.get("currentJobId");
    return /^\d+$/.test(candidate || "") ? candidate : "";
  }

  function buildPayload(jobId) {
    const title = firstText(selectors.title);
    const company = firstText(selectors.company);
    const locationMetadata = firstText(selectors.location);
    const locationText = clean(locationMetadata.split("\n")[0].split("·")[0]);
    const topCardText = firstText([
      ".job-details-jobs-unified-top-card__container--two-pane",
      ".job-details-jobs-unified-top-card",
    ]);
    const workplaceType = extractWorkplace(topCardText);
    const employmentType = extractEmployment(topCardText);
    const description = firstText(selectors.description);
    if (!title || description.length < 80) return null;
    const rawText = [title, company, locationMetadata, workplaceType, employmentType, "Acerca del empleo", description].filter(Boolean).join("\n");
    return {
      job_id: jobId,
      url: `https://www.linkedin.com/jobs/view/${jobId}`,
      title,
      company,
      location: locationText,
      workplace_type: workplaceType,
      employment_type: employmentType,
      description,
      raw_text: rawText,
    };
  }

  function payloadSignature(payload) {
    return `${payload.title}|${payload.company}|${payload.description.length}|${payload.description.slice(0, 240)}`;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function remainingSeconds() {
    const totalMs = Math.max(1000, config.delay * 1000);
    return Math.max(0, Math.ceil((totalMs - (Date.now() - countdownStartedAt)) / 1000));
  }

  function ensureWidget() {
    if (widgetHost && widgetCard) {
      if (!widgetHost.isConnected) (document.body || document.documentElement).appendChild(widgetHost);
      return;
    }

    widgetHost = document.createElement("div");
    shadowRoot = widgetHost.attachShadow({ mode: "closed" });

    const style = document.createElement("style");
    style.textContent = `
      :host {
        all: initial;
        display: block;
        width: 0;
        height: 0;
        overflow: visible;
        pointer-events: none;
      }
      .card {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 2147483000;
        pointer-events: auto;
        min-width: 220px;
        max-width: 280px;
        padding: 12px 14px;
        background: #FFFFFF;
        color: #1E1B4B;
        border: 1px solid #E2E8F0;
        border-top: 2.5px solid #8B5CF6;
        border-radius: 12px;
        box-shadow: 0 12px 32px -4px rgba(30, 27, 75, 0.16), 0 4px 10px -2px rgba(30, 27, 75, 0.06);
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 12px;
        line-height: 1.4;
        -webkit-font-smoothing: antialiased;
        animation: mpSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes mpSlideUp {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .card[hidden] { display: none !important; }
      .top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
      }
      .brand-box {
        display: flex;
        align-items: center;
        gap: 5px;
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-weight: 800;
        font-size: 12px;
        color: #1E1B4B;
      }
      .brand-box span { color: #8B5CF6; }
      .time {
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-weight: 800;
        font-size: 14px;
        color: #8B5CF6;
        letter-spacing: -0.02em;
        font-variant-numeric: tabular-nums;
      }
      .status {
        color: #64748B;
        font-size: 11.5px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .status.ok { color: #065F46; font-weight: 700; }
      .status.err { color: #DC2626; font-size: 11px; }
      .actions {
        display: flex;
        gap: 6px;
        margin-top: 4px;
      }
      button {
        font-family: inherit;
        font-size: 11.5px;
        font-weight: 700;
        border-radius: 8px;
        padding: 7px 11px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        border: 0;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      button:active { transform: scale(0.97); }
      .save {
        flex: 1;
        color: #FFF;
        background: #2ECC71;
        box-shadow: 0 2px 8px rgba(46, 204, 113, 0.25);
      }
      .save:hover { background: #27AE60; }
      .skip {
        border: 1px solid #E2E8F0;
        background: #FAFAFA;
        color: #64748B;
      }
      .skip:hover { color: #1E1B4B; border-color: #CBD5E1; background: #F1F5F9; }
      .icon {
        width: 13px;
        height: 13px;
        stroke-width: 1.75;
        stroke: currentColor;
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
        vertical-align: middle;
      }
    `;

    widgetCard = document.createElement("div");
    widgetCard.className = "card";
    widgetCard.hidden = true;
    widgetCard.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (action === "save") void attemptCapture(currentJobId(), true);
      if (action === "skip") skipCurrent();
    });

    shadowRoot.append(style, widgetCard);
    (document.body || document.documentElement).appendChild(widgetHost);
    ["click", "mousedown", "mouseup"].forEach((type) => {
      widgetHost.addEventListener(type, (event) => event.stopPropagation());
    });
  }

  function currentKind(state = {}) {
    const jobId = currentJobId();
    if (!config.showWidget || !jobId) return "hidden";
    if (state.saving) return "saving";
    if (state.waiting) return "waiting";
    if (state.error) return "error";
    if (state.saved || jobId === lastCompletedJobId) return "saved";
    if (skippedJobs.has(jobId)) return "skipped";
    if (config.mode === "manual") return "manual";
    return "countdown";
  }

  function renderWidget(state = {}) {
    ensureWidget();
    const kind = currentKind(state);

    if (kind === "hidden") {
      widgetKind = kind;
      widgetCard.hidden = true;
      widgetCard.replaceChildren();
      return;
    }

    widgetCard.hidden = false;

    if (kind === "countdown" && widgetKind === "countdown") {
      const time = shadowRoot.querySelector("[data-remaining]");
      if (time) time.textContent = `${state.remaining ?? remainingSeconds()}s`;
      return;
    }

    widgetKind = kind;
    const brandSvg = `<svg class="icon" viewBox="0 0 24 24" style="color:#8B5CF6;"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`;
    const zapSvg = `<svg class="icon" viewBox="0 0 24 24"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>`;
    const checkSvg = `<svg class="icon" viewBox="0 0 24 24" style="color:#2ECC71;"><polyline points="20 6 9 17 4 12"/></svg>`;
    const skipSvg = `<svg class="icon" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

    const blocks = {
      saved: `<div class="top"><div class="brand-box">${brandSvg} Matchply</div><span class="status ok">${checkSvg} Guardada</span></div>`,
      saving: `<div class="top"><div class="brand-box">${brandSvg} Matchply</div><span class="status">⏳ Guardando…</span></div>`,
      waiting: `<div class="top"><div class="brand-box">${brandSvg} Matchply</div><span class="status">Leyendo oferta…</span></div>`,
      error: `<div class="top"><div class="brand-box">${brandSvg} Matchply</div><span class="status err">⚠️ Error</span></div><div class="status err" style="margin-bottom:6px">${escapeHtml(state.error || "No se pudo guardar")}</div><div class="actions"><button class="save" data-action="save" type="button">${zapSvg} Reintentar</button></div>`,
      skipped: `<div class="top"><div class="brand-box">${brandSvg} Matchply</div><span class="status">Omitida</span></div><div class="actions"><button class="save" data-action="save" type="button">${zapSvg} Guardar</button></div>`,
      manual: `<div class="top"><div class="brand-box">${brandSvg} Matchply</div></div><div class="actions"><button class="save" data-action="save" type="button">${zapSvg} Guardar oferta</button></div>`,
      countdown: `<div class="top"><div class="brand-box">${brandSvg} Matchply</div><span class="time" data-remaining>${state.remaining ?? remainingSeconds()}s</span></div><div class="actions"><button class="save" data-action="save" type="button">${zapSvg} Ahora</button><button class="skip" data-action="skip" type="button">${skipSvg} Omitir</button></div>`,
    };
    widgetCard.innerHTML = blocks[kind] || blocks.countdown;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
  }

  function skipCurrent() {
    const jobId = currentJobId();
    if (!jobId) return;
    skippedJobs.add(jobId);
    clearInterval(countdownInterval);
    countdownInterval = null;
    clearTimeout(captureRetryTimer);
    renderWidget();
  }

  function startCountdown(jobId) {
    clearInterval(countdownInterval);
    clearTimeout(captureRetryTimer);
    countdownInterval = null;

    if (config.mode === "manual" || skippedJobs.has(jobId) || jobId === lastCompletedJobId) {
      renderWidget();
      return;
    }

    countdownStartedAt = Date.now();
    renderWidget({ remaining: config.delay });

    countdownInterval = setInterval(() => {
      if (currentJobId() !== jobId) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        return;
      }
      const remaining = remainingSeconds();
      renderWidget({ remaining });
      if (remaining <= 0) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        void attemptCapture(jobId, false);
      }
    }, 200);
  }

  async function waitForPayload(jobId) {
    let payload = buildPayload(jobId);
    if (payload) return payload;
    renderWidget({ waiting: true });
    for (let i = 0; i < 10 && currentJobId() === jobId; i += 1) {
      await sleep(350);
      payload = buildPayload(jobId);
      if (payload) return payload;
    }
    return null;
  }

  async function attemptCapture(jobId, force) {
    if (captureInProgress) return { ok: false, error: "Captura en curso" };
    if (!jobId) return { ok: false, error: "No hay oferta visible" };
    if (!force && skippedJobs.has(jobId)) return { ok: false, error: "Oferta omitida" };

    clearInterval(countdownInterval);
    countdownInterval = null;
    clearTimeout(captureRetryTimer);

    const payload = await waitForPayload(jobId);
    if (!payload || currentJobId() !== jobId) {
      const error = "La descripción aún no está visible.";
      renderWidget({ error });
      return { ok: false, error };
    }

    if (!force) {
      const signature = payloadSignature(payload);
      if (signature !== candidateSignature) {
        candidateSignature = signature;
        captureRetryTimer = setTimeout(() => {
          void attemptCapture(jobId, false);
        }, 400);
        return { ok: false, error: "Esperando a que termine de cargar" };
      }
    }

    captureInProgress = true;
    skippedJobs.delete(jobId);
    renderWidget({ saving: true });
    try {
      const result = await chrome.runtime.sendMessage({ type: "capture-linkedin-job", payload });
      if (result?.ok) {
        lastCompletedJobId = jobId;
        renderWidget({ saved: true });
        return { ok: true, result };
      }
      const error = result?.error || "No se pudo guardar.";
      renderWidget({ error });
      return { ok: false, error };
    } catch (err) {
      const error = /Extension context invalidated/i.test(String(err))
        ? "Recarga la pestaña de LinkedIn."
        : "El archivo local no está en marcha.";
      renderWidget({ error });
      return { ok: false, error };
    } finally {
      captureInProgress = false;
    }
  }

  async function onJobMaybeChanged() {
    const jobId = currentJobId();
    if (!jobId) {
      renderWidget();
      return;
    }
    if (jobId === lastCompletedJobId) {
      renderWidget({ saved: true });
      return;
    }
    if (jobId === candidateJobId) return;

    candidateJobId = jobId;
    candidateSignature = "";
    clearInterval(countdownInterval);
    countdownInterval = null;
    clearTimeout(captureRetryTimer);

    const stored = await chrome.storage.local.get(`captured_${jobId}`);
    if (stored[`captured_${jobId}`]) {
      lastCompletedJobId = jobId;
      renderWidget({ saved: true });
      return;
    }

    startCountdown(jobId);
  }

  function schedule(delay = 400) {
    clearTimeout(jobWatchTimer);
    jobWatchTimer = setTimeout(() => {
      void onJobMaybeChanged();
    }, delay);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "trigger-manual-capture") return false;
    (async () => {
      sendResponse(await attemptCapture(currentJobId(), true));
    })();
    return true;
  });

  const observer = new MutationObserver(() => schedule(300));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", () => schedule(200));
  setInterval(() => schedule(200), 2000);

  void loadConfig();
  schedule(500);
})();
