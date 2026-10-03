import { madridLocalToUtc, madridYmd, parseYmd } from '@/lib/madrid-time';

export type SentDecision =
  | { status: 'interested'; nextFollowupDate: null }
  | { status: 'applied'; nextFollowupDate: Date };

export function sentPromptKey(offerId: string) {
  return `matchply_sent_${offerId}`;
}

/** Download finished before optimize inserted the candidacy. Keyed by CV so a refresh can still find it. */
export function sentDownloadCvKey(cvId: string) {
  return `matchply_sent_cv_${cvId}`;
}

export type DownloadSentNote =
  | { scope: 'cv'; key: string; mark: 'pending'; open: false }
  | { scope: 'offer'; key: string; mark: 'pending'; open: true }
  | { scope: 'none'; open: false };

/** Remember a completed download. Without an offer yet, keep it on the CV. With an interested offer, mark that offer. */
export function noteDownloadForSentPrompt(input: {
  cvId: string;
  offerId: string | null;
  offerStatus: string | null;
  offerMark: string | null;
}): DownloadSentNote {
  if (!input.offerId || !input.offerStatus) {
    return { scope: 'cv', key: sentDownloadCvKey(input.cvId), mark: 'pending', open: false };
  }
  if (!shouldAskIfSent({ status: input.offerStatus, mark: input.offerMark })) {
    return { scope: 'none', open: false };
  }
  return { scope: 'offer', key: sentPromptKey(input.offerId), mark: 'pending', open: true };
}

/** Move a remembered download onto the offer the detail page already reads. */
export function claimWaitedDownload(input: {
  cvMark: string | null;
  offerId: string;
  offerStatus: string;
  offerMark: string | null;
}): { offerKey: string; offerMark: 'pending'; writeOffer: boolean; clearCv: true } | null {
  if (input.cvMark !== 'pending') return null;
  const offerKey = sentPromptKey(input.offerId);
  if (!shouldAskIfSent({ status: input.offerStatus, mark: input.offerMark })) {
    return { offerKey, offerMark: 'pending', writeOffer: false, clearCv: true };
  }
  return { offerKey, offerMark: 'pending', writeOffer: true, clearCv: true };
}

/** The question is only for an interested candidacy that has not been answered yet. */
export function shouldAskIfSent(input: { status: string; mark: string | null }): boolean {
  return input.status === 'interested' && input.mark !== 'done';
}

/** Download leaves a pending mark. The day-1 email opens the same question with ?sent=1. */
export function shouldOpenSentPrompt(input: { status: string; mark: string | null; requested: boolean }): boolean {
  return shouldAskIfSent(input) && (input.mark === 'pending' || input.requested);
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
