import {
  getPublishableGeneratedPost,
  hasSuccessfulPublishEvent,
  recordPublishFailure,
  recordPublishSuccess,
} from "@foundryjobs/db";
import {
  isEnvSet,
  isPublicHttpUrl,
  type PublishableGeneratedPostDto,
  type TelegramPublishResult,
} from "@foundryjobs/shared";
import {
  publishGeneratedPostToTelegram,
  validateTelegramPhotoUrl,
  type LogoValidationResult,
  type TelegramPublishOptions,
  type TelegramPublishOutcome,
} from "@foundryjobs/telegram";

const TELEGRAM_CONFIG_ERROR =
  "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required for Telegram publishing";

export type TelegramPublishDeps = {
  provider?: (
    post: PublishableGeneratedPostDto,
    options?: TelegramPublishOptions,
  ) => Promise<TelegramPublishOutcome>;
  logoResolver?: (post: PublishableGeneratedPostDto) => Promise<string | null>;
  logoValidator?: (url: string) => Promise<LogoValidationResult>;
};

async function defaultLogoResolver(post: PublishableGeneratedPostDto): Promise<string | null> {
  const imageUrl = post.imageUrl?.trim();
  if (imageUrl && isPublicHttpUrl(imageUrl)) {
    return imageUrl;
  }
  return null;
}

export async function publishTelegramGeneratedPost(
  generatedPostId: string,
  deps: TelegramPublishDeps = {},
): Promise<TelegramPublishResult> {
  const provider = deps.provider ?? publishGeneratedPostToTelegram;
  const logoResolver = deps.logoResolver ?? defaultLogoResolver;
  const logoValidator = deps.logoValidator ?? validateTelegramPhotoUrl;
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

  let logoUrl: string | null = null;
  try {
    const candidateLogo = await logoResolver(post);
    if (candidateLogo) {
      const validation = await logoValidator(candidateLogo);
      if (validation.ok) {
        logoUrl = candidateLogo;
      } else {
        console.warn(
          `[publisher] telegram logo skipped for ${post.generatedPostId}: ${validation.reason}`,
        );
      }
    }
  } catch {
    console.warn(`[publisher] telegram logo resolution failed for ${post.generatedPostId}`);
  }

  try {
    const outcome = await provider(post, { logoUrl });
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
