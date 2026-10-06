const PRIVATE_HOST_RE =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|::1|\[::1\])/i;

export function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }
    return !PRIVATE_HOST_RE.test(url.hostname);
  } catch {
    return false;
  }
}

export const REMOTE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const REMOTE_IMAGE_TIMEOUT_MS = 10_000;

const SUPPORTED_RASTER_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export type RemoteImageValidationResult =
  { ok: true; contentType: string; sizeBytes: number } | { ok: false; reason: string };

export async function validateRemoteImageUrl(
  url: string,
  options: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<RemoteImageValidationResult> {
  if (!isPublicHttpUrl(url)) {
    return { ok: false, reason: "URL must be a public http(s) URL" };
  }

  const timeoutMs = options.timeoutMs ?? REMOTE_IMAGE_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? REMOTE_IMAGE_MAX_BYTES;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { method: "GET", signal: controller.signal });
    if (!response.ok) {
      return { ok: false, reason: `fetch failed with status ${response.status}` };
    }

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
    if (contentType === "image/svg+xml") {
      return { ok: false, reason: "svg images are not supported" };
    }
    if (!SUPPORTED_RASTER_IMAGE_TYPES.has(contentType)) {
      return { ok: false, reason: `unsupported content type: ${contentType || "unknown"}` };
    }

    const declaredLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      return { ok: false, reason: "image exceeds the size limit" };
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
        if (sizeBytes > maxBytes) {
          await reader.cancel().catch(() => undefined);
          return { ok: false, reason: "image exceeds the size limit" };
        }
      }
    } else {
      const buffer = await response.arrayBuffer();
      sizeBytes = buffer.byteLength;
      if (sizeBytes > maxBytes) {
        return { ok: false, reason: "image exceeds the size limit" };
      }
    }

    if (sizeBytes === 0) {
      return { ok: false, reason: "image response was empty" };
    }

    return { ok: true, contentType, sizeBytes };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, reason: `fetch timed out after ${timeoutMs}ms` };
    }
    return { ok: false, reason: "fetch failed" };
  } finally {
    clearTimeout(timeout);
  }
}
