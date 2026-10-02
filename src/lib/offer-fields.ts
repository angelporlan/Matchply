export const NEUTRAL_JOB_TITLE = 'Puesto no identificado';
export const NEUTRAL_COMPANY = 'Empresa no identificada';

const TITLE_LABEL = /^(?:puesto|cargo|t[ií]tulo(?: del puesto)?|rol|posici[oó]n|job title|position|role)\s*[:\-–]\s*(.+)$/i;
const COMPANY_LABEL = /^(?:empresa|compa[nñ][ií]a|company|organizaci[oó]n|organization)\s*[:\-–]\s*(.+)$/i;
const SAVE_LINE = /^(?:guardar|save)\s+[«"“']\s*(.+?)\s*[»"”']\s+(?:en|at|to|in)\s+(.+)$/i;
const LOGO_LINE = /^(?:logotipo|logo)\s+(?:de|of)\s+(.+)$/i;
const CHROME_LINE = /^(?:compartir|share|mostrar m[aá]s opciones|show more options|guardar|save|h[ií]brido|hybrid|presencial|remoto|remote|on-site|onsite|jornada completa|jornada parcial|media jornada|full-time|part-time|solicitud sencilla|easy apply)$/i;
const PROMO_LINE = /^(?:promocionado por|promoted by|a[uú]n no hay informaci[oó]n)/i;
const LOCATION_LINE = /(?:·|,).{0,120}(?:\bhace\b|\bago\b|\bsolicitudes?\b|\bapplicants?\b)/i;

function cleanField(value: string) {
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned.slice(0, 160);
}

function sameField(left: string, right: string) {
  return left.trim().toLocaleLowerCase('es') === right.trim().toLocaleLowerCase('es');
}

function isNoiseLine(line: string, company: string | null) {
  if (CHROME_LINE.test(line) || PROMO_LINE.test(line) || LOGO_LINE.test(line) || SAVE_LINE.test(line)) return true;
  if (LOCATION_LINE.test(line)) return true;
  if (!company) return false;
  if (sameField(line, company)) return true;
  return line.toLocaleLowerCase('es').startsWith(`${company.toLocaleLowerCase('es')} ·`);
}

/** Light extraction from the pasted offer. No model call. Null when nothing reliable is found. */
export function inferOfferFields(description: string): { jobTitle: string | null; company: string | null } {
  const lines = description
    .split(/\n/)
    .map((line) => line.replace(/^[\s*#>-]+/, '').trim())
    .filter(Boolean)
    .slice(0, 40);

  let jobTitle: string | null = null;
  let company: string | null = null;

  for (const line of lines) {
    const save = line.match(SAVE_LINE);
    if (!save) continue;
    jobTitle = cleanField(save[1]);
    company = cleanField(save[2]);
    break;
  }

  if (!company) {
    for (const line of lines) {
      const logo = line.match(LOGO_LINE);
      if (!logo) continue;
      company = cleanField(logo[1]);
      break;
    }
  }

  for (const line of lines) {
    if (!jobTitle) {
      const titleMatch = line.match(TITLE_LABEL);
      if (titleMatch) jobTitle = cleanField(titleMatch[1]);
    }
    if (!company) {
      const companyMatch = line.match(COMPANY_LABEL);
      if (companyMatch) company = cleanField(companyMatch[1]);
    }
  }

  if (!jobTitle) {
    for (const line of lines) {
      if (isNoiseLine(line, company)) continue;
      if (line.length <= 120 && !/[.!?]$/.test(line)) {
        jobTitle = cleanField(line);
        break;
      }
    }
  }

  if (jobTitle && LOGO_LINE.test(jobTitle)) {
    const logo = jobTitle.match(LOGO_LINE);
    if (logo && !company) company = cleanField(logo[1]);
    jobTitle = null;
  }
  if (jobTitle && company && sameField(jobTitle, company)) jobTitle = null;

  return {
    jobTitle: jobTitle || null,
    company: company || null,
  };
}

export function resolveOfferIdentity(input: {
  jobTitle?: string | null;
  company?: string | null;
  jobDescription: string;
}) {
  const inferred = inferOfferFields(input.jobDescription);
  return {
    jobTitle: input.jobTitle?.trim() || inferred.jobTitle || NEUTRAL_JOB_TITLE,
    company: input.company?.trim() || inferred.company || NEUTRAL_COMPANY,
  };
}
