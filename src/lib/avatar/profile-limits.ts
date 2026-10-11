export const PROFILE_PHOTO_LIMITS = {
  maxBytes: 256 * 1024,
  maxEdge: 768,
  uploadMaxBytes: 10 * 1024 * 1024,
};
export const PROFILE_PHOTO_BODY_MAX_BYTES = Math.ceil(PROFILE_PHOTO_LIMITS.maxBytes / 3) * 4 + 1024;
