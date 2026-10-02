import test from 'node:test';
import assert from 'node:assert/strict';
import { getAuthIntent } from '@/lib/auth-intent';
import {
  GUEST_POST_DOWNLOAD_REGISTER_HREF,
  consumeGuestSavePrompt,
  guestPostDownloadClaimPath,
  shouldShowGuestSavePrompt,
} from '@/lib/guest-save-prompt';

test('the save prompt appears once after a completed guest download', () => {
  assert.equal(
    shouldShowGuestSavePrompt({ isGuest: true, downloadCompleted: true, alreadyShown: false }),
    true,
  );
  assert.equal(
    shouldShowGuestSavePrompt({ isGuest: true, downloadCompleted: true, alreadyShown: true }),
    false,
  );
  assert.equal(
    shouldShowGuestSavePrompt({ isGuest: false, downloadCompleted: true, alreadyShown: false }),
    false,
  );
  assert.equal(
    shouldShowGuestSavePrompt({ isGuest: true, downloadCompleted: false, alreadyShown: false }),
    false,
  );
});

test('a second completed download in the same guest session does not open the prompt again', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  assert.equal(consumeGuestSavePrompt(storage), true);
  assert.equal(consumeGuestSavePrompt(storage), false);
});

test('post-download registration keeps source through the claim callback', () => {
  assert.equal(GUEST_POST_DOWNLOAD_REGISTER_HREF, '/register?source=guest-post-download');
  const intent = getAuthIntent(new URL(GUEST_POST_DOWNLOAD_REGISTER_HREF, 'https://matchply.internal').searchParams);
  assert.equal(intent.source, 'guest-post-download');
  assert.equal(guestPostDownloadClaimPath(), '/auth/claim?next=%2Fdashboard&source=guest-post-download');
});
