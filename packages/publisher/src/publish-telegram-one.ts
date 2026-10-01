import {
  getPublishableGeneratedPost,
  hasSuccessfulPublishEvent,
  recordPublishFailure,
  recordPublishSuccess,
} from "@foundryjobs/db";
import { isEnvSet, type TelegramPublishResult } from "@foundryjobs/shared";
import { publishGeneratedPostToTelegram } from "@foundryjobs/telegram";

const TELEGRAM_CONFIG_ERROR =
  "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required for Telegram publishing";

export async function publishTelegramGeneratedPost(
  generatedPostId: string,
): Promise<TelegramPublishResult> {
  const post = await getPublishableGeneratedPost(generatedPostId);
  if (!post) {
    return {
      generatedPostId,
      jobPostId: null,
      status: "skipped",
      errorMessage: "Generated post not found",
    };
  }

  if (post.platform !== "telegram") {
    return {
      generatedPostId: post.generatedPostId,
      jobPostId: post.jobPostId,
      status: "skipped",
      errorMessage: `Platform ${post.platform} is not supported for publishing yet`,
    };
  }

  if (post.status !== "approved") {
    return {
      generatedPostId: post.generatedPostId,
      jobPostId: post.jobPostId,
      status: "skipped",
      errorMessage: `Generated post status is ${post.status}; only approved drafts are published`,
    };
  }

  if (await hasSuccessfulPublishEvent(post.generatedPostId)) {
    return {
      generatedPostId: post.generatedPostId,
      jobPostId: post.jobPostId,
      status: "skipped",
      errorMessage: "A successful publish event already exists for this generated post",
    };
  }

  if (!isEnvSet("TELEGRAM_BOT_TOKEN") || !isEnvSet("TELEGRAM_CHAT_ID")) {
    return {
      generatedPostId: post.generatedPostId,
      jobPostId: post.jobPostId,
      status: "failed",
      externalPostId: null,
      publishedUrl: null,
      errorMessage: TELEGRAM_CONFIG_ERROR,
    };
  }

  try {
    const outcome = await publishGeneratedPostToTelegram(post);
    await recordPublishSuccess({
      platform: "telegram",
      jobPostId: post.jobPostId,
      generatedPostId: post.generatedPostId,
      externalPostId: outcome.externalPostId,
      publishedUrl: outcome.publishedUrl,
    });

    return {
      generatedPostId: post.generatedPostId,
      jobPostId: post.jobPostId,
      status: "published",
      externalPostId: outcome.externalPostId,
      publishedUrl: outcome.publishedUrl,
      errorMessage: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordPublishFailure({
      platform: "telegram",
      jobPostId: post.jobPostId,
      generatedPostId: post.generatedPostId,
      errorMessage: message,
    }).catch(() => undefined);

    return {
      generatedPostId: post.generatedPostId,
      jobPostId: post.jobPostId,
      status: "failed",
      externalPostId: null,
      publishedUrl: null,
      errorMessage: message,
    };
  }
}
