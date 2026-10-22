/* Public guest-job HTML. No network and no clicks. */
(function (root) {
  const MIN_DESCRIPTION = 80;
  const MAX_DESCRIPTION = 120000;

  function prepareHtml(html) {
    return String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|div|h[1-4])>/gi, "\n");
  }

  function clean(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function usable(value) {
    const text = clean(value);
    return text.length >= MIN_DESCRIPTION && text.length <= MAX_DESCRIPTION ? text : "";
  }

  function plain(value) {
    return usable(prepareHtml(value).replace(/<[^>]+>/g, ""));
  }

  function jobPostings(value, out) {
    if (Array.isArray(value)) {
      value.forEach((item) => jobPostings(item, out));
      return;
    }
    if (!value || typeof value !== "object") return;
    const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
    if (types.includes("JobPosting")) out.push(value);
    jobPostings(value["@graph"], out);
  }

  function sameJob(url, jobId) {
    const found = String(url || "").match(/\/jobs\/view\/(?:[^/?#]*-)?(\d+)/);
    return found?.[1] === jobId;
  }

  function read(doc, jobId, rawHtml) {
    const id = String(jobId || "");
    if (!/^\d{6,}$/.test(id) || !String(rawHtml || "").includes(id) || !doc?.querySelector) return "";
    const postings = [];
    for (const script of doc.querySelectorAll?.('script[type="application/ld+json"]') || []) {
      try { jobPostings(JSON.parse(script.textContent || ""), postings); } catch (_) { /* Try the description node. */ }
    }
    const matching = postings.filter((item) => typeof item.url === "string" && sameJob(item.url, id));
    const posting = matching.length === 1
      ? matching[0]
      : postings.length === 1 && (!postings[0].url || sameJob(postings[0].url, id))
        ? postings[0]
        : null;
    if (posting && typeof posting.description === "string") {
      const text = plain(posting.description);
      if (text) return text;
    }
    if (postings.length && !posting) return "";
    const node = doc.querySelector(".show-more-less-html__markup");
    return node ? usable(prepareHtml(node.innerHTML || "").replace(/<[^>]+>/g, "")) : "";
  }

  function isBotPage(html) {
    const sample = String(html || "").slice(0, 20000);
    // A normal guest job page links to sign-in. Only the challenge page stops the batch.
    return sample.includes("_0x26bb58")
      || sample.includes("/checkpoint/challenge")
      || /http-equiv=["']refresh["'][^>]*url=https:\/\/www\.linkedin\.com\/?["']/i.test(sample);
  }

  function isRateLimit(response) {
    return Number(response?.status) === 429;
  }

  function waitRange(kind) {
    return kind === "cooldown" ? [8000, 10000] : [3000, 5000];
  }

  function shouldStop(response) {
    const status = Number(response?.status);
    const type = String(response?.type || "");
    const url = String(response?.url || "").toLowerCase();
    if (status === 429 || type === "opaqueredirect" || status === 0) return true;
    if (status >= 300 && status < 400) return true;
    if (response?.redirected === true) return true;
    if (url.includes("authwall") || url.includes("checkpoint") || url.includes("challenge")) return true;
    return isBotPage(response?.html);
  }

  const api = { prepareHtml, read, isBotPage, isRateLimit, waitRange, shouldStop, MIN_DESCRIPTION };
  root.MatchplyPublicDescription = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
