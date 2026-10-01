import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  isEnvSet,
  isUuid,
  type EmploymentType,
  type GeneratedPostDto,
  type GeneratedPostPlatform,
  type GeneratedPostStatus,
  type RenderableInstagramPostDto,
  type WorkMode,
} from "@foundryjobs/shared";
import { getDatabase, type Database } from "../client";
import { DatabaseNotConfiguredError } from "../errors";
import { generatedPosts, jobPosts, jobScores } from "../schema";
import { toGeneratedPostDto } from "./generated-posts";

const CARD_LIST_DEFAULT_LIMIT = 10;
const CARD_LIST_MAX_LIMIT = 200;
const CARD_DATABASE_ERROR = "DATABASE_URL is required for Instagram card repository operations";

function requireDatabase(): Database {
  if (!isEnvSet("DATABASE_URL")) {
    throw new DatabaseNotConfiguredError(CARD_DATABASE_ERROR);
  }
  return getDatabase();
}

export type RenderableInstagramPost = RenderableInstagramPostDto & {
  platform: GeneratedPostPlatform;
};

type RenderableRow = {
  generatedPostId: string;
  jobPostId: string;
  textContent: string;
  imageUrl: string | null;
  platform: string;
  generatedPostStatus: string;
  companyName: string | null;
  roleTitle: string;
  location: string | null;
  workMode: string;
  employmentType: string;
  experienceMin: number | null;
  experienceMax: number | null;
  skills: string[];
  salaryText: string | null;
  scoreTotal: number | null;
  scoreShouldPost: boolean | null;
};

function toRenderableDto(row: RenderableRow): RenderableInstagramPost {
  return {
    generatedPostId: row.generatedPostId,
    jobPostId: row.jobPostId,
    textContent: row.textContent,
    imageUrl: row.imageUrl,
    platform: row.platform as GeneratedPostPlatform,
    generatedPostStatus: row.generatedPostStatus as GeneratedPostStatus,
    companyName: row.companyName,
    roleTitle: row.roleTitle,
    location: row.location,
    workMode: row.workMode as WorkMode,
    employmentType: row.employmentType as EmploymentType,
    experienceMin: row.experienceMin,
    experienceMax: row.experienceMax,
    skills: row.skills,
    salaryText: row.salaryText,
    totalScore: row.scoreTotal ?? null,
    shouldPost: row.scoreShouldPost ?? null,
  };
}

function buildRenderableSelection(database: Database) {
  const latestScores = database
    .selectDistinctOn([jobScores.jobPostId])
    .from(jobScores)
    .orderBy(jobScores.jobPostId, desc(jobScores.createdAt))
    .as("latest_scores");

  return database
    .select({
      generatedPostId: generatedPosts.id,
      jobPostId: generatedPosts.jobPostId,
      textContent: generatedPosts.textContent,
      imageUrl: generatedPosts.imageUrl,
      platform: generatedPosts.platform,
      generatedPostStatus: generatedPosts.status,
      companyName: jobPosts.companyName,
      roleTitle: jobPosts.roleTitle,
      location: jobPosts.location,
      workMode: jobPosts.workMode,
      employmentType: jobPosts.employmentType,
      experienceMin: jobPosts.experienceMin,
      experienceMax: jobPosts.experienceMax,
      skills: jobPosts.skills,
      salaryText: jobPosts.salaryText,
      scoreTotal: latestScores.totalScore,
      scoreShouldPost: latestScores.shouldPost,
    })
    .from(generatedPosts)
    .innerJoin(jobPosts, eq(generatedPosts.jobPostId, jobPosts.id))
    .leftJoin(latestScores, eq(latestScores.jobPostId, jobPosts.id));
}

export async function listInstagramPostsNeedingCards(
  limit = CARD_LIST_DEFAULT_LIMIT,
): Promise<RenderableInstagramPost[]> {
  const database = requireDatabase();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), CARD_LIST_MAX_LIMIT);

  const rows = await buildRenderableSelection(database)
    .where(
      and(
        eq(generatedPosts.platform, "instagram"),
        isNull(generatedPosts.imageUrl),
        inArray(generatedPosts.status, ["draft", "approved"]),
      ),
    )
    .orderBy(asc(generatedPosts.createdAt), asc(generatedPosts.id))
    .limit(safeLimit);

  return rows.map(toRenderableDto);
}

export async function getRenderableInstagramPost(
  generatedPostId: string,
): Promise<RenderableInstagramPost | null> {
  const database = requireDatabase();
  if (!isUuid(generatedPostId)) {
    return null;
  }

  const [row] = await buildRenderableSelection(database)
    .where(eq(generatedPosts.id, generatedPostId))
    .limit(1);

  return row ? toRenderableDto(row) : null;
}

export async function updateGeneratedPostImageUrl(
  generatedPostId: string,
  imageUrl: string,
): Promise<GeneratedPostDto | null> {
  const database = requireDatabase();
  if (!isUuid(generatedPostId)) {
    return null;
  }

  const [row] = await database
    .update(generatedPosts)
    .set({ imageUrl, updatedAt: new Date() })
    .where(eq(generatedPosts.id, generatedPostId))
    .returning();

  return row ? toGeneratedPostDto(row) : null;
}
