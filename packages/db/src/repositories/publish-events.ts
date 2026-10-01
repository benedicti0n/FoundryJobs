import { and, asc, desc, eq, notExists, sql, type SQL } from "drizzle-orm";
import {
  isEnvSet,
  isUuid,
  type CreatePublishEventInput,
  type GeneratedPostStatus,
  type PublishableGeneratedPostDto,
  type PublishEventDto,
  type PublishPlatform,
  type PublishStatus,
} from "@foundryjobs/shared";
import { getDatabase, type Database } from "../client";
import { DatabaseNotConfiguredError } from "../errors";
import { generatedPosts, publishEvents } from "../schema";

const PUBLISH_EVENT_LIST_DEFAULT_LIMIT = 50;
const PUBLISH_EVENT_LIST_MAX_LIMIT = 200;
const PUBLISH_READY_DEFAULT_LIMIT = 10;
const PUBLISH_DATABASE_ERROR = "DATABASE_URL is required for publish repository operations";

type GeneratedPostRow = typeof generatedPosts.$inferSelect;
type PublishEventRow = typeof publishEvents.$inferSelect;

export type PublishEventListQuery = {
  platform?: PublishPlatform;
  status?: PublishStatus;
  generatedPostId?: string;
  jobPostId?: string;
  limit?: number;
  offset?: number;
};

export type RecordPublishSuccessInput = {
  platform: PublishPlatform;
  jobPostId: string;
  generatedPostId: string;
  externalPostId?: string | null;
  publishedUrl?: string | null;
};

export type RecordPublishFailureInput = {
  platform: PublishPlatform;
  jobPostId: string;
  generatedPostId: string;
  errorMessage: string;
};

function requireDatabase(): Database {
  if (!isEnvSet("DATABASE_URL")) {
    throw new DatabaseNotConfiguredError(PUBLISH_DATABASE_ERROR);
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

function toPublishableGeneratedPostDto(row: GeneratedPostRow): PublishableGeneratedPostDto {
  return {
    generatedPostId: row.id,
    jobPostId: row.jobPostId,
    platform: row.platform as PublishPlatform,
    formatType: row.formatType,
    status: row.status as GeneratedPostStatus,
    textContent: row.textContent,
    imageUrl: row.imageUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPublishEventDto(row: PublishEventRow): PublishEventDto {
  return {
    id: row.id,
    jobPostId: row.jobPostId,
    generatedPostId: row.generatedPostId,
    platform: row.platform as PublishPlatform,
    externalPostId: row.externalPostId,
    publishedUrl: row.publishedUrl,
    status: row.status as PublishStatus,
    errorMessage: row.errorMessage,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getPublishableGeneratedPost(
  id: string,
): Promise<PublishableGeneratedPostDto | null> {
  const database = requireDatabase();
  if (!isUuid(id)) {
    return null;
  }

  const [row] = await database
    .select()
    .from(generatedPosts)
    .where(eq(generatedPosts.id, id))
    .limit(1);

  return row ? toPublishableGeneratedPostDto(row) : null;
}

export async function listApprovedTelegramPostsReadyToPublish(
  limit = PUBLISH_READY_DEFAULT_LIMIT,
): Promise<PublishableGeneratedPostDto[]> {
  const database = requireDatabase();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), PUBLISH_EVENT_LIST_MAX_LIMIT);

  const rows = await database
    .select()
    .from(generatedPosts)
    .where(
      and(
        eq(generatedPosts.platform, "telegram"),
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
    .orderBy(asc(generatedPosts.updatedAt), asc(generatedPosts.id))
    .limit(safeLimit);

  return rows.map(toPublishableGeneratedPostDto);
}

export async function hasSuccessfulPublishEvent(generatedPostId: string): Promise<boolean> {
  const database = requireDatabase();
  if (!isUuid(generatedPostId)) {
    return false;
  }

  const [row] = await database
    .select({ id: publishEvents.id })
    .from(publishEvents)
    .where(
      and(eq(publishEvents.generatedPostId, generatedPostId), eq(publishEvents.status, "success")),
    )
    .limit(1);

  return Boolean(row);
}

export async function createPublishEvent(input: CreatePublishEventInput): Promise<PublishEventDto> {
  const database = requireDatabase();

  const [row] = await database
    .insert(publishEvents)
    .values({
      jobPostId: input.jobPostId,
      generatedPostId: input.generatedPostId,
      platform: input.platform,
      externalPostId: input.externalPostId ?? null,
      publishedUrl: input.publishedUrl ?? null,
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      publishedAt: toDateOrNull(input.publishedAt),
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create publish event");
  }
  return toPublishEventDto(row);
}

export async function markGeneratedPostPublished(generatedPostId: string): Promise<void> {
  const database = requireDatabase();
  if (!isUuid(generatedPostId)) {
    return;
  }

  await database
    .update(generatedPosts)
    .set({ status: "published", updatedAt: new Date() })
    .where(eq(generatedPosts.id, generatedPostId));
}

export async function markGeneratedPostFailed(generatedPostId: string): Promise<void> {
  const database = requireDatabase();
  if (!isUuid(generatedPostId)) {
    return;
  }

  await database
    .update(generatedPosts)
    .set({ status: "failed", updatedAt: new Date() })
    .where(eq(generatedPosts.id, generatedPostId));
}

export async function recordPublishSuccess(
  input: RecordPublishSuccessInput,
): Promise<PublishEventDto> {
  const database = requireDatabase();
  const now = new Date();

  const event = await database.transaction(async (tx) => {
    const [row] = await tx
      .insert(publishEvents)
      .values({
        jobPostId: input.jobPostId,
        generatedPostId: input.generatedPostId,
        platform: input.platform,
        externalPostId: input.externalPostId ?? null,
        publishedUrl: input.publishedUrl ?? null,
        status: "success",
        errorMessage: null,
        publishedAt: now,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to record publish event");
    }

    await tx
      .update(generatedPosts)
      .set({ status: "published", updatedAt: now })
      .where(eq(generatedPosts.id, input.generatedPostId));

    return row;
  });

  return toPublishEventDto(event);
}

export async function recordPublishFailure(
  input: RecordPublishFailureInput,
): Promise<PublishEventDto> {
  const database = requireDatabase();
  const now = new Date();

  const event = await database.transaction(async (tx) => {
    const [row] = await tx
      .insert(publishEvents)
      .values({
        jobPostId: input.jobPostId,
        generatedPostId: input.generatedPostId,
        platform: input.platform,
        externalPostId: null,
        publishedUrl: null,
        status: "failed",
        errorMessage: input.errorMessage,
        publishedAt: null,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to record publish event");
    }

    await tx
      .update(generatedPosts)
      .set({ status: "failed", updatedAt: now })
      .where(eq(generatedPosts.id, input.generatedPostId));

    return row;
  });

  return toPublishEventDto(event);
}

export async function listPublishEvents(
  query: PublishEventListQuery = {},
): Promise<PublishEventDto[]> {
  const database = requireDatabase();
  const conditions: SQL[] = [];

  if (query.platform !== undefined) {
    conditions.push(eq(publishEvents.platform, query.platform));
  }
  if (query.status !== undefined) {
    conditions.push(eq(publishEvents.status, query.status));
  }
  if (query.generatedPostId !== undefined) {
    if (!isUuid(query.generatedPostId)) {
      return [];
    }
    conditions.push(eq(publishEvents.generatedPostId, query.generatedPostId));
  }
  if (query.jobPostId !== undefined) {
    if (!isUuid(query.jobPostId)) {
      return [];
    }
    conditions.push(eq(publishEvents.jobPostId, query.jobPostId));
  }

  const limit = Math.min(
    Math.max(query.limit ?? PUBLISH_EVENT_LIST_DEFAULT_LIMIT, 1),
    PUBLISH_EVENT_LIST_MAX_LIMIT,
  );
  const offset = Math.max(query.offset ?? 0, 0);

  const rows = await database
    .select()
    .from(publishEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(publishEvents.createdAt), desc(publishEvents.id))
    .limit(limit)
    .offset(offset);

  return rows.map(toPublishEventDto);
}
