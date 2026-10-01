import { listInstagramCardsNeedingUpload } from "@foundryjobs/db";
import type { InstagramCardUploadResult, InstagramCardUploadRunSummary } from "@foundryjobs/shared";
import { R2_CONFIG_ERROR, isR2Configured } from "@foundryjobs/storage";
import { uploadInstagramCard } from "./upload-instagram-card";

export async function uploadInstagramCardsForPendingPosts(
  limit = 10,
): Promise<InstagramCardUploadRunSummary> {
  if (!isR2Configured()) {
    throw new Error(R2_CONFIG_ERROR);
  }

  const startedAt = new Date();
  const cards = await listInstagramCardsNeedingUpload(limit);
  const results: InstagramCardUploadResult[] = [];

  for (const card of cards) {
    results.push(await uploadInstagramCard(card.generatedPostId));
  }

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    processedCount: results.length,
    uploadedCount: results.filter((result) => result.status === "uploaded").length,
    skippedCount: results.filter((result) => result.status === "skipped").length,
    errorCount: results.filter((result) => result.status === "error").length,
    results,
  };
}
