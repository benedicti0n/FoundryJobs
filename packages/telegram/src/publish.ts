import type { PublishableGeneratedPostDto } from "@foundryjobs/shared";
import { sendTelegramMessage, type TelegramSendResult } from "./client";

export type TelegramPublishOutcome = {
  result: TelegramSendResult;
  externalPostId: string;
  publishedUrl: string | null;
};

export async function publishGeneratedPostToTelegram(
  post: PublishableGeneratedPostDto,
): Promise<TelegramPublishOutcome> {
  const result = await sendTelegramMessage(post.textContent);

  return {
    result,
    externalPostId: String(result.messageId),
    publishedUrl:
      result.chatUsername && result.messageId > 0
        ? `https://t.me/${result.chatUsername}/${result.messageId}`
        : null,
  };
}
