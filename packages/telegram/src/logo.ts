import { validateRemoteImageUrl, type RemoteImageValidationResult } from "@foundryjobs/shared";

export { isPublicHttpUrl } from "@foundryjobs/shared";

export const TELEGRAM_PHOTO_CAPTION_LIMIT = 1024;
export const TELEGRAM_LOGO_MAX_BYTES = 10 * 1024 * 1024;
export const TELEGRAM_LOGO_TIMEOUT_MS = 10_000;

export type LogoValidationResult = RemoteImageValidationResult;

export async function validateTelegramPhotoUrl(
  url: string,
  timeoutMs = TELEGRAM_LOGO_TIMEOUT_MS,
): Promise<LogoValidationResult> {
  return validateRemoteImageUrl(url, { timeoutMs, maxBytes: TELEGRAM_LOGO_MAX_BYTES });
}
