import { listApprovedTelegramPostsReadyToPublish } from "@foundryjobs/db";
import type { PublishTelegramRunSummary, TelegramPublishResult } from "@foundryjobs/shared";
import { publishTelegramGeneratedPost } from "./publish-telegram-one";

export async function publishApprovedTelegramPosts(limit = 10): Promise<PublishTelegramRunSummary> {
  const startedAt = new Date();
  const readyPosts = await listApprovedTelegramPostsReadyToPublish(limit);
  const results: TelegramPublishResult[] = [];

  for (const post of readyPosts) {
    results.push(await publishTelegramGeneratedPost(post.generatedPostId));
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
