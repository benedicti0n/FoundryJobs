import { and, asc, desc, eq, getTableColumns, notExists, sql, type SQL } from "drizzle-orm";
import {
  isEnvSet,
  isUuid,
  type SourceCategory,
  type GeneratedPostDto,
  type GeneratedPostPlatform,
  type GeneratedPostStatus,
  type SpamRisk,
} from "@foundryjobs/shared";
import { getDatabase, type Database } from "../client";
import { DatabaseNotConfiguredError } from "../errors";
import { generatedPosts, jobPosts, jobScores, rawPosts, sources } from "../schema";
import { toJobPostDto, type JobPostDto, type JobPostRow } from "./job-posts";

const GENERATED_POST_LIST_DEFAULT_LIMIT = 50;
const GENERATED_POST_LIST_MAX_LIMIT = 200;
const GENERATED_DATABASE_ERROR =
  "DATABASE_URL is required for generated post repository operations";

type GeneratedPostRow = typeof generatedPosts.$inferSelect;

export type JobScoreSummary = {
  totalScore: number;
  shouldPost: boolean;
  spamRisk: SpamRisk;
  aiReason: string | null;
};

export type JobPostWithScoreDto = Omit<JobPostDto, "latestScore"> & {
  latestScore: JobScoreSummary | null;
  sourceCategory: SourceCategory | null;
};

export type GeneratedPostListQuery = {
  jobPostId?: string;
  platform?: GeneratedPostPlatform;
  status?: GeneratedPostStatus;
  limit?: number;
  offset?: number;
};

function requireDatabase(): Database {
  if (!isEnvSet("DATABASE_URL")) {
    throw new DatabaseNotConfiguredError(GENERATED_DATABASE_ERROR);
  }
  return getDatabase();
}

export function toGeneratedPostDto(row: GeneratedPostRow): GeneratedPostDto {
  return {
    id: row.id,
    jobPostId: row.jobPostId,
    platform: row.platform as GeneratedPostPlatform,
    formatType: row.formatType,
    textContent: row.textContent,
    imageUrl: row.imageUrl,
    status: row.status as GeneratedPostStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getJobPostWithLatestScore(id: string): Promise<JobPostWithScoreDto | null> {
  const database = requireDatabase();
  if (!isUuid(id)) {
    return null;
  }

  const [row] = await database
    .select({ job: jobPosts, sourceCategory: sources.category })
    .from(jobPosts)
    .leftJoin(rawPosts, eq(rawPosts.id, jobPosts.rawPostId))
    .leftJoin(sources, eq(sources.id, rawPosts.sourceId))
    .where(eq(jobPosts.id, id))
    .limit(1);
  if (!row) {
    return null;
  }

  const [scoreRow] = await database
    .select()
    .from(jobScores)
    .where(eq(jobScores.jobPostId, id))
    .orderBy(desc(jobScores.createdAt))
    .limit(1);

  return {
    ...toJobPostDto(row.job, null),
    sourceCategory: (row.sourceCategory as SourceCategory | null) ?? null,
    latestScore: scoreRow
      ? {
          totalScore: scoreRow.totalScore,
          shouldPost: scoreRow.shouldPost,
          spamRisk: scoreRow.spamRisk as SpamRisk,
          aiReason: scoreRow.aiReason,
        }
      : null,
  };
}

export async function listJobPostsReadyForPostGeneration(
  limit = 25,
): Promise<JobPostWithScoreDto[]> {
  const database = requireDatabase();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), GENERATED_POST_LIST_MAX_LIMIT);

  const latestScores = database
    .selectDistinctOn([jobScores.jobPostId])
    .from(jobScores)
    .orderBy(jobScores.jobPostId, desc(jobScores.createdAt))
    .as("latest_scores");

  const rows = await database
    .select({
      ...getTableColumns(jobPosts),
      sourceCategory: sources.category,
      scoreTotal: latestScores.totalScore,
      scoreShouldPost: latestScores.shouldPost,
      scoreSpamRisk: latestScores.spamRisk,
      scoreAiReason: latestScores.aiReason,
    })
    .from(jobPosts)
    .innerJoin(latestScores, eq(latestScores.jobPostId, jobPosts.id))
    .leftJoin(rawPosts, eq(rawPosts.id, jobPosts.rawPostId))
    .leftJoin(sources, eq(sources.id, rawPosts.sourceId))
    .where(
      and(
        eq(jobPosts.status, "scored"),
        eq(latestScores.shouldPost, true),
        notExists(
          database
            .select({ one: sql`1` })
            .from(generatedPosts)
            .where(eq(generatedPosts.jobPostId, jobPosts.id)),
        ),
      ),
    )
    .orderBy(asc(jobPosts.createdAt))
    .limit(safeLimit);

  return rows.map((row) => ({
    ...toJobPostDto(row as JobPostRow, null),
    sourceCategory: (row.sourceCategory as SourceCategory | null) ?? null,
    latestScore: {
      totalScore: row.scoreTotal,
      shouldPost: row.scoreShouldPost,
      spamRisk: row.scoreSpamRisk as SpamRisk,
      aiReason: row.scoreAiReason,
    },
  }));
}

export type GeneratedPostDraftInput = {
  platform: GeneratedPostPlatform;
  textContent: string;
  imageUrl?: string | null;
};

export async function createGeneratedPostsForJob(
  jobPostId: string,
  drafts: GeneratedPostDraftInput[],
): Promise<GeneratedPostDto[]> {
  const database = requireDatabase();
  if (!isUuid(jobPostId)) {
    throw new Error("Invalid job post id");
  }
  if (drafts.length === 0) {
    return [];
  }

  const rows = await database
    .insert(generatedPosts)
    .values(
      drafts.map((draft) => ({
        jobPostId,
        platform: draft.platform,
        formatType: "single_job",
        textContent: draft.textContent,
        imageUrl: draft.imageUrl ?? null,
        status: "draft" as const,
      })),
    )
    .returning();

  return rows.map(toGeneratedPostDto);
}

export async function listGeneratedPosts(
  query: GeneratedPostListQuery = {},
): Promise<GeneratedPostDto[]> {
  const database = requireDatabase();
  const conditions: SQL[] = [];

  if (query.jobPostId !== undefined) {
    if (!isUuid(query.jobPostId)) {
      return [];
    }
    conditions.push(eq(generatedPosts.jobPostId, query.jobPostId));
  }
  if (query.platform !== undefined) {
    conditions.push(eq(generatedPosts.platform, query.platform));
  }
  if (query.status !== undefined) {
    conditions.push(eq(generatedPosts.status, query.status));
  }

  const limit = Math.min(
    Math.max(query.limit ?? GENERATED_POST_LIST_DEFAULT_LIMIT, 1),
    GENERATED_POST_LIST_MAX_LIMIT,
  );
  const offset = Math.max(query.offset ?? 0, 0);

  const rows = await database
    .select()
    .from(generatedPosts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(generatedPosts.createdAt), desc(generatedPosts.id))
    .limit(limit)
    .offset(offset);

  return rows.map(toGeneratedPostDto);
}

export async function deleteGeneratedPostsForJob(jobPostId: string): Promise<number> {
  const database = requireDatabase();
  if (!isUuid(jobPostId)) {
    return 0;
  }

  const rows = await database
    .delete(generatedPosts)
    .where(eq(generatedPosts.jobPostId, jobPostId))
    .returning({ id: generatedPosts.id });

  return rows.length;
}
