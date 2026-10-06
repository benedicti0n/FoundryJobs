import { isPublicHttpUrl } from "@foundryjobs/shared";

export { isPublicHttpUrl };

export const TELEGRAM_PHOTO_CAPTION_LIMIT = 1024;
export const TELEGRAM_LOGO_MAX_BYTES = 10 * 1024 * 1024;
export const TELEGRAM_LOGO_TIMEOUT_MS = 10_000;

const SUPPORTED_PHOTO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export type LogoValidationResult =
  { ok: true; contentType: string; sizeBytes: number } | { ok: false; reason: string };

export async function validateTelegramPhotoUrl(
  url: string,
  timeoutMs = TELEGRAM_LOGO_TIMEOUT_MS,
): Promise<LogoValidationResult> {
  if (!isPublicHttpUrl(url)) {
    return { ok: false, reason: "logo URL must be a public http(s) URL" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: "GET", signal: controller.signal });
    if (!response.ok) {
      return { ok: false, reason: `logo fetch failed with status ${response.status}` };
    }

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
    if (contentType === "image/svg+xml") {
      return { ok: false, reason: "svg logos are not supported as Telegram photos" };
    }
    if (!SUPPORTED_PHOTO_TYPES.has(contentType)) {
      return { ok: false, reason: `unsupported logo content type: ${contentType || "unknown"}` };
    }

    const declaredLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
    if (Number.isFinite(declaredLength) && declaredLength > TELEGRAM_LOGO_MAX_BYTES) {
      return { ok: false, reason: "logo exceeds the Telegram photo size limit" };
    }

    let sizeBytes = 0;
    const reader = response.body?.getReader();
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        sizeBytes += value?.byteLength ?? 0;
        if (sizeBytes > TELEGRAM_LOGO_MAX_BYTES) {
          await reader.cancel().catch(() => undefined);
          return { ok: false, reason: "logo exceeds the Telegram photo size limit" };
        }
      }
    } else {
      const buffer = await response.arrayBuffer();
      sizeBytes = buffer.byteLength;
      if (sizeBytes > TELEGRAM_LOGO_MAX_BYTES) {
        return { ok: false, reason: "logo exceeds the Telegram photo size limit" };
      }
    }

    if (sizeBytes === 0) {
      return { ok: false, reason: "logo response was empty" };
    }

    return { ok: true, contentType, sizeBytes };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, reason: `logo fetch timed out after ${timeoutMs}ms` };
    }
    return { ok: false, reason: "logo fetch failed" };
  } finally {
    clearTimeout(timeout);
  }
}
