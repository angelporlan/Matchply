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

  const DEFAULT_WIDGET_POSITION = Object.freeze({ x: 1, y: 0.82 });

  const config = {
    mode: "auto",
    delay: 3,
    showWidget: true,
    capturePeople: false,
    installationId: "",
    widgetPosition: { ...DEFAULT_WIDGET_POSITION },
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
  let widgetRenderedExpanded = false;
  let widgetJobId = "";
  let widgetExpanded = false;
  let widgetDrag = null;
  let widgetPositionSaveTimer = null;
  let inlineDelayDraft = null;
  let capturedPeople = new Set();
  let peopleRetryAt = 0;
  let photoWarning = false;

  function clampDelay(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 3;
    return Math.min(20, Math.max(1, Math.round(n)));
  }

  function normalizeWidgetPosition(value) {
    const ratio = (candidate, fallback) => {
      const number = Number(candidate);
      return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
    };
    return {
      x: ratio(value?.x, DEFAULT_WIDGET_POSITION.x),
      y: ratio(value?.y, DEFAULT_WIDGET_POSITION.y),
    };
  }

  function widgetPositionLimits() {
    const rect = widgetCard.getBoundingClientRect();
    const margin = 12;
    return {
      maxLeft: Math.max(margin, window.innerWidth - rect.width - margin),
      maxTop: Math.max(margin, window.innerHeight - rect.height - margin),
    };
  }

  function applyWidgetPosition() {
    if (!widgetCard || widgetCard.hidden) return;
    const position = normalizeWidgetPosition(config.widgetPosition);
    const { maxLeft, maxTop } = widgetPositionLimits();
    widgetCard.style.left = `${Math.round(position.x * maxLeft)}px`;
    widgetCard.style.top = `${Math.round(position.y * maxTop)}px`;
  }

  function rememberWidgetPosition(left, top) {
    const { maxLeft, maxTop } = widgetPositionLimits();
    config.widgetPosition = normalizeWidgetPosition({
      x: maxLeft ? left / maxLeft : 1,
      y: maxTop ? top / maxTop : DEFAULT_WIDGET_POSITION.y,
    });
  }

  function persistWidgetPosition() {
    clearTimeout(widgetPositionSaveTimer);
    widgetPositionSaveTimer = setTimeout(() => {
      void chrome.storage.local.set({ matchplyWidgetPosition: config.widgetPosition });
    }, 120);
  }

  async function loadConfig() {
    const stored = await chrome.storage.local.get([
      "captureMode",
      "captureDelaySec",
      "showWidget",
      "matchplyCaptureMode",
      "matchplyCaptureDelay",
      "matchplyShowWidget",
      "matchplyCapturePeople",
      "matchplyExtensionInstallation",
      "matchplyWidgetPosition",
    ]);
    config.mode = stored.matchplyCaptureMode || stored.captureMode || "auto";
    config.delay = clampDelay(stored.matchplyCaptureDelay ?? stored.captureDelaySec ?? 3);
    config.showWidget = stored.matchplyShowWidget ?? stored.showWidget ?? true;
    config.capturePeople = stored.matchplyCapturePeople === true;
    config.installationId = stored.matchplyExtensionInstallation?.id || "";
    config.widgetPosition = normalizeWidgetPosition(stored.matchplyWidgetPosition);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    let restart = false;
    const mode = changes.matchplyCaptureMode || changes.captureMode;
    const delay = changes.matchplyCaptureDelay || changes.captureDelaySec;
    const widget = changes.matchplyShowWidget || changes.showWidget;
    const widgetPosition = changes.matchplyWidgetPosition;
    if (mode) { config.mode = mode.newValue || "auto"; restart = true; }
    if (delay) { config.delay = clampDelay(delay.newValue); inlineDelayDraft = null; restart = true; }
    if (widget) config.showWidget = widget.newValue !== false;
    if (widgetPosition) {
      config.widgetPosition = normalizeWidgetPosition(widgetPosition.newValue);
      applyWidgetPosition();
    }
    if (changes.matchplyCapturePeople) { config.capturePeople = changes.matchplyCapturePeople.newValue === true; restart = true; }
    if (changes.matchplyExtensionInstallation) {
      config.installationId = changes.matchplyExtensionInstallation.newValue?.id || "";
      lastCompletedJobId = ""; capturedPeople.clear(); restart = true;
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

  function newPeople() {
    return config.capturePeople ? MatchplyPeople.extract(document).filter(p => !capturedPeople.has(MatchplyPeople.signature(p))).slice(0, 20) : [];
  }
  function captureKey(jobId) { return `matchply_capture_${config.installationId}_${jobId}`; }
  function rememberPeople(people, result) {
    if (result?.peopleError) return;
    const signatures = result?.capturedSignatures || people.map(p => MatchplyPeople.signature(p));
    signatures.forEach(value => capturedPeople.add(value));
    photoWarning = !!result?.avatarFailures;
    if (result?.avatarRetryAt) peopleRetryAt = result.avatarRetryAt;
  }
  function detailMatches(jobId) {
    const anchor = document.querySelector('.job-details-jobs-unified-top-card__job-title a[href*="/jobs/view/"], .jobs-unified-top-card__job-title a[href*="/jobs/view/"]');
    const detailId = anchor?.getAttribute('href')?.match(/\/jobs\/view\/(?:[^/?]*-)?(\d+)/)?.[1];
    return !detailId || detailId === jobId;
  }
  function buildPayload(jobId) {
    if (!detailMatches(jobId)) return null;
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
      ...(config.capturePeople ? { people: newPeople() } : {}),
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
        left: 12px;
        top: 12px;
        z-index: 2147483000;
        box-sizing: border-box;
        pointer-events: auto;
        width: min(320px, calc(100vw - 24px));
        padding: 14px 16px;
        background: #FFFFFF;
        color: #1E1B4B;
        border: 1px solid #E2E5EB;
        border-radius: 10px;
        box-shadow: 0 8px 28px rgba(30, 27, 75, 0.14);
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 12px;
        line-height: 1.45;
        -webkit-font-smoothing: antialiased;
        animation: mpSlideUp 180ms ease-out;
      }
      .card.expanded {
        width: min(360px, calc(100vw - 24px));
        max-height: min(72vh, 640px);
        overflow-y: auto;
      }
      .card.expanded .top {
        position: sticky;
        top: -14px;
        z-index: 2;
        margin: -14px 0 10px;
        padding-top: 14px;
        background: #FFFFFF;
      }
      @keyframes mpSlideUp {
        from { opacity: 0; transform: translateY(5px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @media (prefers-reduced-motion: reduce) {
        .card { animation: none; }
      }
      [hidden] { display: none !important; }
      .top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        min-height: 44px;
        margin-bottom: 10px;
        cursor: grab;
        user-select: none;
        touch-action: none;
      }
      .card.dragging .top { cursor: grabbing; }
      .top:focus-visible { outline: 3px solid #1E1B4B; outline-offset: 3px; border-radius: 6px; }
      .top-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; min-width: 0; }
      .drag-cue { display: inline-flex; align-items: center; color: #64748B; flex: 0 0 auto; }
      .drag-icon { width: 14px; height: 18px; }
      .brand-box {
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: Outfit, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-weight: 700;
        font-size: 13px;
        color: #1E1B4B;
        white-space: nowrap;
      }
      .brand-mark { width: 18px; height: 18px; flex: 0 0 auto; }
      .wordmark { display: inline-flex; align-items: baseline; gap: 1px; }
      .wordmark-match { font-weight: 800; }
      .wordmark-ply { color: #6366F1; font-weight: 600; }
      .time {
        color: #6D28D9;
        font-size: 12px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .status {
        color: #596174;
        font-size: 12px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .status.ok { color: #15803D; font-weight: 650; }
      .status.err { color: #B91C1C; font-size: 12px; }
      .status-detail {
        margin: 0 0 8px;
        color: #B91C1C;
        font-size: 12px;
        line-height: 1.45;
      }
      .notice {
        margin: 0 0 8px;
        padding: 8px 9px;
        border: 1px solid #E2E5EB;
        border-radius: 7px;
        background: #F1F3F5;
        color: #596174;
        font-size: 12px;
        line-height: 1.45;
      }
      .actions {
        display: flex;
        gap: 8px;
        margin-top: 10px;
      }
      button {
        font-family: inherit;
        font-size: 12px;
        font-weight: 650;
        border-radius: 8px;
        min-height: 44px;
        padding: 8px 12px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        border: 2px solid #1E1B4B;
        transition: background-color 140ms ease, color 140ms ease, transform 140ms ease, box-shadow 140ms ease;
      }
      .save {
        flex: 1;
        color: #1E1B4B;
        background: #2ECC71;
        box-shadow: 2px 2px 0 #1E1B4B;
      }
      .save:active { transform: translate(2px, 2px); box-shadow: none; }
      .skip {
        border: 1px solid #64748B;
        background: #FAFAFA;
        color: #596174;
      }
      button:focus-visible { outline: 3px solid #1E1B4B; outline-offset: 3px; }
      .expand {
        width: 44px;
        min-width: 44px;
        height: 44px;
        padding: 0;
        border: 1px solid #64748B;
        background: #FFFFFF;
        color: #1E1B4B;
      }
      .settings-drawer {
        margin-top: 12px;
        padding-top: 14px;
        border-top: 1px solid #E2E5EB;
      }
      .settings-drawer[hidden] { display: none !important; }
      .drawer-title { margin: 0 0 10px; font-size: 14px; font-weight: 700; }
      .field-label { display: block; margin: 0 0 6px; color: #1E1B4B; font-size: 12px; font-weight: 650; }
      .mode-group { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; padding: 4px; border: 1px solid #E2E5EB; border-radius: 9px; background: #F1F3F5; }
      .mode-option { min-height: 44px; padding: 7px 8px; border: 1px solid transparent; background: transparent; color: #596174; box-shadow: none; }
      .mode-option.active { border-color: #E2E5EB; background: #FFFFFF; color: #1E1B4B; }
      .setting-hint { margin: 6px 0 12px; color: #596174; font-size: 12px; line-height: 1.45; }
      .setting-delay { margin: 12px 0; }
      .delay-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .delay-value { color: #6D28D9; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
      .delay-slider { display: block; width: 100%; min-height: 44px; margin: 2px 0 4px; accent-color: #7C3AED; cursor: pointer; }
      .delay-presets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
      .delay-preset { min-height: 44px; padding: 6px 4px; border: 1px solid #64748B; background: #FFFFFF; color: #596174; box-shadow: none; }
      .delay-preset.active { border-color: #7C3AED; background: #F5F3FF; color: #6D28D9; }
      .setting-row {
        min-height: 48px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 9px 0;
        border-top: 1px solid #E2E5EB;
        color: #1E1B4B;
        cursor: pointer;
      }
      .setting-copy { display: grid; gap: 2px; }
      .setting-copy strong { font-size: 12px; font-weight: 650; }
      .setting-copy small { color: #596174; font-size: 12px; line-height: 1.4; }
      .setting-row input[type="checkbox"] { width: 20px; height: 20px; flex: 0 0 auto; accent-color: #7C3AED; }
      .setting-notice { margin: 4px 0 10px; padding: 9px; border: 1px solid #E2E5EB; border-radius: 7px; background: #F1F3F5; color: #596174; font-size: 12px; line-height: 1.45; }
      .setting-notice a { color: #1E1B4B; font-weight: 650; text-decoration: underline; text-underline-offset: 2px; }
      .position-reset { width: 100%; margin-top: 10px; border: 1px solid #64748B; background: #FFFFFF; color: #1E1B4B; box-shadow: none; }
      @media (hover: hover) {
        .save:hover { background: #27AE60; transform: translate(1px, 1px); box-shadow: 1px 1px 0 #1E1B4B; }
        .skip:hover, .expand:hover, .position-reset:hover { color: #1E1B4B; border-color: #1E1B4B; background: #F1F3F5; }
      }
      @media (prefers-reduced-motion: reduce) {
        button { transition: none; }
        button:hover, button:active { transform: none; }
      }
      .icon {
        width: 16px;
        height: 16px;
        flex: 0 0 auto;
        stroke-width: 1.75;
        stroke: currentColor;
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
    `;

    widgetCard = document.createElement("div");
    widgetCard.className = "card";
    widgetCard.setAttribute("role", "region");
    widgetCard.setAttribute("aria-label", "Matchply LinkedIn Capture");
    widgetCard.hidden = true;
    widgetCard.addEventListener("click", (event) => {
      event.stopPropagation();
      const control = event.target.closest("[data-action]");
      if (!control) return;
      event.preventDefault();
      const { action, value } = control.dataset;
      if (action === "save") void attemptCapture(currentJobId(), true);
      if (action === "skip") skipCurrent();
      if (action === "toggle-settings") {
        widgetExpanded = !widgetExpanded;
        renderWidget();
      }
      if (action === "set-mode" && ["auto", "manual"].includes(value)) {
        void chrome.storage.local.set({ matchplyCaptureMode: value });
      }
      if (action === "set-delay") {
        config.delay = clampDelay(value);
        inlineDelayDraft = null;
        void chrome.storage.local.set({ matchplyCaptureDelay: config.delay });
        updateInlineDelayUI(config.delay);
      }
      if (action === "reset-position") {
        config.widgetPosition = { ...DEFAULT_WIDGET_POSITION };
        applyWidgetPosition();
        void chrome.storage.local.set({ matchplyWidgetPosition: config.widgetPosition });
      }
    });

    widgetCard.addEventListener("pointerdown", (event) => {
      const handle = event.target.closest("[data-drag-handle]");
      if (!handle || event.button !== 0 || !event.isPrimary || event.target.closest("button, a, input")) return;
      event.preventDefault();
      const rect = widgetCard.getBoundingClientRect();
      widgetDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      widgetCard.classList.add("dragging");
      widgetCard.setPointerCapture(event.pointerId);
    });

    widgetCard.addEventListener("pointermove", (event) => {
      if (!widgetDrag || event.pointerId !== widgetDrag.pointerId) return;
      const { maxLeft, maxTop } = widgetPositionLimits();
      const left = Math.max(12, Math.min(maxLeft, widgetDrag.left + event.clientX - widgetDrag.x));
      const top = Math.max(12, Math.min(maxTop, widgetDrag.top + event.clientY - widgetDrag.y));
      widgetCard.style.left = `${Math.round(left)}px`;
      widgetCard.style.top = `${Math.round(top)}px`;
      rememberWidgetPosition(left, top);
    });

    const finishWidgetDrag = (event) => {
      if (!widgetDrag || event.pointerId !== widgetDrag.pointerId) return;
      widgetDrag = null;
      widgetCard.classList.remove("dragging");
      if (widgetCard.hasPointerCapture(event.pointerId)) widgetCard.releasePointerCapture(event.pointerId);
      void chrome.storage.local.set({ matchplyWidgetPosition: config.widgetPosition });
    };
    widgetCard.addEventListener("pointerup", finishWidgetDrag);
    widgetCard.addEventListener("pointercancel", finishWidgetDrag);

    widgetCard.addEventListener("keydown", (event) => {
      if (!event.target.closest("[data-drag-handle]") || event.target.closest("button, a, input, select, textarea") || !event.key.startsWith("Arrow")) return;
      const distance = event.shiftKey ? 32 : 12;
      const delta = {
        ArrowLeft: [-distance, 0],
        ArrowRight: [distance, 0],
        ArrowUp: [0, -distance],
        ArrowDown: [0, distance],
      }[event.key];
      if (!delta) return;
      event.preventDefault();
      const rect = widgetCard.getBoundingClientRect();
      const { maxLeft, maxTop } = widgetPositionLimits();
      const left = Math.max(12, Math.min(maxLeft, rect.left + delta[0]));
      const top = Math.max(12, Math.min(maxTop, rect.top + delta[1]));
      rememberWidgetPosition(left, top);
      applyWidgetPosition();
      persistWidgetPosition();
    });

    widgetCard.addEventListener("input", (event) => {
      const input = event.target.closest('[data-setting="capture-delay"]');
      if (!input) return;
      inlineDelayDraft = clampDelay(input.value);
      updateInlineDelayUI(inlineDelayDraft);
    });

    widgetCard.addEventListener("change", (event) => {
      const control = event.target.closest("[data-setting]");
      if (!control) return;
      if (control.dataset.setting === "capture-delay") {
        config.delay = clampDelay(control.value);
        inlineDelayDraft = null;
        updateInlineDelayUI(config.delay);
        void chrome.storage.local.set({ matchplyCaptureDelay: config.delay });
      }
      if (control.dataset.setting === "capture-people") {
        config.capturePeople = control.checked;
        void chrome.storage.local.set({ matchplyCapturePeople: config.capturePeople });
      }
      if (control.dataset.setting === "show-widget") {
        config.showWidget = control.checked;
        void chrome.storage.local.set({ matchplyShowWidget: config.showWidget });
        if (!config.showWidget) renderWidget();
      }
    });

    shadowRoot.append(style, widgetCard);
    (document.body || document.documentElement).appendChild(widgetHost);
    ["click", "mousedown", "mouseup", "pointerdown", "pointermove", "pointerup", "pointercancel"].forEach((type) => {
      widgetHost.addEventListener(type, (event) => event.stopPropagation());
    });
    window.addEventListener("resize", applyWidgetPosition);
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

  function updateInlineDelayUI(seconds) {
    if (!shadowRoot) return;
    const delay = clampDelay(seconds);
    const slider = shadowRoot.querySelector('[data-setting="capture-delay"]');
    const output = shadowRoot.querySelector("[data-delay-value]");
    if (slider) {
      slider.value = String(delay);
      slider.setAttribute("aria-valuetext", `${delay} ${delay === 1 ? "segundo" : "segundos"}`);
    }
    if (output) output.textContent = `${delay} s`;
    shadowRoot.querySelectorAll('[data-action="set-delay"]').forEach((button) => {
      const active = Number(button.dataset.value) === delay;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function renderWidgetSettingsMarkup() {
    const isAuto = config.mode === "auto";
    const presets = [1, 3, 5, 10].map((seconds) => `
      <button class="delay-preset${seconds === config.delay ? " active" : ""}" type="button" data-action="set-delay" data-value="${seconds}" aria-pressed="${seconds === config.delay}">${seconds} s</button>
    `).join("");

    return `
      <section id="matchply-inline-settings" class="settings-drawer" aria-label="Ajustes de captura"${widgetExpanded ? "" : " hidden"}>
        <h2 class="drawer-title">Ajustes de captura</h2>
        <span class="field-label" id="matchply-mode-label">Cuándo guardar ofertas</span>
        <div class="mode-group" role="group" aria-labelledby="matchply-mode-label">
          <button class="mode-option${isAuto ? " active" : ""}" type="button" data-action="set-mode" data-value="auto" aria-pressed="${isAuto}">Automática</button>
          <button class="mode-option${!isAuto ? " active" : ""}" type="button" data-action="set-mode" data-value="manual" aria-pressed="${!isAuto}">Manual</button>
        </div>
        <p class="setting-hint">${isAuto ? "Guarda la oferta tras el tiempo de lectura." : "Guarda solo cuando pulses un botón de captura."}</p>

        <div class="setting-delay"${isAuto ? "" : " hidden"}>
          <div class="delay-heading">
            <label class="field-label" for="matchply-delay-slider">Tiempo de lectura</label>
            <output class="delay-value" data-delay-value for="matchply-delay-slider">${config.delay} s</output>
          </div>
          <input id="matchply-delay-slider" class="delay-slider" type="range" min="1" max="20" step="1" value="${config.delay}" aria-label="Tiempo de lectura antes de guardar" aria-valuetext="${config.delay} ${config.delay === 1 ? "segundo" : "segundos"}" data-setting="capture-delay">
          <div class="delay-presets" role="group" aria-label="Tiempos habituales">${presets}</div>
        </div>

        <label class="setting-row">
          <span class="setting-copy"><strong>Capturar personas</strong><small>Añade reclutadores y contactos visibles en LinkedIn.</small></span>
          <input type="checkbox" data-setting="capture-people" aria-describedby="matchply-people-note"${config.capturePeople ? " checked" : ""}>
        </label>
        <p id="matchply-people-note" class="setting-notice">Lee los perfiles visibles en la oferta y en «Mostrar todo», y puede guardar sus fotos disponibles en tu cuenta privada. <a href="https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions" target="_blank" rel="noopener noreferrer">Consulta las restricciones de LinkedIn</a>.</p>

        <label class="setting-row">
          <span class="setting-copy"><strong>Indicador en LinkedIn</strong><small>Si lo ocultas, puedes volver a mostrarlo desde el popup.</small></span>
          <input type="checkbox" data-setting="show-widget"${config.showWidget ? " checked" : ""}>
        </label>
        <button class="position-reset" type="button" data-action="reset-position">Restablecer posición</button>
      </section>
    `;
  }

  function renderWidget(state = {}) {
    ensureWidget();
    const kind = currentKind(state);
    const focusedElement = shadowRoot.activeElement;
    const focusedAction = focusedElement?.dataset?.action;
    const focusedValue = focusedElement?.dataset?.value;
    const focusedSetting = focusedElement?.dataset?.setting;
    const focusedDragHandle = focusedElement?.hasAttribute?.("data-drag-handle");

    if (kind === "saving" || kind === "waiting") widgetCard.setAttribute("aria-busy", "true");
    else widgetCard.removeAttribute("aria-busy");

    if (kind === "hidden") {
      widgetKind = kind;
      widgetExpanded = false;
      widgetRenderedExpanded = false;
      widgetCard.removeAttribute("aria-busy");
      widgetCard.hidden = true;
      widgetCard.classList.remove("expanded");
      widgetCard.replaceChildren();
      return;
    }

    widgetCard.hidden = false;

    if (kind === "countdown" && widgetKind === "countdown" && widgetRenderedExpanded === widgetExpanded) {
      const time = shadowRoot.querySelector("[data-remaining]");
      if (time) time.textContent = `${state.remaining ?? remainingSeconds()} s`;
      updateInlineDelayUI(inlineDelayDraft ?? config.delay);
      applyWidgetPosition();
      return;
    }

    widgetKind = kind;
    const brandSvg = `<svg class="brand-mark" viewBox="1.5 2 29 28" fill="none" aria-hidden="true"><path d="M4 27.5V7C4 5.619 5.119 4.5 6.5 4.5H7c1.083 0 2.077.685 2.382 1.726L16 22" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 13.5v14" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><path d="m10 16.5 6 6.5L28 6" stroke="#2ECC71" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const zapSvg = `<svg class="icon" viewBox="0 0 24 24"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>`;
    const checkSvg = `<svg class="icon" viewBox="0 0 24 24" style="color:#2ECC71;"><polyline points="20 6 9 17 4 12"/></svg>`;
    const skipSvg = `<svg class="icon" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
    const gripSvg = `<svg class="icon drag-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>`;
    const expandSvg = `<svg class="icon" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`;
    const collapseSvg = `<svg class="icon" viewBox="0 0 24 24"><path d="M8 3v5H3"/><path d="M16 3v5h5"/><path d="M3 16h5v5"/><path d="M21 16h-5v5"/></svg>`;
    const brand = `<div class="brand-box">${brandSvg}<span class="wordmark"><span class="wordmark-match">match</span><span class="wordmark-ply">ply</span></span></div>`;
    const headerStatus = {
      saved: `<span class="status ok" role="status" aria-live="polite">${checkSvg}<span>Oferta guardada</span></span>`,
      saving: `<span class="status" role="status" aria-live="polite">Guardando oferta…</span>`,
      waiting: `<span class="status" role="status" aria-live="polite">Leyendo oferta…</span>`,
      error: `<span class="status err" role="status" aria-live="polite">No se ha guardado</span>`,
      skipped: `<span class="status" role="status" aria-live="polite">Oferta omitida</span>`,
      manual: `<span class="status">Captura manual</span>`,
      countdown: `<span class="time">Se guarda en <span data-remaining aria-live="off">${state.remaining ?? remainingSeconds()} s</span></span>`,
    };
    const header = `<div class="top" data-drag-handle tabindex="0" role="group" aria-label="Mover indicador: usa las flechas para desplazarlo" title="Arrastra aquí para mover el indicador">${brand}<span class="drag-cue">${gripSvg}</span><div class="top-actions">${headerStatus[kind] || ""}<button class="expand" type="button" data-action="toggle-settings" aria-label="${widgetExpanded ? "Cerrar" : "Abrir"} ajustes de Matchply" aria-expanded="${widgetExpanded}" aria-controls="matchply-inline-settings" title="${widgetExpanded ? "Cerrar ajustes" : "Ver y cambiar ajustes"}">${widgetExpanded ? collapseSvg : expandSvg}</button></div></div>`;

    const blocks = {
      saved: `${photoWarning ? '<p class="notice">Los contactos se guardaron; alguna foto no está disponible. Puedes reintentar.</p>' : ''}${newPeople().length ? `<div class="actions"><button class="save" data-action="save" type="button">${photoWarning ? 'Reintentar fotos' : 'Capturar personas'} (${newPeople().length})</button></div>` : ""}`,
      saving: "",
      waiting: "",
      error: `<p class="status-detail">${escapeHtml(state.error || "No se pudo guardar la oferta.")}</p><div class="actions"><button class="save" data-action="save" type="button">${zapSvg} Reintentar</button></div>`,
      skipped: `<div class="actions"><button class="save" data-action="save" type="button">${zapSvg} Guardar oferta</button></div>`,
      manual: `<div class="actions"><button class="save" data-action="save" type="button">${zapSvg} Guardar oferta</button></div>`,
      countdown: `<div class="actions"><button class="save" data-action="save" type="button">${zapSvg} Guardar ahora</button><button class="skip" data-action="skip" type="button">${skipSvg} Omitir</button></div>`,
    };
    widgetCard.innerHTML = `${header}${blocks[kind] || blocks.countdown}${renderWidgetSettingsMarkup()}`;
    widgetCard.classList.toggle("expanded", widgetExpanded);
    widgetRenderedExpanded = widgetExpanded;
    applyWidgetPosition();

    let focusSelector = null;
    if (focusedAction) {
      focusSelector = `[data-action="${focusedAction}"]${focusedValue ? `[data-value="${focusedValue}"]` : ""}`;
    } else if (focusedSetting) {
      focusSelector = `[data-setting="${focusedSetting}"]`;
    } else if (focusedDragHandle) {
      focusSelector = "[data-drag-handle]";
    }
    if (focusSelector) {
      let nextFocus = shadowRoot.querySelector(focusSelector);
      if (!nextFocus || nextFocus.closest("[hidden]")) nextFocus = shadowRoot.querySelector('[data-action="toggle-settings"]');
      nextFocus?.focus({ preventScroll: true });
    }
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

  async function attemptPeople(jobId, force) {
    if (captureInProgress || !config.capturePeople || (!force && (config.mode !== "auto" || Date.now() < peopleRetryAt))) return { ok: true };
    const people = newPeople();
    if (!people.length || currentJobId() !== jobId || !detailMatches(jobId)) return { ok: true };
    captureInProgress = true; peopleRetryAt = Date.now() + 30000;
    try {
      const response = await chrome.runtime.sendMessage({ type: "capture-linkedin-people", payload: { sourceJobId: jobId, people } });
      if (response?.ok) {
        rememberPeople(people, response.result);
        renderWidget({ saved: true });
      } else renderWidget({ error: response?.error || "No se pudieron guardar las personas." });
      return response || { ok: false };
    } catch { renderWidget({ error: "No se pudieron guardar las personas. Reintenta." }); return { ok: false }; }
    finally { captureInProgress = false; }
  }

  async function attemptCapture(jobId, force) {
    if (captureInProgress) return { ok: false, error: "Captura en curso" };
    if (!jobId) return { ok: false, error: "No hay oferta visible" };
    if (!force && skippedJobs.has(jobId)) return { ok: false, error: "Oferta omitida" };

    if (jobId === lastCompletedJobId) return attemptPeople(jobId, force);
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
        rememberPeople(payload.people || [], result.result);
        renderWidget(result.result?.peopleError ? { error: "Oferta guardada; reintenta la captura de personas." } : { saved: true });
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
      widgetJobId = "";
      widgetExpanded = false;
      renderWidget();
      return;
    }
    if (jobId !== widgetJobId) {
      widgetJobId = jobId;
      widgetExpanded = false;
    }
    if (jobId === lastCompletedJobId) {
      if (config.mode === "auto") await attemptPeople(jobId, false);
      renderWidget({ saved: true });
      return;
    }
    if (jobId === candidateJobId) return;

    candidateJobId = jobId;
    candidateSignature = "";
    clearInterval(countdownInterval);
    countdownInterval = null;
    clearTimeout(captureRetryTimer);

    capturedPeople.clear(); peopleRetryAt = 0; photoWarning = false;
    const key = captureKey(jobId);
    const stored = await chrome.storage.local.get(key);
    if (currentJobId() !== jobId) return;
    capturedPeople = new Set(stored[key]?.people || []);
    peopleRetryAt = Number(stored[key]?.avatarRetryAt) || 0;
    photoWarning = peopleRetryAt > Date.now();
    if (stored[key]?.offer) {
      lastCompletedJobId = jobId;
      if (config.mode === "auto") await attemptPeople(jobId, false);
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

  void loadConfig().then(() => schedule(500));
})();
