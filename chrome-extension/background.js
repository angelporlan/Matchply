const API_BASE = "http://localhost:3000";
const INGEST_ENDPOINT = `${API_BASE}/api/extension/linkedin/ingest`;
const STATUS_ENDPOINT = `${API_BASE}/api/extension/status`;

async function getSession() {
  const stored = await chrome.storage.local.get(["matchplyExtensionToken", "matchplyExtensionScope"]);
  return stored.matchplyExtensionToken && stored.matchplyExtensionScope === "linkedin:ingest"
    ? stored.matchplyExtensionToken
    : null;
}

async function setBadge(tabId, text, color) {
  if (!tabId) return;
  await chrome.action.setBadgeBackgroundColor({ tabId, color });
  await chrome.action.setBadgeText({ tabId, text });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (["capture-linkedin-job", "capture-linkedin-people"].includes(message?.type)) {
    (async () => {
      try {
        const token = await getSession();
        if (!token) {
          await setBadge(sender.tab?.id, "?", "#8b5cf6");
          sendResponse({ ok: false, code: "not_paired", error: "Conecta primero la extensión desde Matchply." });
          return;
        }

        const raw = message.payload || {};
        const payload = {
          sourceJobId: String(raw.sourceJobId || raw.job_id || ""),
          canonicalUrl: String(raw.canonicalUrl || raw.url || `https://www.linkedin.com/jobs/view/${raw.job_id || ""}`),
          title: String(raw.title || ""),
          company: String(raw.company || ""),
          location: raw.location || null,
          workplaceType: raw.workplaceType || raw.workplace_type || null,
          employmentType: raw.employmentType || raw.employment_type || null,
          description: raw.description || null,
          rawText: raw.rawText || raw.raw_text || null,
          sourceMetadata: raw.sourceMetadata || null,
          ...(Array.isArray(raw.people) ? { people: raw.people } : {}),
        };

        const response = await fetch(message.type === "capture-linkedin-people" ? `${API_BASE}/api/extension/linkedin/people` : INGEST_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(message.type === "capture-linkedin-people" ? { sourceJobId: payload.sourceJobId, people: payload.people || [] } : payload),
        });

        if (!response.ok) {
          const detail = await response.text();
          if (response.status === 401 || response.status === 403) {
            await chrome.storage.local.remove(["matchplyExtensionToken", "matchplyExtensionScope", "matchplyExtensionInstallation"]);
            await setBadge(sender.tab?.id, "?", "#8b5cf6");
            sendResponse({ ok: false, code: "session_expired", error: "La sesión de la extensión ha caducado o fue revocada." });
            return;
          }
          throw new Error(`Matchply (${response.status}): ${detail}`);
        }

        const result = await response.json();
        const jobId = payload.sourceJobId;
        const stored = await chrome.storage.local.get("matchplyExtensionInstallation");
        const installationId = stored.matchplyExtensionInstallation?.id;
        if (jobId && installationId) {
          const key = `matchply_capture_${installationId}_${jobId}`;
          const previous = (await chrome.storage.local.get(key))[key] || {};
          const people = result.peopleError ? (previous.people || []) : Array.from(new Set([...(previous.people || []), ...(payload.people || []).map(p => JSON.stringify([p.profileUrl, p.name, p.headline, p.connectionDegree, p.source]))]));
          await chrome.storage.local.set({ [key]: { offer: true, people } });
        }
        await setBadge(sender.tab?.id, "✓", "#10b981");
        sendResponse({ ok: true, result });
      } catch (error) {
        await setBadge(sender.tab?.id, "!", "#ef4444");
        sendResponse({ ok: false, error: String(error?.message || error) });
      }
    })();
    return true;
  }

  if (message?.type === "matchply-status" || message?.type === "archive-status") {
    (async () => {
      try {
        const token = await getSession();
        if (!token) {
          sendResponse({ ok: true, connected: false });
          return;
        }
        const response = await fetch(STATUS_ENDPOINT, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          sendResponse({ ok: true, connected: false });
          return;
        }
        sendResponse({ ok: true, connected: true, ...(await response.json()) });
      } catch (_) {
        sendResponse({ ok: true, connected: false });
      }
    })();
    return true;
  }

  return false;
});
