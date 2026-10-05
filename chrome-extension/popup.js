const API_BASE = "http://localhost:3000";

document.addEventListener("DOMContentLoaded", () => {
  const pairingCard = document.getElementById("pairingCard");
  const connectedPanel = document.getElementById("connectedPanel");
  const pairingCodeInput = document.getElementById("pairingCodeInput");
  const pairingHelp = document.getElementById("pairingHelp");
  const pairBtn = document.getElementById("pairBtn");
  const disconnectBtn = document.getElementById("disconnectBtn");
  const connBadge = document.getElementById("connBadge");
  const connBadgeText = document.getElementById("connBadgeText");
  const saveNowBtn = document.getElementById("saveNowBtn");
  const saveNowHint = document.getElementById("saveNowHint");
  const modeAutoBtn = document.getElementById("modeAutoBtn");
  const modeManualBtn = document.getElementById("modeManualBtn");
  const modeHelp = document.getElementById("modeHelp");
  const delaySection = document.getElementById("delaySection");
  const delaySlider = document.getElementById("delaySlider");
  const delayDisplay = document.getElementById("delayDisplay");
  const peopleToggle = document.getElementById("peopleToggle");
  const floatingToggle = document.getElementById("floatingToggle");
  const headerToggle = document.getElementById("headerToggle");
  const titleToggle = document.getElementById("titleToggle");
  const powerToggle = document.getElementById("powerToggle");
  const powerLabel = document.getElementById("powerLabel");
  const powerSwitch = powerToggle?.closest(".power-switch");
  const presetButtons = [...document.querySelectorAll(".preset-button")];
  const statusMessage = document.getElementById("statusMessage");
  let extensionEnabled = true;
  const JOB_PAGE = /^https:\/\/(?:[a-z0-9-]+\.)*linkedin\.com\/jobs\//i;
  const LINKEDIN_PAGE = /^https:\/\/(?:[a-z0-9-]+\.)*linkedin\.com\//i;

  function showMsg(text, type = "") {
    if (!statusMessage) return;
    statusMessage.textContent = text;
    statusMessage.className = `feedback${type === "ok" ? " msg-ok" : type === "err" ? " msg-err" : ""}`;
  }

  function clampDelay(val) {
    const n = Number(val);
    return Number.isFinite(n) ? Math.min(20, Math.max(1, Math.round(n))) : 3;
  }

  function updateModeUI(mode) {
    const isAuto = mode !== "manual";
    modeAutoBtn?.classList.toggle("active", isAuto);
    modeManualBtn?.classList.toggle("active", !isAuto);
    modeAutoBtn?.setAttribute("aria-pressed", String(isAuto));
    modeManualBtn?.setAttribute("aria-pressed", String(!isAuto));
    if (modeHelp) {
      modeHelp.textContent = isAuto
        ? "Se guarda sola tras leer la oferta."
        : "La oferta solo se guarda cuando pulsas un botón de captura.";
    }
    if (delaySection) delaySection.style.display = isAuto ? "block" : "none";
  }

  function surfacesFromStored(stored) {
    const legacyShow = stored.matchplyShowWidget;
    const anchor = stored.matchplyWidgetAnchor === "header" ? "header" : "float";
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

  async function persistSurfaces(showFloating, showHeader, showTitle) {
    await chrome.storage.local.set({
      matchplyShowFloating: showFloating,
      matchplyShowHeader: showHeader,
      matchplyShowTitle: showTitle,
      matchplyShowWidget: showFloating || showHeader || showTitle,
      matchplyWidgetAnchor: showHeader && !showFloating ? "header" : "float",
    });
  }

  async function ensureLinkedInScript(tabId) {
    try {
      const version = chrome.runtime.getManifest().version;
      const [probe] = await chrome.scripting.executeScript({
        target: { tabId, allFrames: false },
        func: (expected) => {
          try {
            if (globalThis.__matchplyLinkedInCapture === expected) return true;
            return document.documentElement?.dataset?.matchplyCaptureLock === expected;
          } catch (_) {
            return globalThis.__matchplyLinkedInCapture === expected;
          }
        },
        args: [version],
      });
      if (probe?.result) return true;
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: false },
        files: ["people.js", "content.js"],
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  function updateDelayUI(sec) {
    if (delaySlider) delaySlider.value = String(sec);
    if (delaySlider) delaySlider.setAttribute("aria-valuetext", `${sec} ${sec === 1 ? "segundo" : "segundos"}`);
    if (delayDisplay) delayDisplay.textContent = `${sec} s`;
    presetButtons.forEach(btn => {
      const isActive = Number(btn.dataset.sec) === Number(sec);
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });
  }

  function applyPowerSwitch() {
    if (powerToggle) powerToggle.checked = extensionEnabled;
    const label = extensionEnabled ? "Activa" : "Apagada";
    const hint = extensionEnabled
      ? "Extensión activa. Pulsa para apagarla."
      : "Extensión apagada. Pulsa para encenderla.";
    if (powerLabel) powerLabel.textContent = label;
    powerSwitch?.classList.toggle("is-off", !extensionEnabled);
    if (powerToggle) {
      powerToggle.setAttribute("aria-label", hint);
      powerToggle.title = hint;
    }
  }

  async function updateCaptureAction() {
    if (!saveNowBtn) return;
    if (!extensionEnabled) {
      saveNowBtn.disabled = true;
      const label = saveNowBtn.querySelector("span");
      if (label) label.textContent = "Extensión apagada";
      if (saveNowHint) saveNowHint.textContent = "Enciende la extensión para capturar ofertas en LinkedIn.";
      return;
    }
    let tab;
    try {
      [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    } catch (_) {}

    const isLinkedIn = LINKEDIN_PAGE.test(tab?.url || "");
    const isJobPage = JOB_PAGE.test(tab?.url || "");
    if (isLinkedIn && tab?.id) await ensureLinkedInScript(tab.id);
    const label = saveNowBtn.querySelector("span");
    saveNowBtn.disabled = !isJobPage;
    if (label) label.textContent = isJobPage ? "Guardar oferta ahora" : "Abre una oferta en LinkedIn";
    if (saveNowHint) {
      saveNowHint.textContent = isJobPage
        ? "Captura la oferta visible en la pestaña activa."
        : "Para guardar desde aquí, abre una oferta de empleo en LinkedIn.";
    }
  }

  async function loadState() {
    const stored = await chrome.storage.local.get([
      "matchplyExtensionToken",
      "matchplyExtensionInstallation",
      "matchplyCaptureMode",
      "matchplyCaptureDelay",
      "matchplyShowWidget",
      "matchplyShowFloating",
      "matchplyShowHeader",
      "matchplyShowTitle",
      "matchplyCapturePeople",
      "matchplyWidgetAnchor",
      "matchplyExtensionEnabled",
    ]);

    const token = stored.matchplyExtensionToken;
    const isConnected = Boolean(token);

    if (pairingCard) pairingCard.hidden = isConnected;
    if (connectedPanel) connectedPanel.hidden = !isConnected;

    if (connBadge) {
      if (isConnected) {
        if (connBadgeText) connBadgeText.textContent = "Conectada";
        connBadge.className = "connection-badge connected";
      } else {
        if (connBadgeText) connBadgeText.textContent = "No vinculada";
        connBadge.className = "connection-badge";
      }
    }

    const mode = stored.matchplyCaptureMode || "auto";
    const delay = clampDelay(stored.matchplyCaptureDelay || 3);
    const surfaces = surfacesFromStored(stored);
    extensionEnabled = stored.matchplyExtensionEnabled !== false;
    applyPowerSwitch();

    updateModeUI(mode);
    updateDelayUI(delay);
    if (floatingToggle) floatingToggle.checked = surfaces.showFloating;
    if (headerToggle) headerToggle.checked = surfaces.showHeader;
    if (titleToggle) titleToggle.checked = surfaces.showTitle;
    if (peopleToggle) peopleToggle.checked = stored.matchplyCapturePeople === true;

    if (!isConnected) return;

    try {
      const remote = await chrome.runtime.sendMessage({ type: "matchply-status" });
      if (remote?.connected === false) {
        await chrome.storage.local.remove(["matchplyExtensionToken", "matchplyExtensionScope", "matchplyExtensionInstallation"]);
        if (pairingCard) pairingCard.hidden = false;
        if (connectedPanel) connectedPanel.hidden = true;
        if (connBadge) {
          if (connBadgeText) connBadgeText.textContent = "Sesión expirada";
          connBadge.className = "connection-badge";
        }
        showMsg("La sesión fue revocada o caducó. Genera un nuevo código.", "err");
      }
    } catch (_) {}
    await updateCaptureAction();
  }

  pairingCodeInput?.addEventListener("input", () => {
    pairingCodeInput.value = pairingCodeInput.value.toUpperCase().replace(/\s/g, "");
    if (pairingHelp) pairingHelp.textContent = `${pairingCodeInput.value.length}/8 caracteres`;
  });

  pairingCodeInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      pairBtn?.click();
    }
  });

  pairBtn?.addEventListener("click", async () => {
    const code = pairingCodeInput?.value.trim().toUpperCase() || "";
    if (!/^[A-Z2-9]{8}$/.test(code)) {
      showMsg("Introduce un código válido de 8 caracteres.", "err");
      pairingCodeInput?.focus();
      return;
    }

    pairBtn.disabled = true;
    pairBtn.setAttribute("aria-busy", "true");
    const pairLabel = pairBtn.querySelector("span");
    if (pairLabel) pairLabel.textContent = "Conectando…";
    showMsg("");

    try {
      const response = await fetch(`${API_BASE}/api/extension/pair/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          extensionVersion: chrome.runtime.getManifest().version,
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.token) {
        throw new Error(body.error || "Código inválido o caducado.");
      }

      await chrome.storage.local.set({
        matchplyExtensionToken: body.token,
        matchplyExtensionScope: body.scope,
        matchplyExtensionInstallation: body.installation,
        matchplyCaptureMode: "auto",
        matchplyCaptureDelay: 3,
        matchplyShowWidget: true,
      });

      if (pairingCodeInput) pairingCodeInput.value = "";
      showMsg("¡Extensión vinculada con éxito!", "ok");
      await loadState();
    } catch (err) {
      showMsg(err.message || "Error al conectar con Matchply.", "err");
    } finally {
      pairBtn.disabled = false;
      pairBtn.removeAttribute("aria-busy");
      if (pairLabel) pairLabel.textContent = "Conectar extensión";
    }
  });

  modeAutoBtn?.addEventListener("click", async () => {
    updateModeUI("auto");
    await chrome.storage.local.set({ matchplyCaptureMode: "auto" });
  });

  modeManualBtn?.addEventListener("click", async () => {
    updateModeUI("manual");
    await chrome.storage.local.set({ matchplyCaptureMode: "manual" });
  });

  delaySlider?.addEventListener("input", async (e) => {
    const sec = clampDelay(e.target.value);
    updateDelayUI(sec);
    await chrome.storage.local.set({ matchplyCaptureDelay: sec });
  });

  presetButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      const sec = clampDelay(btn.dataset.sec);
      updateDelayUI(sec);
      await chrome.storage.local.set({ matchplyCaptureDelay: sec });
    });
  });

  peopleToggle?.addEventListener("change", async e => { await chrome.storage.local.set({ matchplyCapturePeople: e.target.checked }); });

  floatingToggle?.addEventListener("change", async (e) => {
    await persistSurfaces(e.target.checked, Boolean(headerToggle?.checked), titleToggle ? titleToggle.checked : true);
  });

  headerToggle?.addEventListener("change", async (e) => {
    await persistSurfaces(floatingToggle ? floatingToggle.checked : true, e.target.checked, titleToggle ? titleToggle.checked : true);
  });

  titleToggle?.addEventListener("change", async (e) => {
    await persistSurfaces(floatingToggle ? floatingToggle.checked : true, Boolean(headerToggle?.checked), e.target.checked);
  });

  powerToggle?.addEventListener("change", async (e) => {
    extensionEnabled = e.target.checked;
    applyPowerSwitch();
    await chrome.storage.local.set({ matchplyExtensionEnabled: extensionEnabled });
    await updateCaptureAction();
  });

  saveNowBtn?.addEventListener("click", async () => {
    saveNowBtn.disabled = true;
    saveNowBtn.setAttribute("aria-busy", "true");
    const saveLabel = saveNowBtn.querySelector("span");
    if (saveLabel) saveLabel.textContent = "Guardando…";
    showMsg("");

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !JOB_PAGE.test(tab.url || "")) {
        showMsg("Abre una oferta en LinkedIn primero.", "err");
        return;
      }

      let res;
      try {
        res = await chrome.tabs.sendMessage(tab.id, { type: "trigger-manual-capture" });
      } catch (_) {
        const injected = await ensureLinkedInScript(tab.id);
        if (injected) {
          try {
            res = await chrome.tabs.sendMessage(tab.id, { type: "trigger-manual-capture" });
          } catch (_) {}
        }
      }

      if (!res) {
        showMsg("No se pudo activar la captura. Recarga la pestaña de LinkedIn.", "err");
        return;
      }

      if (res?.ok) {
        showMsg("¡Oferta guardada en Matchply con éxito!", "ok");
      } else {
        showMsg(res?.error || "No se pudo guardar la oferta.", "err");
      }
    } catch (err) {
      showMsg(err.message || "Error al guardar.", "err");
    } finally {
      saveNowBtn.removeAttribute("aria-busy");
      await updateCaptureAction();
    }
  });

  disconnectBtn?.addEventListener("click", async () => {
    await chrome.storage.local.remove(["matchplyExtensionToken", "matchplyExtensionScope", "matchplyExtensionInstallation"]);
    await loadState();
    showMsg("Sesión desconectada.");
  });

  if (typeof chrome !== "undefined" && chrome.storage) {
    void loadState();
  }
});
