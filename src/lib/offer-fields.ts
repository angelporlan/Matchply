export const NEUTRAL_JOB_TITLE = 'Oferta sin título';
export const NEUTRAL_COMPANY = 'Empresa sin identificar';

const TITLE_LABEL = /^(?:puesto|cargo|t[ií]tulo(?: del puesto)?|rol|posici[oó]n|job title|position|role)\s*[:\-–]\s*(.+)$/i;
const COMPANY_LABEL = /^(?:empresa|compa[nñ][ií]a|company|organizaci[oó]n|organization)\s*[:\-–]\s*(.+)$/i;

function cleanField(value: string) {
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned.slice(0, 160);
}

/** Light extraction from the pasted offer. No model call. Null when nothing reliable is found. */
export function inferOfferFields(description: string): { jobTitle: string | null; company: string | null } {
  const lines = description
    .split(/\n/)
    .map((line) => line.replace(/^[\s*#>-]+/, '').trim())
    .filter(Boolean);

  let jobTitle: string | null = null;
  let company: string | null = null;
  for (const line of lines.slice(0, 15)) {
    const titleMatch = line.match(TITLE_LABEL);
    const companyMatch = line.match(COMPANY_LABEL);
    if (titleMatch && !jobTitle) jobTitle = cleanField(titleMatch[1]);
    if (companyMatch && !company) company = cleanField(companyMatch[1]);
  }

  if (!jobTitle) {
    const first = lines[0];
    if (first && first.length <= 80 && !/[.!?]$/.test(first) && !COMPANY_LABEL.test(first)) {
      jobTitle = cleanField(first);
    }
  }

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
