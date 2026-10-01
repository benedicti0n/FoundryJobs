import {
  BUFFER_CONFIG_ERROR,
  BUFFER_PLATFORMS,
  isBufferConfiguredForPlatform,
} from "@foundryjobs/buffer";
import { listApprovedBufferPostsReadyToPublish } from "@foundryjobs/db";
import type { BufferPublishResult, BufferPublishRunSummary } from "@foundryjobs/shared";
import { publishBufferGeneratedPost } from "./publish-buffer-one";

export async function publishApprovedBufferPosts(limit = 10): Promise<BufferPublishRunSummary> {
  const anyPlatformConfigured = BUFFER_PLATFORMS.some((platform) =>
    isBufferConfiguredForPlatform(platform),
  );
  if (!anyPlatformConfigured) {
    throw new Error(BUFFER_CONFIG_ERROR);
  }

  const startedAt = new Date();
  const readyPosts = await listApprovedBufferPostsReadyToPublish(limit);
  const results: BufferPublishResult[] = [];

  for (const post of readyPosts) {
    results.push(await publishBufferGeneratedPost(post.generatedPostId));
  }

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    processedCount: results.length,
    publishedCount: results.filter((result) => result.status === "published").length,
    skippedCount: results.filter((result) => result.status === "skipped").length,
    failedCount: results.filter((result) => result.status === "failed").length,
    results,
  };
}
