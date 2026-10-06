import { listNewRawPosts } from "@foundryjobs/db";
import type { NormalizeRawPostResult, NormalizeRunSummary } from "@foundryjobs/shared";
import { normalizeRawPost } from "./normalize-one";
import { prioritizeByRelevance } from "./relevance-filter";

export async function normalizeNewRawPosts(limit = 25): Promise<NormalizeRunSummary> {
  const startedAt = new Date();
  const rawPosts = prioritizeByRelevance(await listNewRawPosts(limit));
  const results: NormalizeRawPostResult[] = [];

  for (const rawPost of rawPosts) {
    results.push(await normalizeRawPost(rawPost.id));
  }

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    processedCount: results.length,
    normalizedCount: results.filter((result) => result.status === "normalized").length,
    rejectedCount: results.filter((result) => result.status === "rejected").length,
    errorCount: results.filter((result) => result.status === "error").length,
    results,
  };
}
