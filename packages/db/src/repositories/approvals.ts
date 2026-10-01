import { and, asc, desc, eq, getTableColumns, type SQL } from "drizzle-orm";
import {
  isEnvSet,
  isUuid,
  type ApprovalActionInput,
  type ApprovalActionResult,
  type ApprovalQueueItemDto,
  type ApprovalQueueQuery,
  type EmploymentType,
  type GeneratedPostDto,
  type GeneratedPostPlatform,
  type GeneratedPostStatus,
  type SpamRisk,
  type WorkMode,
} from "@foundryjobs/shared";
import { getDatabase, type Database } from "../client";
import { DatabaseNotConfiguredError } from "../errors";
import { approvals, generatedPosts, jobPosts, jobScores } from "../schema";
import { toGeneratedPostDto } from "./generated-posts";

const APPROVAL_QUEUE_DEFAULT_LIMIT = 50;
const APPROVAL_QUEUE_MAX_LIMIT = 200;
const APPROVAL_DATABASE_ERROR = "DATABASE_URL is required for approval repository operations";

function requireDatabase(): Database {
  if (!isEnvSet("DATABASE_URL")) {
    throw new DatabaseNotConfiguredError(APPROVAL_DATABASE_ERROR);
  }
  return getDatabase();
}

export async function getGeneratedPostById(id: string): Promise<GeneratedPostDto | null> {
  const database = requireDatabase();
  if (!isUuid(id)) {
    return null;
  }

  const [row] = await database
    .select()
    .from(generatedPosts)
    .where(eq(generatedPosts.id, id))
    .limit(1);

  return row ? toGeneratedPostDto(row) : null;
}

export async function updateGeneratedPostText(
  id: string,
  textContent: string,
): Promise<GeneratedPostDto | null> {
  const database = requireDatabase();
  if (!isUuid(id)) {
    return null;
  }

  const trimmed = textContent.trim();
  if (trimmed.length === 0) {
    throw new Error("textContent must not be empty");
  }

  const [row] = await database
    .update(generatedPosts)
    .set({ textContent: trimmed, updatedAt: new Date() })
    .where(eq(generatedPosts.id, id))
    .returning();

  return row ? toGeneratedPostDto(row) : null;
}

export async function listApprovalQueue(
  query: ApprovalQueueQuery = {},
): Promise<ApprovalQueueItemDto[]> {
  const database = requireDatabase();
  const conditions: SQL[] = [];

  const status = query.status ?? "draft";
  conditions.push(eq(generatedPosts.status, status));

  if (query.platform !== undefined) {
    conditions.push(eq(generatedPosts.platform, query.platform));
  }

  const limit = Math.min(
    Math.max(query.limit ?? APPROVAL_QUEUE_DEFAULT_LIMIT, 1),
    APPROVAL_QUEUE_MAX_LIMIT,
  );
  const offset = Math.max(query.offset ?? 0, 0);

  const latestScores = database
    .selectDistinctOn([jobScores.jobPostId])
    .from(jobScores)
    .orderBy(jobScores.jobPostId, desc(jobScores.createdAt))
    .as("latest_scores");

  const rows = await database
    .select({
      ...getTableColumns(generatedPosts),
      companyName: jobPosts.companyName,
      roleTitle: jobPosts.roleTitle,
      location: jobPosts.location,
      workMode: jobPosts.workMode,
      employmentType: jobPosts.employmentType,
      experienceMin: jobPosts.experienceMin,
      experienceMax: jobPosts.experienceMax,
      scoreTotal: latestScores.totalScore,
      scoreShouldPost: latestScores.shouldPost,
      scoreSpamRisk: latestScores.spamRisk,
      scoreAiReason: latestScores.aiReason,
    })
    .from(generatedPosts)
    .innerJoin(jobPosts, eq(generatedPosts.jobPostId, jobPosts.id))
    .leftJoin(latestScores, eq(latestScores.jobPostId, jobPosts.id))
    .where(and(...conditions))
    .orderBy(asc(generatedPosts.createdAt), asc(generatedPosts.id))
    .limit(limit)
    .offset(offset);

  return rows.map((row) => ({
    generatedPostId: row.id,
    jobPostId: row.jobPostId,
    platform: row.platform as GeneratedPostPlatform,
    formatType: row.formatType,
    textContent: row.textContent,
    imageUrl: row.imageUrl,
    generatedPostStatus: row.status as GeneratedPostStatus,
    companyName: row.companyName,
    roleTitle: row.roleTitle,
    location: row.location,
    workMode: row.workMode as WorkMode,
    employmentType: row.employmentType as EmploymentType,
    experienceMin: row.experienceMin,
    experienceMax: row.experienceMax,
    totalScore: row.scoreTotal ?? null,
    shouldPost: row.scoreShouldPost ?? null,
    spamRisk: (row.scoreSpamRisk as SpamRisk | null) ?? null,
    aiReason: row.scoreAiReason ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function applyApprovalAction(
  generatedPostId: string,
  input: ApprovalActionInput,
): Promise<ApprovalActionResult | null> {
  const database = requireDatabase();
  if (!isUuid(generatedPostId)) {
    return null;
  }

  const [existing] = await database
    .select()
    .from(generatedPosts)
    .where(eq(generatedPosts.id, generatedPostId))
    .limit(1);
  if (!existing) {
    return null;
  }

  if (
    input.textContent !== undefined &&
    input.textContent !== null &&
    input.textContent.trim().length === 0
  ) {
    throw new Error("textContent must not be empty");
  }

  const nextText = input.textContent?.trim() ?? existing.textContent;
  if (input.decision === "approved" && nextText.trim().length === 0) {
    throw new Error("Cannot approve a generated post with empty text");
  }

  const nextStatus: GeneratedPostStatus =
    input.decision === "approved"
      ? "approved"
      : input.decision === "rejected"
        ? "rejected"
        : "draft";

  const result = await database.transaction(async (tx) => {
    const [updated] = await tx
      .update(generatedPosts)
      .set({ textContent: nextText, status: nextStatus, updatedAt: new Date() })
      .where(eq(generatedPosts.id, generatedPostId))
      .returning();

    if (!updated) {
      return null;
    }

    const [approval] = await tx
      .insert(approvals)
      .values({
        jobPostId: existing.jobPostId,
        decision: input.decision,
        notes: input.notes ?? null,
        decidedBy: input.decidedBy ?? null,
      })
      .returning();

    if (!approval) {
      throw new Error("Failed to record approval");
    }

    return { updated, approval };
  });

  if (!result) {
    return null;
  }

  return {
    generatedPostId: result.updated.id,
    jobPostId: result.updated.jobPostId,
    platform: result.updated.platform as GeneratedPostPlatform,
    decision: input.decision,
    generatedPostStatus: result.updated.status as GeneratedPostStatus,
    approvalId: result.approval.id,
    textContent: result.updated.textContent,
  };
}
