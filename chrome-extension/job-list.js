/* Cards already painted in a LinkedIn jobs list.
   No clicks, no scrolling, and no requests to LinkedIn. */
(function (root) {
  const MAX_VISIBLE = 25;
  const CARD_SELECTOR = '.job-card-container, [data-occludable-job-id], [componentkey^="job-card-component-ref-"]';
  const LIST_SELECTOR = '[data-testid="lazy-column"], .jobs-search-results-list, .jobs-search__results-list, ul.scaffold-layout__list-container';
  const DETAIL_SELECTOR = '.jobs-search__job-details, .jobs-details__main-content, .jobs-details, [data-view-name="job-detail-page"]';
  const LEAF_SELECTOR = "p, a, span, h1, h2, h3, li";

  function clean(value) {
    return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function text(node) {
    return clean(node?.innerText || node?.textContent || "");
  }

  function cleanTitle(value) {
    return clean(String(value || "")
      .replace(/^seleccionad[oa],\s*/i, "")
      .replace(/^selected,\s*/i, "")
      .replace(/\s*\(empleo verificado\)/ig, "")
      .replace(/\s*\(verified job\)/ig, ""));
  }

  function jobIdFromHref(href) {
    return String(href || "").match(/\/jobs\/view\/(?:[^/?#]*-)?(\d{6,})/)?.[1] || "";
  }

  function shown(node) {
    if (!node) return false;
    if (typeof node.closest === "function" && node.closest("[hidden]")) return false;
    if (node.getAttribute?.("aria-hidden") === "true") return false;
    if (typeof node.getClientRects === "function" && node.getClientRects().length === 0) return false;
    return true;
  }

  function extractWorkplace(value) {
    const textValue = String(value || "");
    if (/\b(en remoto|remote|telecommute)\b/i.test(textValue)) return "Remoto";
    if (/\b(h[ií]brido|hybrid)\b/i.test(textValue)) return "Híbrido";
    if (/\b(presencial|on[ -]?site)\b/i.test(textValue)) return "Presencial";
    return "";
  }

  function extractEmployment(value) {
    const textValue = String(value || "");
    if (/\b(jornada completa|full[ -]?time)\b/i.test(textValue)) return "Jornada completa";
    if (/\b(jornada parcial|media jornada|part[ -]?time)\b/i.test(textValue)) return "Media jornada";
    if (/\b(pr[aá]cticas|internship)\b/i.test(textValue)) return "Prácticas";
    if (/\b(temporal|temporary)\b/i.test(textValue)) return "Temporal";
    if (/\b(contrato|contract|freelance)\b/i.test(textValue)) return "Contrato";
    return "";
  }

  function isTimeLine(line) {
    return /^(publicado\s+)?hace\s+\d+/i.test(line)
      || /^\d+\s*(minuto|hora|d[ií]a|semana|mes|minute|hour|day|week|month)/i.test(line)
      || /^(posted|reposted)\b/i.test(line);
  }

  function isNoiseLine(line) {
    return /^(visto|promocionado|promoted|solicitud sencilla|easy apply|seleccionado|selected|guardar|m[aá]s opciones|be an early applicant)\b/i.test(line)
      || /^adel[aá]ntate a solicitar/i.test(line)
      || /^descartar empleo/i.test(line)
      || /promocionad[oa]\s+por\s+t[eé]cnico/i.test(line)
      || /^promoted by\b/i.test(line);
  }

  function isSalary(line) {
    return line.length < 48 && (/[€$£]/.test(line) || /\b\d+\s?k\b/i.test(line));
  }

  function isPlace(line) {
    if (!line || line.length > 80) return false;
    if (extractWorkplace(line) && /\([^)]{2,40}\)/.test(line)) return true;
    if (extractWorkplace(line) && line.length < 32) return true;
    return /^[\p{L}\s,.'’-]{2,60}$/u.test(line) && line.includes(",") && line.split(/\s+/).length <= 6;
  }

  function usableCompany(value) {
    const company = clean(value);
    if (!company || company.length > 80) return "";
    if (isPlace(company) || isTimeLine(company) || isNoiseLine(company) || isSalary(company)) return "";
    if (/promocionad|promoted\b|t[eé]cnic[oa]s? de selecci|contratante|\bhirer\b|reclutador|publicado por|posted by|solicitud|applicant|easy apply/i.test(company)) return "";
    return company;
  }

  function cardJobId(card) {
    const own = card.getAttribute?.("data-job-id") || card.getAttribute?.("data-occludable-job-id") || "";
    if (/^\d{6,}$/.test(own)) return own;
    const fromKey = String(card.getAttribute?.("componentkey") || "").match(/job-card-component-ref-(\d{6,})/);
    if (fromKey) return fromKey[1];
    const nested = card.querySelector?.("[data-job-id], [data-occludable-job-id], [componentkey^='job-card-component-ref-']");
    if (nested && nested !== card) {
      const nestedId = cardJobId(nested);
      if (nestedId) return nestedId;
    }
    return jobIdFromHref(card.querySelector?.("a[href*='/jobs/view/']")?.getAttribute?.("href"));
  }

  function leafLines(card) {
    const lines = [];
    for (const node of card.querySelectorAll?.(LEAF_SELECTOR) || []) {
      if (node.closest?.("button, svg, [data-matchply-capture-host]")) continue;
      if (node.querySelector?.(LEAF_SELECTOR)) continue;
      const siblings = node.parentElement ? [...(node.parentElement.children || [])] : [];
      const hiddenTwin = siblings.some((child) => child !== node && child.getAttribute?.("aria-hidden") === "true" && text(child).length > 4);
      if (hiddenTwin && node.getAttribute?.("aria-hidden") !== "true") continue;
      const line = cleanTitle(text(node));
      if (!line || line.length > 220 || line === lines[lines.length - 1]) continue;
      lines.push(line);
    }
    return lines;
  }

  function fromLines(lines) {
    let postedAt = "";
    let salaryVisible = "";
    let employment = "";
    const useful = [];
    for (const line of lines) {
      if (isNoiseLine(line)) continue;
      if (isTimeLine(line)) {
        if (!postedAt) postedAt = clean(line.replace(/^publicado\s+/i, ""));
        continue;
      }
      const employmentType = extractEmployment(line);
      if (useful.length && employmentType && line.length < 40) {
        if (!employment) employment = employmentType;
        continue;
      }
      if (useful.length && isSalary(line)) {
        if (!salaryVisible) salaryVisible = line;
        continue;
      }
      useful.push(line);
    }
    const title = useful[0] || "";
    let company = "";
    let place = "";
    for (const line of useful.slice(1)) {
      if (!place && isPlace(line)) {
        place = line;
        continue;
      }
      if (!company) {
        const candidate = usableCompany(line);
        if (candidate && candidate !== title) company = candidate;
      }
    }
    if (!title || title.length > 180 || !company) return null;
    return {
      title,
      company,
      location: clean(place.replace(/\([^)]*\)/g, "")),
      workplace: extractWorkplace(place),
      employment,
      postedAt,
      salaryVisible,
    };
  }

  function fromClassic(card) {
    const title = cleanTitle(text(card.querySelector?.(".job-card-list__title, .job-card-container__link")));
    const company = usableCompany(text(card.querySelector?.(".job-card-container__primary-description, .artdeco-entity-lockup__subtitle")));
    const place = text(card.querySelector?.(".job-card-container__metadata-item"));
    if (!title || !company) return null;
    return {
      title,
      company,
      location: clean(place.replace(/\([^)]*\)/g, "")),
      workplace: extractWorkplace(place),
      employment: extractEmployment(text(card)),
      postedAt: "",
      salaryVisible: "",
    };
  }

  function toOffer(jobId, fields) {
    const raw = [fields.title, fields.company, fields.location, fields.workplace, fields.employment].filter(Boolean).join("\n");
    return {
      job_id: jobId,
      url: `https://www.linkedin.com/jobs/view/${jobId}`,
      title: fields.title,
      company: fields.company,
      location: fields.location || "",
      workplace_type: fields.workplace || "",
      employment_type: fields.employment || "",
      description: "",
      raw_text: raw,
      sourceMetadata: {
        captureKind: "list",
        ...(fields.postedAt ? { postedAt: fields.postedAt } : {}),
        ...(fields.salaryVisible ? { salaryVisible: fields.salaryVisible } : {}),
      },
    };
  }

  function readCard(card) {
    const jobId = cardJobId(card);
    if (!jobId) return null;
    const fields = fromClassic(card) || fromLines(leafLines(card));
    if (!fields) return null;
    return toOffer(jobId, fields);
  }

  function read(doc) {
    if (!doc?.querySelectorAll) return { offers: [], truncated: false };
    const allRoots = [...doc.querySelectorAll(LIST_SELECTOR)];
    const roots = allRoots.filter(shown);
    if (allRoots.length && !roots.length) return { offers: [], truncated: false };
    const scopes = roots.length ? roots : [doc];
    const offers = [];
    const seen = new Set();
    let truncated = false;
    for (const scope of scopes) {
      for (const card of scope.querySelectorAll(CARD_SELECTOR)) {
        if (offers.length >= MAX_VISIBLE) {
          truncated = true;
          break;
        }
        if (!shown(card) || card.closest?.("[data-matchply-capture-host]")) continue;
        if (!roots.length && card.closest?.(DETAIL_SELECTOR)) continue;
        const parent = card.parentElement;
        if (parent && typeof parent.closest === "function" && parent.closest(CARD_SELECTOR)) continue;
        const offer = readCard(card);
        if (!offer || seen.has(offer.job_id)) continue;
        seen.add(offer.job_id);
        offers.push(offer);
      }
      if (truncated) break;
    }
    return { offers, truncated };
  }

  function countLabel(count, one, many) {
    return `${count} ${count === 1 ? one : many}`;
  }

  function summary(counts) {
    const created = Number(counts?.created) || 0;
    const existing = Number(counts?.existing) || 0;
    const failed = Number(counts?.failed) || 0;
    const parts = [];
    if (created) parts.push(countLabel(created, "oferta nueva", "ofertas nuevas"));
    if (existing) parts.push(existing === 1 ? "1 ya estaba en Matchply" : `${existing} ya estaban en Matchply`);
    if (failed) parts.push(countLabel(failed, "no se pudo guardar", "no se pudieron guardar"));
    if (!parts.length) return "No hay ofertas visibles en la lista.";
    let text = parts.join(", ").replace(/, ([^,]*)$/, " y $1");
    text = text.charAt(0).toUpperCase() + text.slice(1) + ".";
    if (created) text += " La descripción completa entra al abrir cada oferta.";
    if (counts?.truncated) text += " Hay más en la lista: baja y vuelve a pulsar.";
    return text;
  }

  const api = { read, summary, MAX_VISIBLE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MatchplyJobList = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
