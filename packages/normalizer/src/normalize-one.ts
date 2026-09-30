import { extractJobFromRawPost } from "@foundryjobs/ai";
import {
  createJobPostFromExtraction,
  createJobScore,
  findExistingJobPostByFingerprint,
  getRawPostById,
  getSourceById,
  markRawPostStatus,
  recordPromptRun,
} from "@foundryjobs/db";
import { scoreJob } from "@foundryjobs/scoring";
import type { NormalizeRawPostResult } from "@foundryjobs/shared";

export async function normalizeRawPost(rawPostId: string): Promise<NormalizeRawPostResult> {
  const rawPost = await getRawPostById(rawPostId);
  if (!rawPost) {
    return { rawPostId, status: "error", errorMessage: "Raw post not found" };
  }

  try {
    const extraction = await extractJobFromRawPost({
      rawTitle: rawPost.rawTitle,
      rawText: rawPost.rawText,
      rawUrl: rawPost.rawUrl,
      postedAt: rawPost.postedAt,
    });

    if (extraction.provider === "gemini" && extraction.usage) {
      await recordPromptRun({
        jobPostId: null,
        task: "extract_job",
        provider: "gemini",
        model: extraction.model ?? "unknown",
        inputTokens: extraction.usage.inputTokens,
        outputTokens: extraction.usage.outputTokens,
        costUsd: 0,
        latencyMs: extraction.usage.latencyMs,
      }).catch(() => undefined);
    }

    if (extraction.status === "rejected") {
      const reason = extraction.errorMessage ?? "Rejected during extraction";
      await markRawPostStatus(rawPostId, "rejected", reason);
      return {
        rawPostId,
        status: "rejected",
        errorMessage: reason,
        provider: extraction.provider,
      };
    }

    if (extraction.status === "error" || !extraction.data) {
      const message = extraction.errorMessage ?? "Extraction failed";
      await markRawPostStatus(rawPostId, "error", message);
      return {
        rawPostId,
        status: "error",
        errorMessage: message,
        provider: extraction.provider,
      };
    }

    const data = extraction.data;

    const existing = await findExistingJobPostByFingerprint(data);
    if (existing) {
      await markRawPostStatus(rawPostId, "normalized", null);
      return {
        rawPostId,
        status: "normalized",
        jobPostId: existing.id,
        provider: extraction.provider,
      };
    }

    const source = await getSourceById(rawPost.sourceId);
    const score = scoreJob(data, {
      sourcePlatform: source?.platform ?? null,
      sourceTrustLevel: source?.trustLevel ?? null,
      rawText: rawPost.rawText,
    });

    const jobPost = await createJobPostFromExtraction(rawPostId, data);
    await createJobScore(jobPost.id, score, extraction.model ?? null);
    await markRawPostStatus(rawPostId, "normalized", null);

    return {
      rawPostId,
      status: "normalized",
      jobPostId: jobPost.id,
      totalScore: score.totalScore,
      shouldPost: score.shouldPost,
      provider: extraction.provider,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markRawPostStatus(rawPostId, "error", message).catch(() => undefined);
    return { rawPostId, status: "error", errorMessage: message };
  }
}
