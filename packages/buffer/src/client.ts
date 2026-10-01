import { getEnv } from "@foundryjobs/shared";
import type { BufferPlatform } from "@foundryjobs/shared";
import { BUFFER_CONFIG_ERROR, getBufferProfileId } from "./profile-config";

const BUFFER_API_BASE = "https://api.bufferapp.com/1";
const REQUEST_TIMEOUT_MS = 30_000;

export type BufferUpdateOutcome = {
  externalPostId: string | null;
  publishedUrl: string | null;
  status: string | null;
};

type BufferUpdate = {
  id?: string;
  status?: string;
  service_update_id?: string;
  service_link?: string;
};

type BufferUpdatesResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  updates?: BufferUpdate[];
};

function sanitizeMessage(message: string): string {
  return message
    .replace(/access_token=[^&\s]*/gi, "access_token=[redacted]")
    .replace(/([?&][A-Za-z0-9_%-]+=[^&\s]*)/g, "")
    .slice(0, 300);
}

export async function createBufferUpdate(
  platform: BufferPlatform,
  text: string,
  imageUrl?: string,
): Promise<BufferUpdateOutcome> {
  const accessToken = getEnv("BUFFER_ACCESS_TOKEN");
  const profileId = getBufferProfileId(platform);
  if (!accessToken) {
    throw new Error(BUFFER_CONFIG_ERROR);
  }

  const body = new URLSearchParams();
  body.set("access_token", accessToken);
  body.append("profile_ids[]", profileId);
  body.set("text", text);
  body.set("now", "true");
  if (imageUrl) {
    body.set("media[photo]", imageUrl);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BUFFER_API_BASE}/updates/create.json`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as BufferUpdatesResponse | null;

    if (!response.ok || payload?.success === false) {
      const detail =
        payload?.message ??
        payload?.error ??
        `Buffer request failed with status ${response.status}`;
      throw new Error(`Buffer publish failed: ${sanitizeMessage(detail)}`);
    }

    const update = payload?.updates?.[0];
    return {
      externalPostId: update?.service_update_id ?? update?.id ?? null,
      publishedUrl: update?.service_link ?? null,
      status: update?.status ?? null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Buffer request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
