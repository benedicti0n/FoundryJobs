import type { PublishableGeneratedPostDto } from "@foundryjobs/shared";
import { sendTelegramMessage, sendTelegramPhoto, type TelegramSendResult } from "./client";
import { TELEGRAM_PHOTO_CAPTION_LIMIT } from "./logo";

export type TelegramPublishOutcome = {
  result: TelegramSendResult;
  externalPostId: string;
  publishedUrl: string | null;
  messageIds: number[];
};

export type TelegramPublishOptions = {
  logoUrl?: string | null;
};

function buildPublishedUrl(result: TelegramSendResult): string | null {
  return result.chatUsername && result.messageId > 0
    ? `https://t.me/${result.chatUsername}/${result.messageId}`
    : null;
}

function buildShortCaption(text: string, limit = 900): string {
  const lines = text.split("\n");
  const kept: string[] = [];
  let length = 0;
  for (const line of lines) {
    const nextLength = length + line.length + (kept.length > 0 ? 1 : 0);
    if (nextLength > limit) {
      break;
    }
    kept.push(line);
    length = nextLength;
  }
  const caption = kept.join("\n").trim();
  return caption.length > 0 ? caption : text.slice(0, limit);
}

export async function publishGeneratedPostToTelegram(
  post: PublishableGeneratedPostDto,
  options: TelegramPublishOptions = {},
): Promise<TelegramPublishOutcome> {
  const text = post.textContent;
  const logoUrl = options.logoUrl ?? null;

  if (logoUrl) {
    const needsSplit = text.length > TELEGRAM_PHOTO_CAPTION_LIMIT;
    const caption = needsSplit ? buildShortCaption(text) : text;
    const photoResult = await sendTelegramPhoto(logoUrl, caption);
    const messageIds = [photoResult.messageId];

    if (needsSplit) {
      const textResult = await sendTelegramMessage(text);
      messageIds.push(textResult.messageId);
    }

    return {
      result: photoResult,
      externalPostId: messageIds.join("+"),
      publishedUrl: buildPublishedUrl(photoResult),
      messageIds,
    };
  }

  const result = await sendTelegramMessage(text);
  return {
    result,
    externalPostId: String(result.messageId),
    publishedUrl: buildPublishedUrl(result),
    messageIds: [result.messageId],
  };
}
