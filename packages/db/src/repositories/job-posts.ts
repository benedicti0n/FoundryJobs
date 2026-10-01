import { and, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import {
  isEnvSet,
  isUuid,
  type EmploymentType,
  type ExtractedJobData,
  type JobScoreBreakdown,
  type JobStatus,
  type SpamRisk,
  type WorkMode,
} from "@foundryjobs/shared";
import { getDatabase, type Database } from "../client";
import { DatabaseNotConfiguredError } from "../errors";
import { jobPosts, jobScores } from "../schema";

const JOB_POST_LIST_DEFAULT_LIMIT = 50;
const JOB_POST_LIST_MAX_LIMIT = 200;
const NORMALIZATION_DATABASE_ERROR =
  "DATABASE_URL is required for normalization repository operations";

export type JobPostRow = typeof jobPosts.$inferSelect;
type JobScoreRow = typeof jobScores.$inferSelect;

export type JobPostListQuery = {
  status?: JobStatus;
  limit?: number;
  offset?: number;
};

export type JobScoreDto = {
  id: string;
  jobPostId: string;
  freshnessScore: number;
  fresherFitScore: number;
  techRelevanceScore: number;
  trustScore: number;
  remoteBonus: number;
  clarityScore: number;
  totalScore: number;
  spamRisk: SpamRisk;
  shouldPost: boolean;
  aiReason: string | null;
  model: string | null;
  createdAt: string;
};

export type JobPostDto = {
  id: string;
  rawPostId: string | null;
  companyName: string | null;
  roleTitle: string;
  roleCategory: string | null;
  location: string | null;
  workMode: WorkMode;
  employmentType: EmploymentType;
  experienceMin: number | null;
  experienceMax: number | null;
  qualification: string | null;
  batchYears: string[];
  skills: string[];
  salaryText: string | null;
  applyUrl: string | null;
  applyEmail: string | null;
  sourceUrl: string | null;
  postedAt: string | null;
  expiresAt: string | null;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  latestScore: JobScoreDto | null;
};

function requireDatabase(): Database {
  if (!isEnvSet("DATABASE_URL")) {
    throw new DatabaseNotConfiguredError(NORMALIZATION_DATABASE_ERROR);
  }
  return getDatabase();
}

function toDateOrNull(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toJobScoreDto(row: JobScoreRow): JobScoreDto {
  return {
    id: row.id,
    jobPostId: row.jobPostId,
    freshnessScore: row.freshnessScore,
    fresherFitScore: row.fresherFitScore,
    techRelevanceScore: row.techRelevanceScore,
    trustScore: row.trustScore,
    remoteBonus: row.remoteBonus,
    clarityScore: row.clarityScore,
    totalScore: row.totalScore,
    spamRisk: row.spamRisk as SpamRisk,
    shouldPost: row.shouldPost,
    aiReason: row.aiReason,
    model: row.model,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toJobPostDto(row: JobPostRow, latestScore?: JobScoreDto | null): JobPostDto {
  return {
    id: row.id,
    rawPostId: row.rawPostId,
    companyName: row.companyName,
    roleTitle: row.roleTitle,
    roleCategory: row.roleCategory,
    location: row.location,
    workMode: row.workMode as WorkMode,
    employmentType: row.employmentType as EmploymentType,
    experienceMin: row.experienceMin,
    experienceMax: row.experienceMax,
    qualification: row.qualification,
    batchYears: row.batchYears,
    skills: row.skills,
    salaryText: row.salaryText,
    applyUrl: row.applyUrl,
    applyEmail: row.applyEmail,
    sourceUrl: row.sourceUrl,
    postedAt: row.postedAt ? row.postedAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    status: row.status as JobStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    latestScore: latestScore ?? null,
  };
}

export async function findExistingJobPostByFingerprint(
  data: ExtractedJobData,
): Promise<JobPostDto | null> {
  const database = requireDatabase();

  const roleTitle = data.roleTitle.trim().toLowerCase();
  if (roleTitle.length === 0) {
    return null;
  }

  const companyName = data.companyName ? data.companyName.trim().toLowerCase() : null;
  const location = data.location ? data.location.trim().toLowerCase() : null;
  const applyUrl = data.applyUrl?.trim() ?? null;
  const applyEmail = data.applyEmail?.trim().toLowerCase() ?? null;

  if (!companyName && !applyUrl && !applyEmail) {
    return null;
  }

  const conditions: SQL[] = [sql`lower(trim(${jobPosts.roleTitle})) = ${roleTitle}`];

  if (companyName) {
    conditions.push(sql`lower(trim(coalesce(${jobPosts.companyName}, ''))) = ${companyName}`);
  }
  if (location) {
    conditions.push(sql`lower(trim(coalesce(${jobPosts.location}, ''))) = ${location}`);
  }
  if (applyUrl || applyEmail) {
    const applyConditions: SQL[] = [];
    if (applyUrl) {
      applyConditions.push(sql`${jobPosts.applyUrl} = ${applyUrl}`);
    }
    if (applyEmail) {
      applyConditions.push(sql`lower(coalesce(${jobPosts.applyEmail}, '')) = ${applyEmail}`);
    }
    const applyCondition = or(...applyConditions);
    if (applyCondition) {
      conditions.push(applyCondition);
    }
  }

  const [row] = await database
    .select()
    .from(jobPosts)
    .where(and(...conditions))
    .orderBy(desc(jobPosts.createdAt))
    .limit(1);

  return row ? toJobPostDto(row) : null;
}

export async function createJobPostFromExtraction(
  rawPostId: string,
  data: ExtractedJobData,
): Promise<JobPostDto> {
  const database = requireDatabase();

  const [row] = await database
    .insert(jobPosts)
    .values({
      rawPostId: isUuid(rawPostId) ? rawPostId : null,
      companyName: data.companyName ?? null,
      roleTitle: data.roleTitle,
      roleCategory: data.roleCategory ?? null,
      location: data.location ?? null,
      workMode: data.workMode,
      employmentType: data.employmentType,
      experienceMin: data.experienceMin ?? null,
      experienceMax: data.experienceMax ?? null,
      qualification: data.qualification ?? null,
      batchYears: data.batchYears,
      skills: data.skills,
      salaryText: data.salaryText ?? null,
      applyUrl: data.applyUrl ?? null,
      applyEmail: data.applyEmail ?? null,
      sourceUrl: data.sourceUrl ?? null,
      postedAt: toDateOrNull(data.postedAt),
      status: "scored",
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create job post");
  }
  return toJobPostDto(row);
}

export async function createJobScore(
  jobPostId: string,
  score: JobScoreBreakdown,
  model?: string | null,
): Promise<JobScoreDto> {
  const database = requireDatabase();

  const [row] = await database
    .insert(jobScores)
    .values({
      jobPostId,
      freshnessScore: score.freshnessScore,
      fresherFitScore: score.fresherFitScore,
      techRelevanceScore: score.techRelevanceScore,
      trustScore: score.trustScore,
      remoteBonus: score.remoteBonus,
      clarityScore: score.clarityScore,
      totalScore: score.totalScore,
      spamRisk: score.spamRisk,
      shouldPost: score.shouldPost,
      aiReason: score.reason,
      model: model ?? null,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create job score");
  }
  return toJobScoreDto(row);
}

export async function listJobPosts(query: JobPostListQuery = {}): Promise<JobPostDto[]> {
  const database = requireDatabase();
  const conditions: SQL[] = [];

  if (query.status !== undefined) {
    conditions.push(eq(jobPosts.status, query.status));
  }

  const limit = Math.min(
    Math.max(query.limit ?? JOB_POST_LIST_DEFAULT_LIMIT, 1),
    JOB_POST_LIST_MAX_LIMIT,
  );
  const offset = Math.max(query.offset ?? 0, 0);

  const rows = await database
    .select()
    .from(jobPosts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(jobPosts.createdAt), desc(jobPosts.id))
    .limit(limit)
    .offset(offset);

  if (rows.length === 0) {
    return [];
  }

  const ids = rows.map((row) => row.id);
  const scoreRows = await database
    .select()
    .from(jobScores)
    .where(inArray(jobScores.jobPostId, ids))
    .orderBy(desc(jobScores.createdAt));

  const latestScores = new Map<string, JobScoreDto>();
  for (const scoreRow of scoreRows) {
    if (!latestScores.has(scoreRow.jobPostId)) {
      latestScores.set(scoreRow.jobPostId, toJobScoreDto(scoreRow));
    }
  }

  return rows.map((row) => toJobPostDto(row, latestScores.get(row.id) ?? null));
}
