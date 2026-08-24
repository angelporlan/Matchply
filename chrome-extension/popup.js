const API_BASE = "http://localhost:3000";

document.addEventListener("DOMContentLoaded", () => {
  const pairingCard = document.getElementById("pairingCard");
  const connectedPanel = document.getElementById("connectedPanel");
  const pairingCodeInput = document.getElementById("pairingCodeInput");
  const pairBtn = document.getElementById("pairBtn");
  const disconnectBtn = document.getElementById("disconnectBtn");
  const connBadge = document.getElementById("connBadge");
  const connBadgeText = document.getElementById("connBadgeText");
  const saveNowBtn = document.getElementById("saveNowBtn");
  const modeAutoBtn = document.getElementById("modeAutoBtn");
  const modeManualBtn = document.getElementById("modeManualBtn");
  const delaySection = document.getElementById("delaySection");
  const delaySlider = document.getElementById("delaySlider");
  const delayDisplay = document.getElementById("delayDisplay");
  const widgetToggle = document.getElementById("widgetToggle");
  const presetButtons = [...document.querySelectorAll(".preset-btn")];
  const statusMessage = document.getElementById("statusMessage");

  function showMsg(text, type = "") {
    if (!statusMessage) return;
    statusMessage.textContent = text;
    statusMessage.className = type === "ok" ? "msg-ok" : type === "err" ? "msg-err" : "";
  }

  function clampDelay(val) {
    const n = Number(val);
    return Number.isFinite(n) ? Math.min(20, Math.max(1, Math.round(n))) : 3;
  }

  function updateModeUI(mode) {
    const isAuto = mode !== "manual";
    modeAutoBtn?.classList.toggle("active", isAuto);
    modeManualBtn?.classList.toggle("active", !isAuto);
    if (delaySection) delaySection.style.display = isAuto ? "block" : "none";
  }

  function updateDelayUI(sec) {
    if (delaySlider) delaySlider.value = String(sec);
    if (delayDisplay) delayDisplay.textContent = `${sec}s`;
    presetButtons.forEach(btn => {
      btn.classList.toggle("active", Number(btn.dataset.sec) === Number(sec));
    });
  }

  async function loadState() {
    const stored = await chrome.storage.local.get([
      "matchplyExtensionToken",
      "matchplyExtensionInstallation",
      "matchplyCaptureMode",
      "matchplyCaptureDelay",
      "matchplyShowWidget",
    ]);

    const token = stored.matchplyExtensionToken;
    const isConnected = Boolean(token);

    if (pairingCard) pairingCard.hidden = isConnected;
    if (connectedPanel) connectedPanel.hidden = !isConnected;

    if (connBadge) {
      if (isConnected) {
        if (connBadgeText) connBadgeText.textContent = "Conectada";
        connBadge.className = "status-badge connected";
      } else {
        if (connBadgeText) connBadgeText.textContent = "No vinculada";
        connBadge.className = "status-badge";
      }
    }

    const mode = stored.matchplyCaptureMode || "auto";
    const delay = clampDelay(stored.matchplyCaptureDelay || 3);
    const showWidget = stored.matchplyShowWidget !== false;

    updateModeUI(mode);
    updateDelayUI(delay);
    if (widgetToggle) widgetToggle.checked = showWidget;

    if (!isConnected) return;

    try {
      const remote = await chrome.runtime.sendMessage({ type: "matchply-status" });
      if (remote?.connected === false) {
        await chrome.storage.local.remove(["matchplyExtensionToken", "matchplyExtensionScope", "matchplyExtensionInstallation"]);
        if (pairingCard) pairingCard.hidden = false;
        if (connectedPanel) connectedPanel.hidden = true;
        if (connBadge) {
          if (connBadgeText) connBadgeText.textContent = "Sesión expirada";
          connBadge.className = "status-badge";
        }
        showMsg("La sesión fue revocada o caducó. Genera un nuevo código.", "err");
      }
    } catch (_) {}
  }

  pairBtn?.addEventListener("click", async () => {
    const code = pairingCodeInput?.value.trim().toUpperCase() || "";
    if (!/^[A-Z2-9]{8}$/.test(code)) {
      showMsg("Introduce un código válido de 8 caracteres.", "err");
      return;
    }

    pairBtn.disabled = true;
    pairBtn.textContent = "Conectando…";
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
      pairBtn.textContent = "Conectar extensión";
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

  widgetToggle?.addEventListener("change", async (e) => {
    await chrome.storage.local.set({ matchplyShowWidget: e.target.checked });
  });

  saveNowBtn?.addEventListener("click", async () => {
    saveNowBtn.disabled = true;
    saveNowBtn.textContent = "⏳ Guardando…";
    showMsg("");

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !/linkedin\.com\/jobs/i.test(tab.url || "")) {
        showMsg("Abre una oferta en LinkedIn primero.", "err");
        return;
      }

      let res;
      try {
        res = await chrome.tabs.sendMessage(tab.id, { type: "trigger-manual-capture" });
      } catch (_) {
        showMsg("Recarga la pestaña de LinkedIn (F5) para activar la extensión.", "err");
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
      saveNowBtn.disabled = false;
      saveNowBtn.textContent = "⚡ Capturar oferta actual ahora";
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
