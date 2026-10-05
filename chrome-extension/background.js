importScripts('people.js');
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

async function downloadAvatar(rawUrl, signal) {
  const url = MatchplyPeople.avatarUrl(rawUrl);
  if (!url) throw new Error('Unsupported photo source');
  const response = await fetch(url, { credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal });
  if (!response.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(response.headers.get('content-type')?.split(';')[0]) || Number(response.headers.get('content-length')) > 1024 * 1024) throw new Error('Photo unavailable');
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) throw new Error('Photo too large');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bitmap = await createImageBitmap(new Blob(chunks, { type: response.headers.get('content-type') }));
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 16000000) throw new Error('Unsupported photo dimensions');
    const edge = Math.min(192, bitmap.width, bitmap.height), canvas = new OffscreenCanvas(edge, edge), ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Photo conversion unavailable');
    const crop = Math.min(bitmap.width, bitmap.height);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, edge, edge);
    ctx.drawImage(bitmap, (bitmap.width - crop) / 2, (bitmap.height - crop) / 2, crop, crop, 0, 0, edge, edge);
    let blob;
    for (const quality of [0.82, 0.65, 0.45]) {
      blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
      if (blob.size <= 48 * 1024) break;
    }
    if (blob.type !== 'image/jpeg' || blob.size > 48 * 1024) throw new Error('Photo too large');
    return { mime: 'image/jpeg', data: btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer()))) };
  } finally { bitmap.close(); }
}

async function saveAvatars(contacts, jobId, token) {
  const saved = new Set(); let failed = 0, cursor = 0;
  if ((await chrome.storage.local.get('matchplyCapturePeople')).matchplyCapturePeople !== true) return { saved, failed };
  const photos = contacts.filter(p => MatchplyPeople.profileUrl(p.profileUrl) && MatchplyPeople.avatarUrl(p.avatarUrl)).slice(0, 20);
  if (!photos.length) return { saved, failed };
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20000);
  try {
    await Promise.all(Array.from({ length: Math.min(4, photos.length) }, async () => {
      while (cursor < photos.length) {
        const person = photos[cursor++];
        try {
          const avatar = await downloadAvatar(person.avatarUrl, controller.signal);
          const response = await fetch(`${API_BASE}/api/extension/linkedin/people/avatar`, {
            method: 'POST', signal: controller.signal,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ sourceJobId: jobId, profileUrl: person.profileUrl, avatar }),
          });
          if (!response.ok) throw new Error('Photo could not be saved');
          saved.add(person.profileUrl);
        } catch { failed++; }
      }
    }));
  } finally { clearTimeout(timeout); }
  return { saved, failed };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (["capture-linkedin-job", "capture-linkedin-people"].includes(message?.type)) {
    (async () => {
      try {
        const source = sender.url || sender.tab?.url || '';
        if (!/^https:\/\/(?:[a-z0-9-]+\.)*linkedin\.com\/jobs\//.test(source)) {
          sendResponse({ ok: false, error: 'Captura disponible solo en ofertas de LinkedIn.' });
          return;
        }
        const token = await getSession();
        if (!token) {
          await setBadge(sender.tab?.id, "?", "#8b5cf6");
          sendResponse({ ok: false, code: "not_paired", error: "Conecta primero la extensión desde Matchply." });
          return;
        }

        const raw = message.payload || {};
        const contacts = Array.isArray(raw.people) ? raw.people : [];
        // Send contact metadata first. Binary images use a separate bounded endpoint.
        const people = contacts.map(({ avatarUrl, ...contact }) => contact);
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
          ...(Array.isArray(raw.people) ? { people } : {}),
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
        const avatars = result.peopleError ? { saved: new Set(), failed: 0 } : await saveAvatars(contacts, jobId, token);
        const capturedSignatures = result.peopleError ? [] : contacts.map(p => MatchplyPeople.signature({ ...p, avatarUrl: avatars.saved.has(p.profileUrl) ? p.avatarUrl : undefined }));
        const avatarRetryAt = avatars.failed ? Date.now() + 300000 : 0;
        const stored = await chrome.storage.local.get("matchplyExtensionInstallation");
        const installationId = stored.matchplyExtensionInstallation?.id;
        if (jobId && installationId) {
          const key = `matchply_capture_${installationId}_${jobId}`;
          const previous = (await chrome.storage.local.get(key))[key] || {};
          const people = Array.from(new Set([...(previous.people || []), ...capturedSignatures]));
          await chrome.storage.local.set({ [key]: { offer: true, people, avatarRetryAt } });
        }
        await setBadge(sender.tab?.id, "✓", "#10b981");
        sendResponse({ ok: true, result: { ...result, capturedSignatures, avatarFailures: avatars.failed, avatarRetryAt } });
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

const LINKEDIN_PAGE = /^https:\/\/(?:[a-z0-9-]+\.)*linkedin\.com\//i;

function isLinkedInPage(url) {
  return LINKEDIN_PAGE.test(url || "");
}

async function ensureLinkedInCapture(tabId) {
  if (!tabId || !chrome.scripting?.executeScript) return;
  const version = chrome.runtime.getManifest().version;
  try {
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
    if (probe?.result) return;
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: ["people.js", "content.js"],
    });
  } catch (_) {
    // The tab can close or discard before the script is allowed to run.
  }
}

function watchLinkedInTabs() {
  if (!chrome.tabs?.onUpdated?.addListener || !chrome.scripting?.executeScript || !chrome.runtime?.getManifest) return;
  const pending = new Map();
  const scheduleInject = (tabId) => {
    clearTimeout(pending.get(tabId));
    pending.set(tabId, setTimeout(() => {
      pending.delete(tabId);
      void ensureLinkedInCapture(tabId);
    }, 100));
  };
  // LinkedIn changes sections with history.pushState. A script declared only
  // for /jobs/ never starts if the tab was opened on the feed.
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const url = changeInfo.url || (changeInfo.status === "complete" ? tab?.url : "");
    if (!tabId || !isLinkedInPage(url)) return;
    scheduleInject(tabId);
  });
  const reinjectOpenTabs = () => {
    if (!chrome.tabs?.query) return;
    void chrome.tabs.query({ url: ["https://*.linkedin.com/*", "https://linkedin.com/*"] })
      .then((tabs) => {
        for (const tab of tabs || []) {
          if (tab?.id && isLinkedInPage(tab.url)) void ensureLinkedInCapture(tab.id);
        }
      })
      .catch(() => {});
  };
  chrome.runtime.onInstalled?.addListener?.(reinjectOpenTabs);
  chrome.runtime.onStartup?.addListener?.(reinjectOpenTabs);
}

watchLinkedInTabs();
