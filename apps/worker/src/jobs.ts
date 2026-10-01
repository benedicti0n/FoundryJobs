import { renderInstagramCardsForPendingPosts } from "@foundryjobs/card-renderer";
import { uploadInstagramCardsForPendingPosts } from "@foundryjobs/card-uploader";
import { fetchDueSources } from "@foundryjobs/fetchers";
import { normalizeNewRawPosts } from "@foundryjobs/normalizer";
import { generatePostsForReadyJobs } from "@foundryjobs/post-generator";
import { isEnvSet, type ScheduledJobName, type ScheduledJobResult } from "@foundryjobs/shared";
import { isR2Configured } from "@foundryjobs/storage";

export type JobOutcome = {
  status: "success" | "skipped";
  message: string;
};

async function executeJob(name: ScheduledJobName, limit: number | null): Promise<JobOutcome> {
  switch (name) {
    case "fetch_due_sources": {
      const summary = await fetchDueSources();
      return {
        status: "success",
        message: `sources ${summary.sourceCount} (success ${summary.successCount}, failed ${summary.failedCount}, unsupported ${summary.unsupportedCount}); posts fetched ${summary.totalFetched}, inserted ${summary.totalInserted}, duplicates ${summary.totalDuplicates}`,
      };
    }
    case "normalize_raw_posts": {
      const summary = await normalizeNewRawPosts(limit ?? 25);
      const provider = isEnvSet("GEMINI_API_KEY") ? "gemini" : "rules";
      return {
        status: "success",
        message: `processed ${summary.processedCount} raw posts (normalized ${summary.normalizedCount}, rejected ${summary.rejectedCount}, errors ${summary.errorCount}) using ${provider}`,
      };
    }
    case "generate_posts": {
      const summary = await generatePostsForReadyJobs(limit ?? 25);
      return {
        status: "success",
        message: `processed ${summary.processedCount} jobs (generated ${summary.generatedJobsCount}, skipped ${summary.skippedCount}, errors ${summary.errorCount})`,
      };
    }
    case "render_instagram_cards": {
      const summary = await renderInstagramCardsForPendingPosts(limit ?? 10);
      return {
        status: "success",
        message: `processed ${summary.processedCount} cards (rendered ${summary.renderedCount}, skipped ${summary.skippedCount}, errors ${summary.errorCount})`,
      };
    }
    case "upload_instagram_cards": {
      if (!isR2Configured()) {
        return {
          status: "skipped",
          message: "R2 is not configured; upload skipped",
        };
      }
      const summary = await uploadInstagramCardsForPendingPosts(limit ?? 10);
      return {
        status: "success",
        message: `processed ${summary.processedCount} cards (uploaded ${summary.uploadedCount}, skipped ${summary.skippedCount}, errors ${summary.errorCount})`,
      };
    }
  }
}

export async function runScheduledJob(
  name: ScheduledJobName,
  options: { limit?: number | null } = {},
): Promise<ScheduledJobResult> {
  const startedAt = new Date();

  try {
    const outcome = await executeJob(name, options.limit ?? null);
    const finishedAt = new Date();
    return {
      name,
      status: outcome.status,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      message: outcome.message,
    };
  } catch (error) {
    const finishedAt = new Date();
    return {
      name,
      status: "failed",
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      message: "job failed",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}
