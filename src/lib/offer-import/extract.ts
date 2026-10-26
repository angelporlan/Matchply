import { load } from 'cheerio';
import { sameOfferUrl, usableOfferDescription } from './types';

export type ExtractedOffer = { jobTitle: string | null; company: string | null; description: string; isolatedDescription: boolean };

/** Only call after no job description was found: jobs may themselves mention security or CAPTCHA. */
export function isOfferAccessWall(html: string): boolean {
  const $ = load(html);
  const heading = `${$('title').text()} ${$('h1').first().text()}`.trim();
  return /access denied|403 forbidden|just a moment|attention required|verify (?:you are|you're|that you are) human|verifica que eres humano|acceso denegado/i.test(heading)
    || ($('input[type="password"]').length > 0 && /sign in|log in|login|iniciar sesi[oó]n|inicia sesi[oó]n/i.test(heading))
    || $('#challenge-form, #cf-challenge-running').length > 0;
}

export function htmlText(html: string): string {
  let $ = load(html);
  // Some portals entity-encode the entire JSON-LD description, including its tags.
  for (let pass = 0; pass < 2; pass++) {
    const text = $('body').text();
    if ($('body').children().length || !/(?:<|&lt;)\/?(?:p|br|strong|ul|ol|li|div|h[1-4])(?:\s|>|&gt;)/i.test(text)) break;
    $ = load(text);
  }
  $('script,style,nav,header,footer,aside,form,noscript,[aria-hidden="true"]').remove();
  $('br').replaceWith('\n');
  $('p,li,h1,h2,h3,h4,div,section').append('\n');
  return $.root().text().replace(/\r/g, '').replace(/[\t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function jobPostings(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(jobPostings);
  if (!value || typeof value !== 'object') return [];
  const item = value as Record<string, unknown>;
  const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
  return [...(types.includes('JobPosting') ? [item] : []), ...jobPostings(item['@graph'])];
}

export function extractOffer(html: string, expectedUrl: string): ExtractedOffer | null {
  const $ = load(html);
  const postings: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_index, element) => {
    try { postings.push(...jobPostings(JSON.parse($(element).text()))); } catch { /* Malformed JSON-LD: try the page body. */ }
  });
  const matching = postings.filter(item => typeof item.url === 'string' && sameOfferUrl(item.url, expectedUrl));
  const posting = matching.length === 1 ? matching[0] : postings.length === 1 &&
    (!postings[0].url || (typeof postings[0].url === 'string' && sameOfferUrl(postings[0].url, expectedUrl))) ? postings[0] : null;
  if (posting && typeof posting.description === 'string') {
    const description = htmlText(posting.description);
    if (usableOfferDescription(description)) {
      const org = posting.hiringOrganization as { name?: unknown } | undefined;
      return { jobTitle: typeof posting.title === 'string' ? posting.title : null,
        company: typeof org?.name === 'string' ? org.name : null, description, isolatedDescription: true };
    }
  }
  // A listing with several jobs is not evidence for one specific offer.
  if (postings.length && !posting) return null;
  const jobTitle = $('h1').first().text().trim() || null;
  const company = $('.topcard__org-name-link, .job-details-jobs-unified-top-card__company-name, [itemprop="hiringOrganization"]').first().text().trim() || null;
  const selectors = [
    '.show-more-less-html__markup', '.jobs-description__content', '.jobs-description-content__text',
    '#jobDescriptionText', '[itemprop="description"]', '[data-testid="job-description"]',
    'main', 'article',
  ];
  for (const selector of selectors) {
    const container = $(selector).first().clone();
    container.find('[class*="similar-job"], [class*="recommended"], [class*="cookie"]').remove();
    const description = htmlText(container.html() || '');
    if (usableOfferDescription(description)) return { jobTitle, company, description, isolatedDescription: !['main', 'article'].includes(selector) };
  }
  return null;
}
