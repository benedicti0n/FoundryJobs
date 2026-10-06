import {
  BUFFER_CONFIG_ERROR,
  isBufferConfiguredForPlatform,
  isBufferPlatform,
  publishImagePostToBuffer,
  publishTextToBuffer,
  type BufferPublishOutcome,
} from "@foundryjobs/buffer";
import {
  getBufferPublishablePost,
  hasSuccessfulPublishEvent,
  recordPublishFailure,
  recordPublishSuccess,
} from "@foundryjobs/db";
import type { BufferPlatform, BufferPublishResult } from "@foundryjobs/shared";

export type BufferPublishDeps = {
  publishText?: (platform: BufferPlatform, text: string) => Promise<BufferPublishOutcome>;
  publishImage?: (
    platform: BufferPlatform,
    text: string,
    imageUrl: string,
  ) => Promise<BufferPublishOutcome>;
};

export async function publishBufferGeneratedPost(
  generatedPostId: string,
  deps: BufferPublishDeps = {},
): Promise<BufferPublishResult> {
  const publishText = deps.publishText ?? publishTextToBuffer;
  const publishImage = deps.publishImage ?? publishImagePostToBuffer;
  try {
    const post = await getBufferPublishablePost(generatedPostId);
    if (!post) {
      return {
        generatedPostId,
        jobPostId: null,
        platform: null,
        status: "skipped",
        errorMessage: "Generated post not found",
      };
    }

    if (post.platform === "telegram") {
      return {
        generatedPostId: post.generatedPostId,
        jobPostId: post.jobPostId,
        platform: post.platform,
        status: "skipped",
        errorMessage: "Telegram publishing is handled by the Telegram pipeline, not Buffer",
      };
    }

    if (post.status !== "approved") {
      return {
        generatedPostId: post.generatedPostId,
        jobPostId: post.jobPostId,
        platform: post.platform,
        status: "skipped",
        errorMessage: `Generated post status is ${post.status}; only approved drafts are published`,
      };
    }

    if (await hasSuccessfulPublishEvent(post.generatedPostId)) {
      return {
        generatedPostId: post.generatedPostId,
        jobPostId: post.jobPostId,
        platform: post.platform,
        status: "skipped",
        errorMessage: "A successful publish event already exists for this generated post",
      };
    }

    if (!isBufferPlatform(post.platform)) {
      return {
        generatedPostId: post.generatedPostId,
        jobPostId: post.jobPostId,
        platform: post.platform,
        status: "skipped",
        errorMessage: `Platform ${post.platform} is not supported by Buffer publishing`,
      };
    }

    if (post.platform === "instagram") {
      if (!post.imageUrl) {
        return {
          generatedPostId: post.generatedPostId,
          jobPostId: post.jobPostId,
          platform: post.platform,
          status: "skipped",
          errorMessage: "Instagram publishing requires a public image URL",
        };
      }
      if (!/^https?:\/\//i.test(post.imageUrl)) {
        return {
          generatedPostId: post.generatedPostId,
          jobPostId: post.jobPostId,
          platform: post.platform,
          status: "skipped",
          errorMessage:
            "Instagram image URL must be public; upload the card to R2 before publishing",
        };
      }
    }

    if (!isBufferConfiguredForPlatform(post.platform)) {
      return {
        generatedPostId: post.generatedPostId,
        jobPostId: post.jobPostId,
        platform: post.platform,
        status: "failed",
        externalPostId: null,
        publishedUrl: null,
        errorMessage: BUFFER_CONFIG_ERROR,
      };
    }

    try {
      let outcome: BufferPublishOutcome;
      if (post.platform === "instagram") {
        outcome = await publishImage("instagram", post.textContent, post.imageUrl ?? "");
      } else {
        outcome = await publishText(post.platform, post.textContent);
      }

      await recordPublishSuccess({
        platform: post.platform,
        jobPostId: post.jobPostId,
        generatedPostId: post.generatedPostId,
        externalPostId: outcome.externalPostId,
        publishedUrl: outcome.publishedUrl,
      });

      return {
        generatedPostId: post.generatedPostId,
        jobPostId: post.jobPostId,
        platform: post.platform,
        status: "published",
        externalPostId: outcome.externalPostId,
        publishedUrl: outcome.publishedUrl,
        errorMessage: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === BUFFER_CONFIG_ERROR) {
        return {
          generatedPostId: post.generatedPostId,
          jobPostId: post.jobPostId,
          platform: post.platform,
          status: "failed",
          externalPostId: null,
          publishedUrl: null,
          errorMessage: message,
        };
      }

      await recordPublishFailure({
        platform: post.platform,
        jobPostId: post.jobPostId,
        generatedPostId: post.generatedPostId,
        errorMessage: message,
      }).catch(() => undefined);

      return {
        generatedPostId: post.generatedPostId,
        jobPostId: post.jobPostId,
        platform: post.platform,
        status: "failed",
        externalPostId: null,
        publishedUrl: null,
        errorMessage: message,
      };
    }
  } catch (error) {
    return {
      generatedPostId,
      jobPostId: null,
      platform: null,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}
