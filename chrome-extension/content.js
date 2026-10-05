(() => {
  "use strict";

  const CAPTURE_VERSION = chrome.runtime.getManifest().version;
  if (globalThis.__matchplyLinkedInCapture === CAPTURE_VERSION) return;
  // globalThis is per isolated world. The dataset lock is shared, so a second
  // injection cannot mount another widget beside the one already on the page.
  let captureLock = "";
  try { captureLock = document.documentElement?.dataset?.matchplyCaptureLock || ""; } catch (_) { captureLock = ""; }
  if (captureLock === CAPTURE_VERSION) {
    globalThis.__matchplyLinkedInCapture = CAPTURE_VERSION;
    return;
  }
  globalThis.__matchplyLinkedInCapture = CAPTURE_VERSION;
  try { if (document.documentElement) document.documentElement.dataset.matchplyCaptureLock = CAPTURE_VERSION; } catch (_) { }
  document.querySelectorAll("[data-matchply-capture-host]").forEach((node) => node.remove());
  document.getElementById("matchply-header-slot")?.remove();

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
    showFloating: true,
    showHeader: false,
    showTitle: false,
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
  let mirrorHost = null;
  let mirrorRoot = null;
  let mirrorCard = null;
  let titleHost = null;
  let titleRoot = null;
  let titleCard = null;
  let widgetKind = "";
  let widgetRenderedExpanded = false;
  let widgetJobId = "";
  let widgetExpanded = false;
  let widgetRenderedFloating = true;
  let widgetRenderedHeader = false;
  let widgetRenderedTitle = false;
  let widgetDrag = null;
  let widgetPositionSaveTimer = null;
  let inlineDelayDraft = null;
  let capturedPeople = new Set();
  let peopleRetryAt = 0;
  let photoWarning = false;
  let allowBrowse = false;
  let browseTimer = null;
  let configReady = Promise.resolve();
  let jobsObserverAttached = false;

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

  function normalizeWidgetAnchor(value) {
    return value === "header" ? "header" : "float";
  }

  function headerOnly() {
    return config.showHeader && !config.showFloating;
  }

  function readSurfaces(stored) {
    const legacyShow = stored.matchplyShowWidget ?? stored.showWidget;
    const anchor = normalizeWidgetAnchor(stored.matchplyWidgetAnchor);
    const floatingSet = stored.matchplyShowFloating !== undefined;
    const headerSet = stored.matchplyShowHeader !== undefined;
    const titleSet = stored.matchplyShowTitle !== undefined;
    const showTitle = titleSet ? stored.matchplyShowTitle !== false : legacyShow !== false;
    if (!floatingSet && !headerSet) {
      if (legacyShow === false) return { showFloating: false, showHeader: false, showTitle: false };
      return { showFloating: anchor !== "header", showHeader: anchor === "header", showTitle };
    }
    return {
      showFloating: floatingSet ? stored.matchplyShowFloating !== false : legacyShow !== false && anchor !== "header",
      showHeader: headerSet ? stored.matchplyShowHeader !== false : anchor === "header" && legacyShow !== false,
      showTitle,
    };
  }

  function persistSurfaces() {
    void chrome.storage.local.set({
      matchplyShowFloating: config.showFloating,
      matchplyShowHeader: config.showHeader,
      matchplyShowTitle: config.showTitle,
      matchplyShowWidget: config.showFloating || config.showHeader || config.showTitle,
      matchplyWidgetAnchor: headerOnly() ? "header" : "float",
    });
  }

  const HOST_FLOAT_STYLE = "all:initial;display:block;width:0;height:0;overflow:visible;pointer-events:none;";
  const HOST_DOCK_STYLE = "all:initial;display:flex;align-items:center;width:auto;overflow:visible;pointer-events:none;position:relative;z-index:2147483000;";
  const HEADER_SLOT_STYLE = "display:flex;align-items:center;list-style:none;margin:0 6px 0 0;padding:0;";

  function setHostChrome(docked) {
    if (!widgetHost) return;
    widgetHost.classList.toggle("is-docked", docked);
    widgetHost.style.cssText = docked ? HOST_DOCK_STYLE : HOST_FLOAT_STYLE;
  }

  function findHeaderList() {
    const selectorsForHeader = [
      "#global-nav ul.global-nav__primary-items",
      "header.global-nav ul.global-nav__primary-items",
      "#global-nav nav.global-nav__nav ul",
      "header.global-nav nav.global-nav__nav ul",
      ".global-nav ul.global-nav__primary-items",
    ];
    for (const selector of selectorsForHeader) {
      const list = document.querySelector(selector);
      if (list) return list;
    }
    return null;
  }

  function releaseHeaderSlot() {
    document.getElementById("matchply-header-slot")?.remove();
    if (!widgetHost) return;
    const parent = document.body || document.documentElement;
    if (widgetHost.parentElement !== parent) parent.appendChild(widgetHost);
    setHostChrome(false);
  }

  function placeHeaderFallback() {
    const header = document.querySelector("#global-nav, header.global-nav");
    const search = document.querySelector("#global-nav input, header.global-nav input, .search-global-typeahead input");
    const headerRect = header?.getBoundingClientRect();
    const bandTop = headerRect ? headerRect.top : 0;
    const bandHeight = headerRect?.height || 52;
    const cardHeight = widgetCard.getBoundingClientRect().height || 36;
    const top = bandTop + Math.max(4, (bandHeight - cardHeight) / 2);
    let left = 72;
    const searchRect = search?.getBoundingClientRect();
    if (searchRect && searchRect.width > 40) left = searchRect.right + 12;
    else if (headerRect) left = headerRect.left + Math.min(headerRect.width * 0.46, 420);
    left = Math.max(12, Math.min(left, window.innerWidth - 180));
    widgetCard.style.position = "fixed";
    widgetCard.style.top = `${Math.round(top)}px`;
    widgetCard.style.left = `${Math.round(left)}px`;
    widgetCard.style.right = "auto";
    widgetCard.style.zIndex = "2147483000";
  }

  function clearCardOffset() {
    widgetCard.style.position = "";
    widgetCard.style.top = "";
    widgetCard.style.left = "";
    widgetCard.style.right = "";
  }

  function dockWidgetToHeader() {
    const list = findHeaderList();
    const currentSlot = document.getElementById("matchply-header-slot");
    if (list && currentSlot?.parentElement === list && widgetHost.parentElement === currentSlot && widgetHost.classList.contains("is-docked")) return;
    setHostChrome(true);
    if (!list) {
      const parent = document.body || document.documentElement;
      if (widgetHost.parentElement !== parent) parent.appendChild(widgetHost);
      document.getElementById("matchply-header-slot")?.remove();
      placeHeaderFallback();
      return;
    }
    let slot = document.getElementById("matchply-header-slot");
    if (!slot) {
      slot = document.createElement("li");
      slot.id = "matchply-header-slot";
    }
    // LinkedIn redraws the nav and drops foreign nodes. Reattach only when the slot left the list.
    slot.style.cssText = HEADER_SLOT_STYLE;
    if (slot.parentElement !== list) list.insertBefore(slot, list.firstElementChild);
    if (widgetHost.parentElement !== slot) slot.appendChild(widgetHost);
    clearCardOffset();
  }

  function placeDockedPanel() {
    if (!shadowRoot || !headerOnly() || !widgetExpanded) return;
    const panel = shadowRoot.querySelector(".dock-panel");
    const anchor = shadowRoot.querySelector(".top");
    if (!panel || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    panel.style.top = `${Math.round(rect.bottom + 8)}px`;
    panel.style.left = `${Math.round(left)}px`;
    panel.style.width = `${Math.round(width)}px`;
  }

  function widgetPositionLimits() {
    const rect = widgetCard.getBoundingClientRect();
    const margin = 12;
    return {
      maxLeft: Math.max(margin, window.innerWidth - rect.width - margin),
      maxTop: Math.max(margin, window.innerHeight - rect.height - margin),
    };
  }

  function undockMainCard() {
    setHostChrome(false);
    clearCardOffset();
    const parent = document.body || document.documentElement;
    if (widgetHost && widgetHost.parentElement !== parent) parent.appendChild(widgetHost);
  }

  function applyWidgetPosition() {
    if (!widgetCard || widgetCard.hidden) return;
    const docked = headerOnly();
    widgetCard.classList.toggle("docked", docked);
    if (docked) {
      removeHeaderMirror();
      dockWidgetToHeader();
      placeDockedPanel();
      return;
    }
    undockMainCard();
    const position = normalizeWidgetPosition(config.widgetPosition);
    const { maxLeft, maxTop } = widgetPositionLimits();
    widgetCard.style.position = "";
    widgetCard.style.right = "";
    widgetCard.style.left = `${Math.round(position.x * maxLeft)}px`;
    widgetCard.style.top = `${Math.round(position.y * maxTop)}px`;
    if (config.showHeader) ensureHeaderMirror();
    else {
      removeHeaderMirror();
      if (widgetHost?.parentElement?.id !== "matchply-header-slot") document.getElementById("matchply-header-slot")?.remove();
    }
  }

  const MIRROR_STYLE = `
    :host { all: initial; display: flex; align-items: center; pointer-events: none; }
    .mirror {
      pointer-events: auto;
      position: relative;
      top: 0px;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 6px;
      min-height: 36px;
      margin: 0;
      padding: 0 4px 0 8px;
      border: 1px solid #E2E5EB;
      border-radius: 8px;
      background: #FFFFFF;
      box-shadow: 0 1px 2px rgba(30, 27, 75, 0.06);
      color: #1E1B4B;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 11px;
      line-height: 1.2;
      white-space: nowrap;
    }
    .brand-box {
      display: flex;
      align-items: center;
      gap: 4px;
      font-family: Outfit, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-weight: 700;
      font-size: 12px;
      color: #1E1B4B;
    }
    .brand-mark { width: 16px; height: 16px; flex: 0 0 auto; }
    .wordmark { display: inline-flex; align-items: baseline; gap: 1px; }
    .wordmark-match { font-weight: 800; }
    .wordmark-ply { color: #6366F1; font-weight: 600; }
    .status, .time { display: inline-flex; align-items: center; gap: 4px; font-weight: 650; }
    .status { color: #596174; }
    .status.ok { color: #15803D; }
    .status.err { color: #B91C1C; }
    .time { color: #6D28D9; font-variant-numeric: tabular-nums; }
    .icon { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2.25; stroke-linecap: round; stroke-linejoin: round; }
    .hide-float {
      height: 32px;
      min-height: 32px;
      padding: 0 8px;
      border: 1px solid #64748B;
      border-radius: 8px;
      background: #FFFFFF;
      color: #1E1B4B;
      font: inherit;
      font-size: 11px;
      font-weight: 650;
      cursor: pointer;
    }
    .hide-float:focus-visible { outline: 3px solid #1E1B4B; outline-offset: 2px; }
    @media (max-width: 1100px) { .wordmark { display: none; } }
    @media (hover: hover) {
      .hide-float:hover { background: #F8FAFC; border-color: #475569; }
    }
  `;

  function removeHeaderMirror() {
    mirrorHost?.remove();
    mirrorHost = null;
    mirrorRoot = null;
    mirrorCard = null;
  }

  function placeMirrorFallback() {
    if (!mirrorCard) return;
    const header = document.querySelector("#global-nav, header.global-nav");
    const search = document.querySelector("#global-nav input, header.global-nav input, .search-global-typeahead input");
    const headerRect = header?.getBoundingClientRect();
    const bandTop = headerRect ? headerRect.top : 0;
    const bandHeight = headerRect?.height || 52;
    const cardHeight = mirrorCard.offsetHeight || 32;
    const top = bandTop + Math.max(4, (bandHeight - cardHeight) / 2);
    let left = 72;
    const searchRect = search?.getBoundingClientRect();
    if (searchRect && searchRect.width > 40) left = searchRect.right + 12;
    else if (headerRect) left = headerRect.left + Math.min(headerRect.width * 0.46, 420);
    left = Math.max(12, Math.min(left, window.innerWidth - 180));
    mirrorCard.style.position = "fixed";
    mirrorCard.style.top = `${Math.round(top)}px`;
    mirrorCard.style.left = `${Math.round(left)}px`;
    mirrorCard.style.zIndex = "2147483000";
  }

  function ensureHeaderMirror() {
    if (!mirrorHost) {
      mirrorHost = document.createElement("div");
      mirrorHost.dataset.matchplyCaptureHost = CAPTURE_VERSION;
      mirrorHost.dataset.matchplyHeaderMirror = "1";
      mirrorHost.style.cssText = HOST_DOCK_STYLE;
      mirrorRoot = mirrorHost.attachShadow({ mode: "closed" });
      const style = document.createElement("style");
      style.textContent = MIRROR_STYLE;
      mirrorCard = document.createElement("div");
      mirrorCard.className = "mirror";
      mirrorRoot.append(style, mirrorCard);
      mirrorCard.addEventListener("click", (event) => {
        event.stopPropagation();
        const control = event.target.closest("[data-action]");
        if (!control) return;
        event.preventDefault();
        if (control.dataset.action === "hide-floating") {
          config.showFloating = false;
          persistSurfaces();
          renderWidget();
        }
      });
      ["click", "mousedown", "mouseup", "pointerdown", "pointermove", "pointerup", "pointercancel"].forEach((type) => {
        mirrorHost.addEventListener(type, (event) => event.stopPropagation());
      });
    }
    const list = findHeaderList();
    const slot = document.getElementById("matchply-header-slot");
    if (slot) slot.style.cssText = HEADER_SLOT_STYLE;
    if (list && slot?.parentElement === list && mirrorHost.parentElement === slot) return;
    if (!list) {
      const parent = document.body || document.documentElement;
      if (mirrorHost.parentElement !== parent) parent.appendChild(mirrorHost);
      const leftover = document.getElementById("matchply-header-slot");
      if (leftover && !leftover.querySelector("[data-matchply-capture-host]")) leftover.remove();
      placeMirrorFallback();
      return;
    }
    let headerSlot = slot;
    if (!headerSlot) {
      headerSlot = document.createElement("li");
      headerSlot.id = "matchply-header-slot";
    }
    headerSlot.style.cssText = HEADER_SLOT_STYLE;
    if (widgetHost && widgetHost.parentElement === headerSlot) undockMainCard();
    if (headerSlot.parentElement !== list) list.insertBefore(headerSlot, list.firstElementChild);
    if (mirrorHost.parentElement !== headerSlot) headerSlot.appendChild(mirrorHost);
    if (mirrorCard) {
      mirrorCard.style.position = "";
      mirrorCard.style.top = "";
      mirrorCard.style.left = "";
    }
  }

  const TITLE_HOST_STYLE = "all:initial;display:inline-flex;align-items:center;align-self:center;vertical-align:middle;margin:0 0 0 10px;pointer-events:none;position:relative;z-index:2;flex:0 0 auto;max-width:100%;";
  const TITLE_STYLE = `
    :host { all: initial; display: inline-flex; }
    .title-pill { pointer-events: auto; }
    .row {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 28px;
      margin: 0;
      padding: 0 4px 0 8px;
      border: 1px solid #E2E5EB;
      border-radius: 8px;
      background: #FFFFFF;
      box-shadow: 0 1px 2px rgba(30, 27, 75, 0.06);
      color: #1E1B4B;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      font-weight: 650;
      line-height: 1.2;
      white-space: nowrap;
    }
    .mark { width: 16px; height: 16px; flex: 0 0 auto; }
    .status { display: inline-flex; align-items: center; gap: 4px; color: #596174; }
    .status.ok { color: #15803D; }
    .status.err { color: #B91C1C; }
    .time { color: #6D28D9; font-variant-numeric: tabular-nums; }
    .icon { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2.25; stroke-linecap: round; stroke-linejoin: round; }
    button {
      height: 26px;
      min-height: 26px;
      margin: 0;
      padding: 0 10px;
      border: 2px solid #1E1B4B;
      border-radius: 8px;
      background: #2ECC71;
      color: #1E1B4B;
      box-shadow: 2px 2px 0 #1E1B4B;
      font: inherit;
      font-size: 12px;
      font-weight: 650;
      cursor: pointer;
    }
    button:focus-visible { outline: 3px solid #1E1B4B; outline-offset: 2px; }
    @media (hover: hover) {
      button:hover { background: #27AE60; }
    }
  `;

  function findJobTitleBox() {
    const selectorsForTitle = [
      ".job-details-jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__job-title",
    ];
    for (const selector of selectorsForTitle) {
      const box = document.querySelector(selector);
      if (box) return box;
    }
    return null;
  }

  function removeTitlePill() {
    titleHost?.remove();
    titleHost = null;
    titleRoot = null;
    titleCard = null;
  }

  function ensureTitlePill() {
    const box = findJobTitleBox();
    if (!box) {
      removeTitlePill();
      return false;
    }
    const heading = box.querySelector("h1, h2");
    let link = null;
    let current = heading?.parentElement;
    while (current && current !== box) {
      if (current.tagName === "A") link = current;
      current = current.parentElement;
    }
    const anchor = link || heading;
    const parent = anchor?.parentElement || box;
    if (!titleHost) {
      titleHost = document.createElement("div");
      titleHost.dataset.matchplyCaptureHost = CAPTURE_VERSION;
      titleHost.dataset.matchplyTitleHost = "1";
      titleHost.setAttribute("role", "region");
      titleHost.setAttribute("aria-label", "Estado de la oferta en Matchply");
      titleHost.style.cssText = TITLE_HOST_STYLE;
      titleRoot = titleHost.attachShadow({ mode: "closed" });
      const style = document.createElement("style");
      style.textContent = TITLE_STYLE;
      titleCard = document.createElement("div");
      titleCard.className = "title-pill";
      titleRoot.append(style, titleCard);
      titleCard.addEventListener("click", (event) => {
        event.stopPropagation();
        const control = event.target.closest("[data-action]");
        if (!control) return;
        event.preventDefault();
        if (control.dataset.action === "save") void attemptCapture(currentJobId(), true);
      });
      ["click", "mousedown", "mouseup", "pointerdown", "pointermove", "pointerup", "pointercancel"].forEach((type) => {
        titleHost.addEventListener(type, (event) => event.stopPropagation());
      });
    }
    titleHost.style.cssText = TITLE_HOST_STYLE;
    const previous = titleHost.previousElementSibling || titleHost.previousSibling;
    if (titleHost.parentElement === parent && (!anchor || previous === anchor)) return true;
    const next = anchor ? anchor.nextSibling : null;
    if (next) parent.insertBefore(titleHost, next);
    else parent.appendChild(titleHost);
    return true;
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
      "matchplyShowFloating",
      "matchplyShowHeader",
      "matchplyShowTitle",
      "matchplyCapturePeople",
      "matchplyExtensionInstallation",
      "matchplyWidgetPosition",
      "matchplyWidgetAnchor",
    ]);
    config.mode = stored.matchplyCaptureMode || stored.captureMode || "auto";
    config.delay = clampDelay(stored.matchplyCaptureDelay ?? stored.captureDelaySec ?? 3);
    const surfaces = readSurfaces(stored);
    config.showFloating = surfaces.showFloating;
    config.showHeader = surfaces.showHeader;
    config.showTitle = surfaces.showTitle;
    config.capturePeople = stored.matchplyCapturePeople === true;
    config.installationId = stored.matchplyExtensionInstallation?.id || "";
    config.widgetPosition = normalizeWidgetPosition(stored.matchplyWidgetPosition);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    let restart = false;
    const mode = changes.matchplyCaptureMode || changes.captureMode;
    const delay = changes.matchplyCaptureDelay || changes.captureDelaySec;
    const widgetPosition = changes.matchplyWidgetPosition;
    const surfaceChange = changes.matchplyShowFloating || changes.matchplyShowHeader || changes.matchplyShowTitle || changes.matchplyWidgetAnchor || changes.matchplyShowWidget || changes.showWidget;
    if (mode) { config.mode = mode.newValue || "auto"; restart = true; }
    if (delay) { config.delay = clampDelay(delay.newValue); inlineDelayDraft = null; restart = true; }
    if (surfaceChange) {
      if (changes.matchplyShowFloating || changes.matchplyShowHeader || changes.matchplyShowTitle) {
        if (changes.matchplyShowFloating) config.showFloating = changes.matchplyShowFloating.newValue !== false;
        if (changes.matchplyShowHeader) config.showHeader = changes.matchplyShowHeader.newValue !== false;
        if (changes.matchplyShowTitle) config.showTitle = changes.matchplyShowTitle.newValue !== false;
      } else {
        const surfaces = readSurfaces({
          matchplyShowWidget: (changes.matchplyShowWidget || changes.showWidget)
            ? (changes.matchplyShowWidget || changes.showWidget).newValue
            : (config.showFloating || config.showHeader || config.showTitle),
          matchplyWidgetAnchor: changes.matchplyWidgetAnchor
            ? changes.matchplyWidgetAnchor.newValue
            : (headerOnly() ? "header" : "float"),
          matchplyShowTitle: config.showTitle,
        });
        config.showFloating = surfaces.showFloating;
        config.showHeader = surfaces.showHeader;
        config.showTitle = surfaces.showTitle;
      }
    }
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
      if (allowBrowse) renderWidget();
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
    widgetHost.dataset.matchplyCaptureHost = CAPTURE_VERSION;
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
      .pin {
        width: 44px;
        min-width: 44px;
        height: 44px;
        padding: 0;
        border: 1px solid #64748B;
        background: #FFFFFF;
        color: #1E1B4B;
      }
      .pin.active { border-color: #7C3AED; background: #F5F3FF; color: #6D28D9; }
      .quick {
        width: 44px;
        min-width: 44px;
        height: 44px;
        padding: 0;
        color: #1E1B4B;
        background: #2ECC71;
        box-shadow: none;
      }
      .quick.quiet { border: 1px solid #64748B; background: #FAFAFA; color: #596174; }
      .dock-panel { display: block; }
      .card.docked {
        position: relative;
        top: 0px;
        width: max-content;
        max-width: calc(100vw - 24px);
        padding: 0;
        background: transparent;
        border: 0;
        box-shadow: none;
        animation: none;
        overflow: visible;
      }
      .card.docked .top {
        min-height: 36px;
        margin: 0;
        padding: 0 4px 0 8px;
        cursor: default;
        border: 1px solid #E2E5EB;
        border-radius: 8px;
        background: #FFFFFF;
        box-shadow: 0 1px 2px rgba(30, 27, 75, 0.06);
      }
      .card.docked .drag-cue { display: none; }
      .card.docked .brand-box { font-size: 12px; }
      .card.docked .brand-mark { width: 16px; height: 16px; }
      .card.docked .time,
      .card.docked .status { font-size: 11px; }
      .card.docked .pin,
      .card.docked .expand,
      .card.docked .quick {
        width: 32px;
        min-width: 32px;
        height: 32px;
        min-height: 32px;
      }
      .card.docked .dock-panel {
        position: fixed;
        z-index: 2147483000;
        width: min(360px, calc(100vw - 24px));
        max-height: min(72vh, 640px);
        overflow-y: auto;
        padding: 14px 16px;
        background: #FFFFFF;
        color: #1E1B4B;
        border: 1px solid #E2E5EB;
        border-radius: 10px;
        box-shadow: 0 8px 28px rgba(30, 27, 75, 0.14);
      }
      .card.docked:not(.expanded) .dock-panel { display: none !important; }
      .card.docked.expanded {
        width: max-content;
        max-height: none;
        overflow: visible;
        background: transparent;
        border: 0;
        box-shadow: none;
      }
      .card.docked.expanded .top {
        position: relative;
        top: auto;
        z-index: auto;
        margin: 0;
        padding: 0 4px 0 8px;
        background: #FFFFFF;
      }
      .card.docked .dock-panel .actions { display: none; }
      @media (max-width: 1100px) {
        .card.docked .wordmark { display: none; }
      }
      @media (hover: hover) {
        .save:hover, .quick:hover { background: #27AE60; transform: translate(1px, 1px); box-shadow: 1px 1px 0 #1E1B4B; }
        .card.docked .quick:hover, .quick.quiet:hover { transform: none; box-shadow: none; }
        .skip:hover, .expand:hover, .position-reset:hover, .pin:hover, .quick.quiet:hover { color: #1E1B4B; border-color: #1E1B4B; background: #F1F3F5; }
        .pin.active:hover { border-color: #7C3AED; background: #EDE9FE; color: #6D28D9; }
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
      if (action === "toggle-header" || action === "toggle-anchor") {
        if (config.showHeader && !config.showFloating) {
          config.showHeader = false;
          config.showFloating = true;
        } else {
          config.showHeader = !config.showHeader;
        }
        persistSurfaces();
        renderWidget();
      }
      if (action === "set-anchor" && (value === "float" || value === "header")) {
        config.showHeader = value === "header";
        config.showFloating = value !== "header";
        persistSurfaces();
        renderWidget();
      }
      if (action === "hide-floating") {
        config.showFloating = false;
        persistSurfaces();
        renderWidget();
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
      if (event.key === "Escape" && widgetExpanded) {
        event.preventDefault();
        widgetExpanded = false;
        renderWidget();
        return;
      }
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
      if (control.dataset.setting === "show-floating" || control.dataset.setting === "show-header" || control.dataset.setting === "show-title") {
        if (control.dataset.setting === "show-floating") config.showFloating = control.checked;
        if (control.dataset.setting === "show-header") config.showHeader = control.checked;
        if (control.dataset.setting === "show-title") config.showTitle = control.checked;
        persistSurfaces();
        renderWidget();
      }
    });

    shadowRoot.append(style, widgetCard);
    (document.body || document.documentElement).appendChild(widgetHost);
    ["click", "mousedown", "mouseup", "pointerdown", "pointermove", "pointerup", "pointercancel"].forEach((type) => {
      widgetHost.addEventListener(type, (event) => event.stopPropagation());
    });
    setHostChrome(false);
    window.addEventListener("resize", applyWidgetPosition);
    window.addEventListener("scroll", () => {
      if (headerOnly() && widgetCard && !widgetCard.hidden) applyWidgetPosition();
    }, true);
    document.addEventListener("click", () => {
      if (widgetExpanded && headerOnly()) {
        widgetExpanded = false;
        renderWidget();
      }
    });
  }

  function currentKind(state = {}) {
    if (!config.showFloating && !config.showHeader && !config.showTitle) return "hidden";
    const jobId = currentJobId();
    if (!jobId) return allowBrowse && onJobsSurface() ? "browse" : "hidden";
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
          <span class="setting-copy"><strong>Indicador libre</strong><small>Tarjeta que puedes arrastrar. Si la ocultas, la cabecera sigue visible.</small></span>
          <input type="checkbox" data-setting="show-floating"${config.showFloating ? " checked" : ""}>
        </label>
        <label class="setting-row">
          <span class="setting-copy"><strong>Indicador en la cabecera</strong><small>Pastilla fija en la barra de LinkedIn.</small></span>
          <input type="checkbox" data-setting="show-header"${config.showHeader ? " checked" : ""}>
        </label>
        <label class="setting-row">
          <span class="setting-copy"><strong>Indicador en el título</strong><small>Pastilla junto al nombre de la oferta: si está guardada, el tiempo restante y Capturar ahora.</small></span>
          <input type="checkbox" data-setting="show-title"${config.showTitle ? " checked" : ""}>
        </label>
        <p class="setting-hint">Puedes mostrar el libre, la cabecera, el del título o ninguno. Cada uno se oculta por separado.</p>
        ${config.showFloating ? `<button class="position-reset" type="button" data-action="reset-position">Restablecer posición</button>` : ""}
      </section>
    `;
  }

  function statusText(kind, state = {}) {
    if (kind === "saved") return "Oferta guardada";
    if (kind === "saving") return "Guardando oferta…";
    if (kind === "waiting") return "Leyendo oferta…";
    if (kind === "error") return "No se ha guardado";
    if (kind === "skipped") return "Oferta omitida";
    if (kind === "manual") return "Captura manual";
    if (kind === "browse") return "Elige una oferta";
    return `Se guarda en ${state.remaining ?? remainingSeconds()} s`;
  }

  function titleAction(kind) {
    if (kind === "countdown" || kind === "manual" || kind === "skipped") return "Capturar ahora";
    if (kind === "error") return "Reintentar";
    if (kind === "saved" && newPeople().length) return "Capturar personas";
    return "";
  }

  function paintTitlePill(kind, state = {}) {
    if (!config.showTitle || kind === "hidden" || kind === "browse" || !currentJobId()) {
      removeTitlePill();
      return;
    }
    if (!ensureTitlePill() || !titleCard) return;
    const saved = kind === "saved";
    const label = saved
      ? "Oferta guardada"
      : kind === "saving"
        ? "Guardando…"
        : kind === "waiting"
          ? "Leyendo…"
          : kind === "error"
            ? "No guardada"
            : kind === "skipped"
              ? "Omitida"
              : "Sin guardar";
    const statusClass = saved ? "status ok" : kind === "error" ? "status err" : "status";
    const check = saved ? '<svg class="icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>' : "";
    const time = kind === "countdown"
      ? `<span class="time" data-title-remaining>Se guarda en ${escapeHtml(String(state.remaining ?? remainingSeconds()))} s</span>`
      : "";
    const action = titleAction(kind);
    const button = action
      ? `<button type="button" data-action="save">${escapeHtml(action)}</button>`
      : "";
    const mark = `<svg class="mark" viewBox="1.5 2 29 28" fill="none" aria-hidden="true"><path d="M4 27.5V7C4 5.619 5.119 4.5 6.5 4.5H7c1.083 0 2.077.685 2.382 1.726L16 22" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 13.5v14" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><path d="m10 16.5 6 6.5L28 6" stroke="#2ECC71" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    titleCard.innerHTML = `<div class="row">${mark}<span class="${statusClass}" role="status">${check}<span>${escapeHtml(label)}</span></span>${time}${button}</div>`;
  }

  function paintHeaderMirror(kind, state = {}) {
    if (!config.showHeader || !config.showFloating || kind === "hidden") {
      removeHeaderMirror();
      return;
    }
    ensureHeaderMirror();
    if (!mirrorCard) return;
    const text = escapeHtml(statusText(kind, state));
    const status = kind === "countdown"
      ? `<span class="time" data-mirror-status>${text}</span>`
      : `<span class="${kind === "saved" ? "status ok" : kind === "error" ? "status err" : "status"}" data-mirror-status role="status">${kind === "saved" ? '<svg class="icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>' : ""}<span>${text}</span></span>`;
    const brand = `<div class="brand-box"><svg class="brand-mark" viewBox="1.5 2 29 28" fill="none" aria-hidden="true"><path d="M4 27.5V7C4 5.619 5.119 4.5 6.5 4.5H7c1.083 0 2.077.685 2.382 1.726L16 22" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 13.5v14" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/><path d="m10 16.5 6 6.5L28 6" stroke="#2ECC71" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="wordmark"><span class="wordmark-match">match</span><span class="wordmark-ply">ply</span></span></div>`;
    mirrorCard.innerHTML = `<div class="top">${brand}${status}<button class="hide-float" type="button" data-action="hide-floating" aria-label="Ocultar el indicador libre" title="Ocultar el indicador libre">Ocultar libre</button></div>`;
  }

  function renderWidget(state = {}) {
    const kind = currentKind(state);
    if (kind === "hidden") {
      const alreadyHidden = widgetKind === "hidden" && (!widgetCard || widgetCard.hidden) && !mirrorHost && !titleHost && !document.getElementById("matchply-header-slot");
      widgetKind = "hidden";
      widgetExpanded = false;
      widgetRenderedExpanded = false;
      widgetRenderedFloating = config.showFloating;
      widgetRenderedHeader = config.showHeader;
      widgetRenderedTitle = config.showTitle;
      if (alreadyHidden) return;
      if (widgetCard) {
        widgetCard.hidden = true;
        widgetCard.removeAttribute("aria-busy");
        widgetCard.classList.remove("expanded", "docked");
        widgetCard.replaceChildren();
      }
      removeHeaderMirror();
      removeTitlePill();
      releaseHeaderSlot();
      return;
    }

    const showCard = config.showFloating || config.showHeader;
    if (!showCard) {
      if (widgetCard) {
        widgetCard.hidden = true;
        widgetCard.removeAttribute("aria-busy");
        widgetCard.classList.remove("expanded", "docked");
      }
      removeHeaderMirror();
      releaseHeaderSlot();
      if (
        kind === "countdown"
        && widgetKind === "countdown"
        && widgetRenderedTitle === config.showTitle
        && titleRoot?.querySelector("[data-title-remaining]")
      ) {
        titleRoot.querySelector("[data-title-remaining]").textContent = `Se guarda en ${state.remaining ?? remainingSeconds()} s`;
        ensureTitlePill();
        return;
      }
      widgetKind = kind;
      widgetRenderedTitle = config.showTitle;
      paintTitlePill(kind, state);
      return;
    }

    ensureWidget();
    const focusedElement = shadowRoot.activeElement;
    const focusedAction = focusedElement?.dataset?.action;
    const focusedValue = focusedElement?.dataset?.value;
    const focusedSetting = focusedElement?.dataset?.setting;
    const focusedDragHandle = focusedElement?.hasAttribute?.("data-drag-handle");

    if (kind === "saving" || kind === "waiting") widgetCard.setAttribute("aria-busy", "true");
    else widgetCard.removeAttribute("aria-busy");

    widgetCard.hidden = false;

    if (
      kind === "countdown"
      && widgetKind === "countdown"
      && widgetRenderedExpanded === widgetExpanded
      && widgetRenderedFloating === config.showFloating
      && widgetRenderedHeader === config.showHeader
      && widgetRenderedTitle === config.showTitle
    ) {
      const label = `${state.remaining ?? remainingSeconds()} s`;
      const time = shadowRoot.querySelector("[data-remaining]");
      if (time) time.textContent = label;
      const mirrorStatus = mirrorRoot?.querySelector("[data-mirror-status]");
      if (mirrorStatus) mirrorStatus.textContent = `Se guarda en ${label}`;
      const titleTime = titleRoot?.querySelector("[data-title-remaining]");
      if (titleTime) titleTime.textContent = `Se guarda en ${label}`;
      else if (config.showTitle) paintTitlePill(kind, state);
      updateInlineDelayUI(inlineDelayDraft ?? config.delay);
      if (headerOnly()) applyWidgetPosition();
      else if (config.showHeader) ensureHeaderMirror();
      if (config.showTitle) ensureTitlePill();
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
    const pinSvg = `<svg class="icon" viewBox="0 0 24 24"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 0-1-1 2 2 0 0 0-2-2 2 2 0 0 0-2 2 1 1 0 0 0-1 1z"/></svg>`;
    const brand = `<div class="brand-box">${brandSvg}<span class="wordmark"><span class="wordmark-match">match</span><span class="wordmark-ply">ply</span></span></div>`;
    const headerStatus = {
      saved: `<span class="status ok" role="status" aria-live="polite">${checkSvg}<span>Oferta guardada</span></span>`,
      saving: `<span class="status" role="status" aria-live="polite">Guardando oferta…</span>`,
      waiting: `<span class="status" role="status" aria-live="polite">Leyendo oferta…</span>`,
      error: `<span class="status err" role="status" aria-live="polite">No se ha guardado</span>`,
      skipped: `<span class="status" role="status" aria-live="polite">Oferta omitida</span>`,
      manual: `<span class="status">Captura manual</span>`,
      browse: `<span class="status">Elige una oferta</span>`,
      countdown: `<span class="time">Se guarda en <span data-remaining aria-live="off">${state.remaining ?? remainingSeconds()} s</span></span>`,
    };
    const docked = headerOnly();
    const quickLabel = kind === "error" ? "Reintentar" : kind === "saved" ? "Capturar personas" : kind === "countdown" ? "Guardar ahora" : "Guardar oferta";
    const quick = !docked ? "" : kind === "countdown"
      ? `<button class="quick" data-action="save" type="button" aria-label="Guardar ahora" title="Guardar ahora">${zapSvg}</button><button class="quick quiet" data-action="skip" type="button" aria-label="Omitir" title="Omitir">${skipSvg}</button>`
      : (kind === "manual" || kind === "skipped" || kind === "error" || (kind === "saved" && newPeople().length))
        ? `<button class="quick" data-action="save" type="button" aria-label="${quickLabel}" title="${quickLabel}">${zapSvg}</button>`
        : "";
    const pinButton = `<button class="pin${config.showHeader ? " active" : ""}" type="button" data-action="toggle-header" aria-pressed="${config.showHeader}" aria-label="${config.showHeader ? "Quitar el indicador de la cabecera" : "Mostrar el indicador en la cabecera de LinkedIn"}" title="${config.showHeader ? "Quitar de la cabecera" : "Mostrar en la cabecera"}">${pinSvg}</button>`;
    const dragAttrs = docked ? "" : ` data-drag-handle tabindex="0" role="group" aria-label="Mover indicador: usa las flechas para desplazarlo" title="Arrastra aquí para mover el indicador"`;
    const grip = docked ? "" : `<span class="drag-cue">${gripSvg}</span>`;
    const header = `<div class="top"${dragAttrs}>${brand}${grip}<div class="top-actions">${headerStatus[kind] || ""}${quick}${pinButton}<button class="expand" type="button" data-action="toggle-settings" aria-label="${widgetExpanded ? "Cerrar" : "Abrir"} ajustes de Matchply" aria-expanded="${widgetExpanded}" aria-controls="matchply-inline-settings" title="${widgetExpanded ? "Cerrar ajustes" : "Ver y cambiar ajustes"}">${widgetExpanded ? collapseSvg : expandSvg}</button></div></div>`;

    const blocks = {
      saved: `${photoWarning ? '<p class="notice">Los contactos se guardaron; alguna foto no está disponible. Puedes reintentar.</p>' : ''}${newPeople().length ? `<div class="actions"><button class="save" data-action="save" type="button">${photoWarning ? 'Reintentar fotos' : 'Capturar personas'} (${newPeople().length})</button></div>` : ""}`,
      saving: "",
      waiting: "",
      browse: `<p class="notice">Abre una oferta para guardarla en Matchply.</p>`,
      error: `<p class="status-detail">${escapeHtml(state.error || "No se pudo guardar la oferta.")}</p><div class="actions"><button class="save" data-action="save" type="button">${zapSvg} Reintentar</button></div>`,
      skipped: `<div class="actions"><button class="save" data-action="save" type="button">${zapSvg} Guardar oferta</button></div>`,
      manual: `<div class="actions"><button class="save" data-action="save" type="button">${zapSvg} Guardar oferta</button></div>`,
      countdown: `<div class="actions"><button class="save" data-action="save" type="button">${zapSvg} Guardar ahora</button><button class="skip" data-action="skip" type="button">${skipSvg} Omitir</button></div>`,
    };
    widgetCard.innerHTML = `${header}<div class="dock-panel">${blocks[kind] || blocks.countdown}${renderWidgetSettingsMarkup()}</div>`;
    widgetCard.classList.toggle("expanded", widgetExpanded);
    widgetRenderedExpanded = widgetExpanded;
    widgetRenderedFloating = config.showFloating;
    widgetRenderedHeader = config.showHeader;
    widgetRenderedTitle = config.showTitle;
    applyWidgetPosition();
    paintHeaderMirror(kind, state);
    paintTitlePill(kind, state);

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
      if (!onJobsSurface()) {
        widgetJobId = "";
        widgetExpanded = false;
        allowBrowse = false;
        clearTimeout(browseTimer);
        browseTimer = null;
        renderWidget();
        return;
      }
      if (allowBrowse || browseTimer) {
        if (allowBrowse) applyWidgetPosition();
        return;
      }
      widgetJobId = "";
      allowBrowse = false;
      renderWidget();
      browseTimer = setTimeout(() => {
        browseTimer = null;
        if (!currentJobId() && onJobsSurface()) {
          allowBrowse = true;
          renderWidget();
        }
      }, 700);
      return;
    }

    allowBrowse = false;
    clearTimeout(browseTimer);
    browseTimer = null;
    if (jobId !== widgetJobId) {
      widgetJobId = jobId;
      widgetExpanded = false;
    }
    if (jobId === lastCompletedJobId) {
      if (config.mode === "auto") await attemptPeople(jobId, false);
      renderWidget({ saved: true });
      return;
    }
    if (jobId === candidateJobId) {
      if (headerOnly()) applyWidgetPosition();
      else if (config.showHeader) ensureHeaderMirror();
      if (config.showTitle) ensureTitlePill();
      return;
    }

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

  function onJobsSurface() {
    return /^\/jobs(?:\/|$)/.test(location.pathname);
  }

  function syncJobWatchers() {
    const jobs = onJobsSurface();
    if (jobs && !jobsObserverAttached) {
      observer.observe(document.documentElement, { childList: true, subtree: true });
      jobsObserverAttached = true;
    } else if (!jobs && jobsObserverAttached) {
      observer.disconnect();
      jobsObserverAttached = false;
    }
  }

  function schedule(delay = 400) {
    clearTimeout(jobWatchTimer);
    jobWatchTimer = setTimeout(() => {
      syncJobWatchers();
      void onJobMaybeChanged();
    }, delay);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "trigger-manual-capture") return false;
    (async () => {
      await configReady;
      sendResponse(await attemptCapture(currentJobId(), true));
    })();
    return true;
  });

  const observer = new MutationObserver(() => schedule(300));
  window.addEventListener("popstate", () => schedule(200));
  window.navigation?.addEventListener?.("navigatesuccess", () => schedule(150));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") schedule(200);
  });
  window.addEventListener("pageshow", () => schedule(200));
  setInterval(() => schedule(700), 700);
  configReady = loadConfig().then(() => schedule(300));
})();
