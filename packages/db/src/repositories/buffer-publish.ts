import { and, asc, eq, inArray, notExists, sql } from "drizzle-orm";
import {
  isEnvSet,
  isUuid,
  type BufferPublishablePostDto,
  type GeneratedPostPlatform,
  type GeneratedPostStatus,
} from "@foundryjobs/shared";
import { getDatabase, type Database } from "../client";
import { DatabaseNotConfiguredError } from "../errors";
import { generatedPosts, jobPosts, publishEvents } from "../schema";

const BUFFER_LIST_DEFAULT_LIMIT = 10;
const BUFFER_LIST_MAX_LIMIT = 200;
const BUFFER_DATABASE_ERROR = "DATABASE_URL is required for Buffer publish repository operations";
const BUFFER_PLATFORMS = ["x", "instagram", "linkedin"] as const;

export type BufferPublishablePost = Omit<BufferPublishablePostDto, "platform"> & {
  platform: GeneratedPostPlatform;
};

function requireDatabase(): Database {
  if (!isEnvSet("DATABASE_URL")) {
    throw new DatabaseNotConfiguredError(BUFFER_DATABASE_ERROR);
  }
  return getDatabase();
}

type BufferRow = {
  generatedPostId: string;
  jobPostId: string;
  platform: string;
  status: string;
  textContent: string;
  imageUrl: string | null;
  companyName: string | null;
  roleTitle: string;
};

function toBufferPublishablePost(row: BufferRow): BufferPublishablePost {
  return {
    generatedPostId: row.generatedPostId,
    jobPostId: row.jobPostId,
    platform: row.platform as GeneratedPostPlatform,
    status: row.status as GeneratedPostStatus,
    textContent: row.textContent,
    imageUrl: row.imageUrl,
    companyName: row.companyName,
    roleTitle: row.roleTitle,
  };
}

function buildSelection(database: Database) {
  return database
    .select({
      generatedPostId: generatedPosts.id,
      jobPostId: generatedPosts.jobPostId,
      platform: generatedPosts.platform,
      status: generatedPosts.status,
      textContent: generatedPosts.textContent,
      imageUrl: generatedPosts.imageUrl,
      companyName: jobPosts.companyName,
      roleTitle: jobPosts.roleTitle,
    })
    .from(generatedPosts)
    .innerJoin(jobPosts, eq(generatedPosts.jobPostId, jobPosts.id));
}

export async function listApprovedBufferPostsReadyToPublish(
  limit = BUFFER_LIST_DEFAULT_LIMIT,
): Promise<BufferPublishablePost[]> {
  const database = requireDatabase();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), BUFFER_LIST_MAX_LIMIT);

  const rows = await buildSelection(database)
    .where(
      and(
        inArray(generatedPosts.platform, [...BUFFER_PLATFORMS]),
        eq(generatedPosts.status, "approved"),
        notExists(
          database
            .select({ one: sql`1` })
            .from(publishEvents)
            .where(
              and(
                eq(publishEvents.generatedPostId, generatedPosts.id),
                eq(publishEvents.status, "success"),
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(generatedPosts.createdAt), asc(generatedPosts.id))
    .limit(safeLimit);

  return rows.map(toBufferPublishablePost);
}

export async function getBufferPublishablePost(
  generatedPostId: string,
): Promise<BufferPublishablePost | null> {
  const database = requireDatabase();
  if (!isUuid(generatedPostId)) {
    return null;
  }

  const [row] = await buildSelection(database)
    .where(eq(generatedPosts.id, generatedPostId))
    .limit(1);

  return row ? toBufferPublishablePost(row) : null;
}
