import { buildClaimPath, getAuthIntent } from '@/lib/auth-intent';

export const GUEST_SAVE_PROMPT_STORAGE_KEY = 'matchply_guest_save_prompt';
export const GUEST_POST_DOWNLOAD_REGISTER_HREF = '/register?source=guest-post-download';

export function shouldShowGuestSavePrompt(input: {
  isGuest: boolean;
  downloadCompleted: boolean;
  alreadyShown: boolean;
}): boolean {
  return input.isGuest && input.downloadCompleted && !input.alreadyShown;
}

type PromptStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

/** Marks the prompt as shown and returns whether this completed guest download should open it. */
export function consumeGuestSavePrompt(storage: PromptStorage): boolean {
  let alreadyShown = false;
  try {
    alreadyShown = storage.getItem(GUEST_SAVE_PROMPT_STORAGE_KEY) === '1';
  } catch {
    alreadyShown = false;
  }
  const show = shouldShowGuestSavePrompt({
    isGuest: true,
    downloadCompleted: true,
    alreadyShown,
  });
  if (!show) return false;
  try {
    storage.setItem(GUEST_SAVE_PROMPT_STORAGE_KEY, '1');
  } catch {
    // A storage failure still shows the prompt once in this component instance.
  }
  return true;
}

/** Same claim callback the register page builds when opened with the post-download source. */
export function guestPostDownloadClaimPath(): string {
  const intent = getAuthIntent(new URLSearchParams('source=guest-post-download'));
  return buildClaimPath(intent);
}
