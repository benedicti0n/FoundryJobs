import type { BufferPlatform } from "@foundryjobs/shared";
import { createBufferUpdate, type BufferUpdateOutcome } from "./client";

export type BufferPublishOutcome = {
  externalPostId: string | null;
  publishedUrl: string | null;
};

function toOutcome(update: BufferUpdateOutcome): BufferPublishOutcome {
  return {
    externalPostId: update.externalPostId,
    publishedUrl: update.publishedUrl,
  };
}

export async function publishTextToBuffer(
  platform: BufferPlatform,
  text: string,
): Promise<BufferPublishOutcome> {
  return toOutcome(await createBufferUpdate(platform, text));
}

export async function publishImagePostToBuffer(
  platform: BufferPlatform,
  text: string,
  imageUrl: string,
): Promise<BufferPublishOutcome> {
  if (!/^https?:\/\//i.test(imageUrl)) {
    throw new Error("Instagram publishing through Buffer requires a public http(s) image URL");
  }
  return toOutcome(await createBufferUpdate(platform, text, imageUrl));
}
