import { madridLocalToUtc, madridYmd, parseYmd } from '@/lib/madrid-time';

export type SentDecision =
  | { status: 'interested'; nextFollowupDate: null }
  | { status: 'applied'; nextFollowupDate: Date };

export function sentPromptKey(offerId: string) {
  return `matchply_sent_${offerId}`;
}

/** The question is only for an interested candidacy that has not been answered yet. */
export function shouldAskIfSent(input: { status: string; mark: string | null }): boolean {
  return input.status === 'interested' && input.mark !== 'done';
}

function addCalendarDays(ymd: string, days: number): string {
  const parsed = parseYmd(ymd);
  if (!parsed) return ymd;
  const next = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  const year = next.getUTCFullYear();
  const month = String(next.getUTCMonth() + 1).padStart(2, '0');
  const day = String(next.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Yes moves the candidacy to applied and sets the follow-up five Madrid days later. No leaves it interested. */
export function decideApplicationSent(answer: 'yes' | 'no', now = new Date()): SentDecision {
  if (answer === 'no') return { status: 'interested', nextFollowupDate: null };
  const ymd = addCalendarDays(madridYmd(now), 5);
  const parsed = parseYmd(ymd);
  if (!parsed) return { status: 'applied', nextFollowupDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000) };
  return {
    status: 'applied',
    nextFollowupDate: madridLocalToUtc(parsed.year, parsed.month, parsed.day, 9, 0, 0),
  };
}
