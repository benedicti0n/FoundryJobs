import { desc, eq, getTableColumns, sql } from "drizzle-orm";
import {
  getDatabase,
  jobPosts,
  jobScores,
  publishEvents,
  rawPosts,
  sources,
} from "@foundryjobs/db";
import { SELECTION_CONFIG } from "./config";
import type { CandidateJob } from "./types";

export async function loadCandidates(): Promise<CandidateJob[]> {
  const database = getDatabase();
  const latestScores = database
    .selectDistinctOn([jobScores.jobPostId])
    .from(jobScores)
    .orderBy(jobScores.jobPostId, desc(jobScores.createdAt))
    .as("latest_scores");

  const rows = await database
    .select({
      job: getTableColumns(jobPosts),
      score: {
        totalScore: latestScores.totalScore,
        techRelevanceScore: latestScores.techRelevanceScore,
        freshnessScore: latestScores.freshnessScore,
        spamRisk: latestScores.spamRisk,
        shouldPost: latestScores.shouldPost,
      },
      source: {
        id: sources.id,
        name: sources.name,
        platform: sources.platform,
        category: sources.category,
        region: sources.region,
        priority: sources.priority,
        trustLevel: sources.trustLevel,
        isActive: sources.isActive,
      },
    })
    .from(jobPosts)
    .leftJoin(latestScores, eq(latestScores.jobPostId, jobPosts.id))
    .leftJoin(rawPosts, eq(rawPosts.id, jobPosts.rawPostId))
    .leftJoin(sources, eq(sources.id, rawPosts.sourceId))
    .where(eq(jobPosts.status, "scored"))
    .limit(2000);

  const since = new Date(Date.now() - SELECTION_CONFIG.repostExclusionDays * 86_400_000);
  const publishedRows = await database
    .select({ jobPostId: publishEvents.jobPostId })
    .from(publishEvents)
    .where(
      sql`${publishEvents.status} = 'success' and ${publishEvents.jobPostId} is not null and ${publishEvents.createdAt} >= ${since.toISOString()}::timestamptz`,
    );
  const publishedJobIds = new Set(publishedRows.map((row) => row.jobPostId));

  return rows
    .filter((row) => !row.source || row.source.isActive !== false)
    .map((row) => ({
      jobPostId: row.job.id,
      companyName: row.job.companyName,
      roleTitle: row.job.roleTitle,
      roleCategory: row.job.roleCategory,
      location: row.job.location,
      workMode: row.job.workMode,
      employmentType: row.job.employmentType,
      experienceMin: row.job.experienceMin,
      experienceMax: row.job.experienceMax,
      qualification: row.job.qualification,
      batchYears: row.job.batchYears,
      skills: row.job.skills,
      salaryText: row.job.salaryText,
      applyUrl: row.job.applyUrl,
      postedAt: row.job.postedAt ? row.job.postedAt.toISOString() : null,
      createdAt: row.job.createdAt.toISOString(),
      sourceId: row.source?.id ?? null,
      sourceName: row.source?.name ?? null,
      sourcePlatform: (row.source?.platform ?? null) as CandidateJob["sourcePlatform"],
      sourceCategory: (row.source?.category ?? null) as CandidateJob["sourceCategory"],
      sourceRegion: (row.source?.region ?? null) as CandidateJob["sourceRegion"],
      sourcePriority: (row.source?.priority ?? null) as CandidateJob["sourcePriority"],
      sourceTrustLevel: row.source?.trustLevel ?? null,
      legacyScore: row.score
        ? {
            totalScore: row.score.totalScore,
            techRelevanceScore: row.score.techRelevanceScore,
            freshnessScore: row.score.freshnessScore,
            spamRisk: row.score.spamRisk,
            shouldPost: row.score.shouldPost,
          }
        : null,
      recentlyPublished: publishedJobIds.has(row.job.id),
    }));
}
