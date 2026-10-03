import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assembleActivationCandidates,
  buildActivationEmail,
  canReceiveActivationEmail,
  isActivationEmailEnabled,
  runActivationEmailPass,
  selectActivationEmails,
  shouldSendDay1Email,
  shouldSendFollowupEmail,
  verifyActivationOptOut,
  activationOptOutPath,
  DAY1_MIN_AGE_MS,
} from '@/lib/activation-email';
import { shouldOpenSentPrompt } from '@/lib/application-sent';

const NOW = new Date('2026-03-12T10:00:00.000Z');
const USER = '11111111-1111-4111-8111-111111111111';
const OFFER = '22222222-2222-4222-8222-222222222222';
const CV = '33333333-3333-4333-8333-333333333333';

test('activation email stays off unless every setting is present', () => {
  assert.equal(isActivationEmailEnabled({}), false);
  assert.equal(isActivationEmailEnabled({
    ACTIVATION_EMAILS_ENABLED: 'true',
    RESEND_API_KEY: 're_test',
    ACTIVATION_EMAIL_FROM: 'Matchply <hola@matchply.com>',
    NEXTAUTH_URL: 'http://localhost:3000',
  }), false);
  assert.equal(isActivationEmailEnabled({
    ACTIVATION_EMAILS_ENABLED: 'false',
    RESEND_API_KEY: 're_test',
    ACTIVATION_EMAIL_FROM: 'Matchply <hola@matchply.com>',
    NEXTAUTH_URL: 'http://localhost:3000',
    NEXTAUTH_SECRET: 'secret',
  }), false);
  assert.equal(isActivationEmailEnabled({
    ACTIVATION_EMAILS_ENABLED: 'true',
    RESEND_API_KEY: 're_test',
    ACTIVATION_EMAIL_FROM: 'Matchply <hola@matchply.com>',
    NEXTAUTH_URL: 'http://localhost:3000',
    NEXTAUTH_SECRET: 'secret',
  }), true);
});

test('a disabled pass does not load candidates or send', async () => {
  const result = await runActivationEmailPass({
    enabled: false,
    now: NOW,
    load: async () => { throw new Error('load must not run'); },
    send: async () => { throw new Error('send must not run'); },
  });
  assert.deepEqual(result, { sent: 0, reason: 'disabled' });
});

test('guests, opt-outs and the wrong window are not mailed', () => {
  assert.equal(canReceiveActivationEmail({ isGuest: true, optedOut: false, email: 'a@b.c' }), false);
  assert.equal(canReceiveActivationEmail({ isGuest: false, optedOut: true, email: 'a@b.c' }), false);
  assert.equal(canReceiveActivationEmail({ isGuest: false, optedOut: false, email: 'guest-1@guest.matchply.local' }), false);
  const firstPdfAt = new Date(NOW.getTime() - DAY1_MIN_AGE_MS);
  assert.equal(shouldSendDay1Email({ firstPdfAt, now: NOW, alreadySent: false }), true);
  assert.equal(shouldSendDay1Email({ firstPdfAt, now: NOW, alreadySent: true }), false);
  assert.equal(shouldSendDay1Email({
    firstPdfAt: new Date(NOW.getTime() - DAY1_MIN_AGE_MS + 1),
    now: NOW,
    alreadySent: false,
  }), false);
  const due = new Date(NOW.getTime() - 60_000);
  assert.equal(shouldSendFollowupEmail({
    status: 'applied', nextFollowupDate: due, now: NOW, alreadySent: false,
  }), true);
  assert.equal(shouldSendFollowupEmail({
    status: 'interested', nextFollowupDate: due, now: NOW, alreadySent: false,
  }), false);
  assert.equal(shouldSendFollowupEmail({
    status: 'applied', nextFollowupDate: due, now: NOW, alreadySent: true,
  }), false);

  const candidates = assembleActivationCandidates({
    users: [
      { id: USER, email: 'ana@example.com', isGuest: false },
      { id: 'guest-1', email: 'guest@guest.matchply.local', isGuest: true },
    ],
    pdfs: [
      { userId: USER, firstPdfAt, cvId: CV, offerId: OFFER },
      { userId: 'guest-1', firstPdfAt, cvId: CV, offerId: null },
    ],
    offers: [{
      id: OFFER,
      userId: USER,
      cvId: CV,
      status: 'applied',
      nextFollowupDate: due,
    }],
    markers: [{ userId: USER, action: 'activation_email_opt_out', details: null }],
  });
  assert.equal(selectActivationEmails(candidates, NOW).length, 0);
});

test('an enabled pass sends the day-1 PDF mail and the applied follow-up once', async () => {
  const firstPdfAt = new Date(NOW.getTime() - DAY1_MIN_AGE_MS);
  const due = new Date(NOW.getTime() - 60_000);
  const candidates = assembleActivationCandidates({
    users: [{ id: USER, email: 'ana@example.com', isGuest: false }],
    pdfs: [{ userId: USER, firstPdfAt, cvId: CV, offerId: OFFER }],
    offers: [{ id: OFFER, userId: USER, cvId: CV, status: 'applied', nextFollowupDate: due }],
    markers: [],
  });
  const sent: string[] = [];
  const result = await runActivationEmailPass({
    enabled: true,
    now: NOW,
    load: async () => candidates,
    send: async (plan) => { sent.push(plan.kind); },
  });
  assert.equal(result.sent, 2);
  assert.deepEqual(sent.sort(), ['day1_pdf', 'followup_applied']);

  const again = assembleActivationCandidates({
    users: [{ id: USER, email: 'ana@example.com', isGuest: false }],
    pdfs: [{ userId: USER, firstPdfAt, cvId: CV, offerId: OFFER }],
    offers: [{ id: OFFER, userId: USER, cvId: CV, status: 'applied', nextFollowupDate: due }],
    markers: [
      { userId: USER, action: 'activation_email_day1', details: null },
      { userId: USER, action: 'activation_email_followup', details: JSON.stringify({ offerId: OFFER }) },
    ],
  });
  assert.equal(selectActivationEmails(again, NOW).length, 0);
});

test('day-1 mail links the CV and asks if it was sent; the opt-out token is signed', () => {
  const message = buildActivationEmail({
    kind: 'day1_pdf',
    language: 'es',
    appUrl: 'http://localhost:3000',
    cvId: CV,
    offerId: OFFER,
    optOutUrl: 'http://localhost:3000/api/email/opt-out?user=1&token=abc',
  });
  assert.equal(message.subject, 'Tu CV adaptado sigue aquí');
  assert.match(message.text, /¿Ya la enviaste\?/);
  assert.match(message.text, new RegExp(`/editor/${CV}\\?sent=1`));
  assert.match(message.text, /api\/email\/opt-out/);

  const path = activationOptOutPath(USER, 'secret');
  const token = new URL(`http://localhost${path}`).searchParams.get('token') || '';
  assert.equal(verifyActivationOptOut(USER, token, 'secret'), true);
  assert.equal(verifyActivationOptOut(USER, token, 'other'), false);
  assert.equal(verifyActivationOptOut(USER, 'nope', 'secret'), false);
});

test('the email link opens the sent question and a normal visit does not', () => {
  assert.equal(shouldOpenSentPrompt({ status: 'interested', mark: null, requested: true }), true);
  assert.equal(shouldOpenSentPrompt({ status: 'interested', mark: 'pending', requested: false }), true);
  assert.equal(shouldOpenSentPrompt({ status: 'interested', mark: null, requested: false }), false);
  assert.equal(shouldOpenSentPrompt({ status: 'interested', mark: 'done', requested: true }), false);
  assert.equal(shouldOpenSentPrompt({ status: 'applied', mark: null, requested: true }), false);
});
