import { and, asc, desc, eq, type SQL } from "drizzle-orm";
import {
  createContentHash,
  isEnvSet,
  isUuid,
  type RawFetchedPost,
  type RawPostStatus,
} from "@foundryjobs/shared";
import { getDatabase, type Database } from "../client";
import { DatabaseNotConfiguredError } from "../errors";
import { rawPosts, sources } from "../schema";

const RAW_POST_LIST_DEFAULT_LIMIT = 50;
const RAW_POST_LIST_MAX_LIMIT = 200;
const FETCH_DATABASE_ERROR = "DATABASE_URL is required for fetch repository operations";

type RawPostRow = typeof rawPosts.$inferSelect;

export type RawPostListQuery = {
  sourceId?: string;
  status?: RawPostStatus;
  limit?: number;
  offset?: number;
};

export type RawPostDto = {
  id: string;
  sourceId: string;
  externalId: string | null;
  rawUrl: string;
  rawTitle: string | null;
  rawText: string;
  rawHtml: string | null;
  contentHash: string;
  status: RawPostStatus;
  errorMessage: string | null;
  postedAt: string | null;
  fetchedAt: string;
};

function requireDatabase(): Database {
  if (!isEnvSet("DATABASE_URL")) {
    throw new DatabaseNotConfiguredError(FETCH_DATABASE_ERROR);
  }
  return getDatabase();
}

function toRawPostDto(row: RawPostRow): RawPostDto {
  return {
    id: row.id,
    sourceId: row.sourceId,
    externalId: row.externalId,
    rawUrl: row.rawUrl,
    rawTitle: row.rawTitle,
    rawText: row.rawText,
    rawHtml: row.rawHtml,
    contentHash: row.contentHash,
    status: row.status as RawPostStatus,
    errorMessage: row.errorMessage,
    postedAt: row.postedAt ? row.postedAt.toISOString() : null,
    fetchedAt: row.fetchedAt.toISOString(),
  };
}

function toDateOrNull(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createRawPostIfNotExists(
  input: RawFetchedPost,
): Promise<{ inserted: boolean; id?: string }> {
  const database = requireDatabase();
  const contentHash = createContentHash(input.rawText);

  try {
    const [row] = await database
      .insert(rawPosts)
      .values({
        sourceId: input.sourceId,
        externalId: input.externalId ?? null,
        rawUrl: input.rawUrl,
        rawTitle: input.rawTitle ?? null,
        rawText: input.rawText,
        rawHtml: input.rawHtml ?? null,
        contentHash,
        postedAt: toDateOrNull(input.postedAt),
      })
      .onConflictDoNothing({ target: rawPosts.contentHash })
      .returning({ id: rawPosts.id });

    if (row) {
      return { inserted: true, id: row.id };
    }
    return { inserted: false };
  } catch (error) {
    throw new Error(
      `Failed to insert raw post for source ${input.sourceId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
}

export async function listRawPosts(query: RawPostListQuery = {}): Promise<RawPostDto[]> {
  const database = requireDatabase();
  const conditions: SQL[] = [];

  if (query.sourceId !== undefined) {
    if (!isUuid(query.sourceId)) {
      return [];
    }
    conditions.push(eq(rawPosts.sourceId, query.sourceId));
  }
  if (query.status !== undefined) {
    conditions.push(eq(rawPosts.status, query.status));
  }

  const limit = Math.min(
    Math.max(query.limit ?? RAW_POST_LIST_DEFAULT_LIMIT, 1),
    RAW_POST_LIST_MAX_LIMIT,
  );
  const offset = Math.max(query.offset ?? 0, 0);

  const rows = await database
    .select()
    .from(rawPosts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(rawPosts.fetchedAt), desc(rawPosts.id))
    .limit(limit)
    .offset(offset);

  return rows.map(toRawPostDto);
}

export async function listNewRawPosts(limit = 25): Promise<RawPostDto[]> {
  const database = requireDatabase();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), RAW_POST_LIST_MAX_LIMIT);

  const rows = await database
    .select()
    .from(rawPosts)
    .where(eq(rawPosts.status, "new"))
    .orderBy(asc(rawPosts.fetchedAt), asc(rawPosts.id))
    .limit(safeLimit);

  return rows.map(toRawPostDto);
}

export async function getRawPostById(id: string): Promise<RawPostDto | null> {
  const database = requireDatabase();
  if (!isUuid(id)) {
    return null;
  }

  const [row] = await database.select().from(rawPosts).where(eq(rawPosts.id, id)).limit(1);
  return row ? toRawPostDto(row) : null;
}

export async function markRawPostStatus(
  id: string,
  status: RawPostStatus,
  errorMessage?: string | null,
): Promise<boolean> {
  const database = requireDatabase();
  if (!isUuid(id)) {
    return false;
  }

  const patch: { status: RawPostStatus; errorMessage?: string | null } = { status };
  if (errorMessage !== undefined) {
    patch.errorMessage = errorMessage;
  }

  const rows = await database
    .update(rawPosts)
    .set(patch)
    .where(eq(rawPosts.id, id))
    .returning({ id: rawPosts.id });

  return rows.length > 0;
}

export async function updateSourceLastFetchedAt(sourceId: string, date: Date): Promise<boolean> {
  const database = requireDatabase();
  if (!isUuid(sourceId)) {
    return false;
  }

  const rows = await database
    .update(sources)
    .set({ lastFetchedAt: date })
    .where(eq(sources.id, sourceId))
    .returning({ id: sources.id });

  return rows.length > 0;
}
