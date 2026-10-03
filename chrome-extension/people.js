/* Visible job contacts only. No navigation, hidden requests or automated interaction. */
(function (root) {
  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function visible(el) { return !!el && !el.closest('[hidden], [aria-hidden="true"]') && el.getClientRects().length > 0; }
  function profileUrl(raw) {
    try {
      const u = new URL(raw, 'https://www.linkedin.com');
      const match = u.pathname.match(/^\/in\/([^/]+)\/?$/i);
      if (u.protocol !== 'https:' || !/(^|\.)linkedin\.com$/i.test(u.hostname) || u.username || u.password || u.port || !match) return null;
      const slug = decodeURIComponent(match[1]).normalize('NFC').toLowerCase();
      if (/[\/\s?#]/.test(slug)) return null;
      return `https://www.linkedin.com/in/${encodeURIComponent(slug)}`;
    } catch { return null; }
  }
  function extract(doc) {
    const found = new Map();
    function add(card, source, nameSelector, headlineSelector, degreeSelector) {
      if (!visible(card)) return;
      const a = Array.from(card.querySelectorAll('a[href*="/in/"]')).find(link => visible(link) && profileUrl(link.getAttribute('href')));
      if (!a) return;
      const url = profileUrl(a.getAttribute('href'));
      const name = clean(card.querySelector(nameSelector)?.textContent).slice(0, 180);
      if (!name) return;
      const value = { name, profileUrl: url, headline: clean(card.querySelector(headlineSelector)?.textContent).slice(0, 1000) || null, connectionDegree: clean(card.querySelector(degreeSelector)?.textContent).slice(0, 80) || null, source };
      // The same profile may be in both sections. Preserve its hiring-team provenance.
      if (!found.has(url) || source === 'hiring_team') found.set(url, value);
    }
    doc.querySelectorAll('.job-details-people-who-can-help__section--two-pane .hirer-card__hirer-information').forEach(c => add(c, 'hiring_team', '.jobs-poster__name strong, .jobs-poster__name, a[href*="/in/"] strong', '.linked-area > .text-body-small, .hirer-card__job-title', '.hirer-card__connection-degree'));
    doc.querySelectorAll('.job-details-connections-modal__modal-wrapper[role="dialog"] .job-details-people-who-can-help__connections-profile-card').forEach(c => add(c, 'network', '.job-details-people-who-can-help__connections-profile-card-title strong, .job-details-people-who-can-help__connections-profile-card-title', '.artdeco-entity-lockup__subtitle', '.artdeco-entity-lockup__degree'));
    return Array.from(found.values());
  }
  function signature(person) { return JSON.stringify([person.profileUrl, person.name, person.headline, person.connectionDegree, person.source]); }
  const api = { extract, profileUrl, signature };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MatchplyPeople = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
