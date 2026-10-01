import { listInstagramPostsNeedingCards } from "@foundryjobs/db";
import type { InstagramCardRenderResult, InstagramCardRunSummary } from "@foundryjobs/shared";
import { renderInstagramCard } from "./render-instagram-card";

export async function renderInstagramCardsForPendingPosts(
  limit = 10,
): Promise<InstagramCardRunSummary> {
  const startedAt = new Date();
  const posts = await listInstagramPostsNeedingCards(limit);
  const results: InstagramCardRenderResult[] = [];

  for (const post of posts) {
    results.push(await renderInstagramCard(post.generatedPostId));
  }

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    processedCount: results.length,
    renderedCount: results.filter((result) => result.status === "rendered").length,
    skippedCount: results.filter((result) => result.status === "skipped").length,
    errorCount: results.filter((result) => result.status === "error").length,
    results,
  };
}
