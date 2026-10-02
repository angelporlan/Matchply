import { createHmac, timingSafeEqual } from 'crypto';
import es from '@/lib/i18n/es';
import en from '@/lib/i18n/en';

export const DAY1_MIN_AGE_MS = 24 * 60 * 60 * 1000;
export const DAY1_MAX_AGE_MS = 48 * 60 * 60 * 1000;
export const FOLLOWUP_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export const ACTIVATION_EMAIL_OPT_OUT = 'activation_email_opt_out';
export const ACTIVATION_EMAIL_DAY1 = 'activation_email_day1';
export const ACTIVATION_EMAIL_FOLLOWUP = 'activation_email_followup';

export type ActivationEmailKind = 'day1_pdf' | 'followup_applied';

export type ActivationEmailPlan = {
  kind: ActivationEmailKind;
  userId: string;
  email: string;
  cvId: string | null;
  offerId: string | null;
};

export type ActivationEmailCandidate = {
  userId: string;
  email: string;
  isGuest: boolean;
  optedOut: boolean;
  kind: ActivationEmailKind;
  cvId: string | null;
  offerId: string | null;
  offerStatus: string | null;
  nextFollowupDate: Date | null;
  firstPdfAt: Date | null;
  alreadySent: boolean;
};

export type ActivationUserRow = { id: string; email: string; isGuest: boolean };
export type ActivationPdfRow = {
  userId: string;
  firstPdfAt: Date;
  cvId: string | null;
  offerId: string | null;
};
export type ActivationOfferRow = {
  id: string;
  userId: string;
  cvId: string | null;
  status: string;
  nextFollowupDate: Date;
};
export type ActivationMarkerRow = { userId: string | null; action: string; details: string | null };

/** Off unless the flag, Resend key, from-address, app URL and auth secret are all set. */
export function isActivationEmailEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ACTIVATION_EMAILS_ENABLED === 'true'
    && Boolean(env.RESEND_API_KEY?.trim())
    && Boolean(env.ACTIVATION_EMAIL_FROM?.trim())
    && Boolean((env.NEXTAUTH_URL || env.APP_URL || '').trim())
    && Boolean(env.NEXTAUTH_SECRET?.trim());
}

export function canReceiveActivationEmail(input: { isGuest: boolean; optedOut: boolean; email: string }): boolean {
  const email = input.email.trim().toLowerCase();
  if (!email || email.endsWith('@guest.matchply.local')) return false;
  return !input.isGuest && !input.optedOut;
}

export function shouldSendDay1Email(input: { firstPdfAt: Date; now: Date; alreadySent: boolean }): boolean {
  if (input.alreadySent) return false;
  const age = input.now.getTime() - input.firstPdfAt.getTime();
  return age >= DAY1_MIN_AGE_MS && age < DAY1_MAX_AGE_MS;
}

export function shouldSendFollowupEmail(input: {
  status: string;
  nextFollowupDate: Date | null;
  now: Date;
  alreadySent: boolean;
}): boolean {
  if (input.alreadySent) return false;
  if (input.status !== 'applied' || !input.nextFollowupDate) return false;
  const age = input.now.getTime() - input.nextFollowupDate.getTime();
  return age >= 0 && age <= FOLLOWUP_LOOKBACK_MS;
}

export function cvIdFromAuditDetails(details: string | null): string | null {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details) as { cvId?: unknown };
    return typeof parsed.cvId === 'string' && parsed.cvId.length > 0 ? parsed.cvId : null;
  } catch {
    return null;
  }
}

export function activationFollowupAlreadySent(details: string | null, offerId: string): boolean {
  if (!details) return false;
  try {
    const parsed = JSON.parse(details) as { offerId?: unknown };
    return parsed.offerId === offerId;
  } catch {
    return false;
  }
}

export function activationOptOutToken(userId: string, secret: string): string {
  return createHmac('sha256', secret).update(`activation-opt-out:${userId}`).digest('base64url');
}

export function activationOptOutPath(userId: string, secret: string): string {
  const token = activationOptOutToken(userId, secret);
  return `/api/email/opt-out?user=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;
}

export function verifyActivationOptOut(userId: string, token: string, secret: string): boolean {
  if (!secret || !userId || !token) return false;
  const expected = activationOptOutToken(userId, secret);
  const left = Buffer.from(expected);
  const right = Buffer.from(token);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function markerOptedOut(markers: ActivationMarkerRow[], userId: string): boolean {
  return markers.some((marker) => marker.userId === userId && marker.action === ACTIVATION_EMAIL_OPT_OUT);
}

function day1AlreadySent(markers: ActivationMarkerRow[], userId: string): boolean {
  return markers.some((marker) => marker.userId === userId && marker.action === ACTIVATION_EMAIL_DAY1);
}

export function assembleActivationCandidates(input: {
  users: ActivationUserRow[];
  pdfs: ActivationPdfRow[];
  offers: ActivationOfferRow[];
  markers: ActivationMarkerRow[];
}): ActivationEmailCandidate[] {
  const byId = new Map(input.users.map((user) => [user.id, user]));
  const candidates: ActivationEmailCandidate[] = [];

  for (const pdf of input.pdfs) {
    const user = byId.get(pdf.userId);
    if (!user) continue;
    candidates.push({
      userId: user.id,
      email: user.email,
      isGuest: user.isGuest,
      optedOut: markerOptedOut(input.markers, user.id),
      kind: 'day1_pdf',
      cvId: pdf.cvId,
      offerId: pdf.offerId,
      offerStatus: null,
      nextFollowupDate: null,
      firstPdfAt: pdf.firstPdfAt,
      alreadySent: day1AlreadySent(input.markers, user.id),
    });
  }

  for (const offer of input.offers) {
    const user = byId.get(offer.userId);
    if (!user) continue;
    const sent = input.markers.some((marker) => (
      marker.userId === user.id
      && marker.action === ACTIVATION_EMAIL_FOLLOWUP
      && activationFollowupAlreadySent(marker.details, offer.id)
    ));
    candidates.push({
      userId: user.id,
      email: user.email,
      isGuest: user.isGuest,
      optedOut: markerOptedOut(input.markers, user.id),
      kind: 'followup_applied',
      cvId: offer.cvId,
      offerId: offer.id,
      offerStatus: offer.status,
      nextFollowupDate: offer.nextFollowupDate,
      firstPdfAt: null,
      alreadySent: sent,
    });
  }

  return candidates;
}

export function selectActivationEmails(candidates: ActivationEmailCandidate[], now: Date): ActivationEmailPlan[] {
  const plans: ActivationEmailPlan[] = [];
  for (const candidate of candidates) {
    if (!canReceiveActivationEmail(candidate)) continue;
    const due = candidate.kind === 'day1_pdf'
      ? Boolean(candidate.firstPdfAt) && shouldSendDay1Email({
        firstPdfAt: candidate.firstPdfAt as Date,
        now,
        alreadySent: candidate.alreadySent,
      })
      : shouldSendFollowupEmail({
        status: candidate.offerStatus || '',
        nextFollowupDate: candidate.nextFollowupDate,
        now,
        alreadySent: candidate.alreadySent,
      });
    if (!due) continue;
    plans.push({
      kind: candidate.kind,
      userId: candidate.userId,
      email: candidate.email,
      cvId: candidate.cvId,
      offerId: candidate.offerId,
    });
  }
  return plans;
}

export function buildActivationEmail(input: {
  kind: ActivationEmailKind;
  language: 'es' | 'en';
  appUrl: string;
  cvId: string | null;
  offerId: string | null;
  optOutUrl: string;
}): { subject: string; text: string } {
  const copy = (input.language === 'en' ? en : es).emails.activation;
  const origin = input.appUrl.replace(/\/$/, '');
  const cvUrl = input.cvId ? `${origin}/editor/${input.cvId}?sent=1` : `${origin}/dashboard`;
  const offerUrl = input.offerId
    ? `${origin}/dashboard/applications/offer/${input.offerId}?sent=1`
    : null;
  const lines = input.kind === 'day1_pdf'
    ? [copy.day1Intro, copy.day1Question, `${copy.openCv}: ${cvUrl}`]
    : [copy.followupIntro, offerUrl ? `${copy.openOffer}: ${offerUrl}` : `${copy.openCv}: ${cvUrl}`];
  if (input.kind === 'day1_pdf' && offerUrl) lines.push(`${copy.openOffer}: ${offerUrl}`);
  lines.push(`${copy.optOut}: ${input.optOutUrl}`);
  return {
    subject: input.kind === 'day1_pdf' ? copy.day1Subject : copy.followupSubject,
    text: lines.join('\n'),
  };
}

/** Disabled runs return before load or send. Callers must not pass a live sender when the flag is off. */
export async function runActivationEmailPass(input: {
  enabled: boolean;
  now: Date;
  load: () => Promise<ActivationEmailCandidate[]>;
  send: (plan: ActivationEmailPlan) => Promise<void>;
}): Promise<{ sent: number; reason?: 'disabled' }> {
  if (!input.enabled) return { sent: 0, reason: 'disabled' };
  const plans = selectActivationEmails(await input.load(), input.now);
  let sent = 0;
  for (const plan of plans) {
    await input.send(plan);
    sent += 1;
  }
  return { sent };
}
