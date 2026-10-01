import {
  createGeneratedPostsForJob,
  deleteGeneratedPostsForJob,
  getJobPostWithLatestScore,
  listGeneratedPosts,
} from "@foundryjobs/db";
import type { GeneratePostsForJobResult } from "@foundryjobs/shared";
import { generatePlatformDrafts } from "./templates";

export type GeneratePostsForJobOptions = {
  regenerate?: boolean;
};

export async function generatePostsForJob(
  jobPostId: string,
  options: GeneratePostsForJobOptions = {},
): Promise<GeneratePostsForJobResult> {
  try {
    const job = await getJobPostWithLatestScore(jobPostId);
    if (!job) {
      return {
        jobPostId,
        status: "error",
        generatedCount: 0,
        errorMessage: "Job post not found",
      };
    }

    if (!job.latestScore) {
      return {
        jobPostId,
        status: "skipped",
        generatedCount: 0,
        skippedReason: "Job post has no score yet",
      };
    }
    if (!job.latestScore.shouldPost) {
      return {
        jobPostId,
        status: "skipped",
        generatedCount: 0,
        skippedReason: `Job post is not flagged for posting (totalScore ${job.latestScore.totalScore})`,
      };
    }
    if (job.status !== "scored") {
      return {
        jobPostId,
        status: "skipped",
        generatedCount: 0,
        skippedReason: `Job post status is ${job.status}`,
      };
    }

    const existing = await listGeneratedPosts({ jobPostId, limit: 1 });
    if (existing.length > 0) {
      if (!options.regenerate) {
        return {
          jobPostId,
          status: "skipped",
          generatedCount: 0,
          skippedReason: "Generated posts already exist for this job",
        };
      }
      await deleteGeneratedPostsForJob(jobPostId);
    }

    const drafts = generatePlatformDrafts(job);
    const created = await createGeneratedPostsForJob(jobPostId, drafts);

    return { jobPostId, status: "generated", generatedCount: created.length };
  } catch (error) {
    return {
      jobPostId,
      status: "error",
      generatedCount: 0,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}
