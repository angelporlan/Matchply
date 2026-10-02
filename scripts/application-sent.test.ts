import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimWaitedDownload,
  decideApplicationSent,
  noteDownloadForSentPrompt,
  sentDownloadCvKey,
  sentPromptKey,
  shouldAskIfSent,
  shouldOpenSentPrompt,
} from '@/lib/application-sent';
import { madridYmd } from '@/lib/madrid-time';

test('yes sets applied and a follow-up five Madrid days later; no stays interested', () => {
  const now = new Date('2026-03-10T22:30:00.000Z');
  const yes = decideApplicationSent('yes', now);
  assert.equal(yes.status, 'applied');
  if (yes.status === 'applied') assert.equal(madridYmd(yes.nextFollowupDate), '2026-03-15');
  const no = decideApplicationSent('no', now);
  assert.deepEqual(no, { status: 'interested', nextFollowupDate: null });
});

test('a download before the offer exists is kept and opens on that offer once it is interested', () => {
  const cvId = '33333333-3333-4333-8333-333333333333';
  const offerId = '22222222-2222-4222-8222-222222222222';
  const waited = noteDownloadForSentPrompt({
    cvId,
    offerId: null,
    offerStatus: null,
    offerMark: null,
  });
  assert.equal(waited.scope, 'cv');
  assert.equal(waited.open, false);
  if (waited.scope === 'cv') {
    assert.equal(waited.key, sentDownloadCvKey(cvId));
    assert.equal(waited.mark, 'pending');
  }

  const claimed = claimWaitedDownload({
    cvMark: 'pending',
    offerId,
    offerStatus: 'interested',
    offerMark: null,
  });
  assert.equal(claimed?.writeOffer, true);
  assert.equal(claimed?.clearCv, true);
  assert.equal(claimed?.offerKey, sentPromptKey(offerId));
  assert.equal(claimed?.offerMark, 'pending');
  assert.equal(shouldOpenSentPrompt({
    status: 'interested',
    mark: claimed?.offerMark ?? null,
    requested: false,
  }), true);
});

test('a remembered download does not reopen an answered candidacy or one that is no longer interested', () => {
  assert.equal(claimWaitedDownload({
    cvMark: 'pending',
    offerId: 'offer-1',
    offerStatus: 'interested',
    offerMark: 'done',
  })?.writeOffer, false);
  assert.equal(claimWaitedDownload({
    cvMark: 'pending',
    offerId: 'offer-1',
    offerStatus: 'applied',
    offerMark: null,
  })?.writeOffer, false);
  assert.equal(claimWaitedDownload({
    cvMark: null,
    offerId: 'offer-1',
    offerStatus: 'interested',
    offerMark: null,
  }), null);
});

test('a download that already has an interested offer marks that offer', () => {
  const noted = noteDownloadForSentPrompt({
    cvId: 'cv-1',
    offerId: 'offer-1',
    offerStatus: 'interested',
    offerMark: null,
  });
  assert.equal(noted.scope, 'offer');
  assert.equal(noted.open, true);
  if (noted.scope === 'offer') assert.equal(noted.key, sentPromptKey('offer-1'));
  assert.equal(noteDownloadForSentPrompt({
    cvId: 'cv-1',
    offerId: 'offer-1',
    offerStatus: 'interested',
    offerMark: 'done',
  }).scope, 'none');
});

test('the sent question is only for an interested candidacy that has not been answered', () => {
  assert.equal(shouldAskIfSent({ status: 'interested', mark: null }), true);
  assert.equal(shouldAskIfSent({ status: 'interested', mark: 'pending' }), true);
  assert.equal(shouldAskIfSent({ status: 'interested', mark: 'done' }), false);
  assert.equal(shouldAskIfSent({ status: 'applied', mark: null }), false);
});
