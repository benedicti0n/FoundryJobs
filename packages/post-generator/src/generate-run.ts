import { listJobPostsReadyForPostGeneration } from "@foundryjobs/db";
import type { GeneratePostsForJobResult, GeneratePostsRunSummary } from "@foundryjobs/shared";
import { generatePostsForJob } from "./generate-for-job";

export async function generatePostsForReadyJobs(limit = 25): Promise<GeneratePostsRunSummary> {
  const startedAt = new Date();
  const readyJobs = await listJobPostsReadyForPostGeneration(limit);
  const results: GeneratePostsForJobResult[] = [];

  for (const job of readyJobs) {
    results.push(await generatePostsForJob(job.id));
  }

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    processedCount: results.length,
    generatedJobsCount: results.filter((result) => result.status === "generated").length,
    skippedCount: results.filter((result) => result.status === "skipped").length,
    errorCount: results.filter((result) => result.status === "error").length,
    results,
  };
}
