import { and, asc, desc, eq, ilike, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import {
  isUuid,
  isEnvSet,
  SOURCE_DEFAULTS,
  SOURCE_LIST_DEFAULT_LIMIT,
  SOURCE_LIST_MAX_LIMIT,
  validateCreateSourceInput,
  validateUpdateSourceInput,
  type CreateSourceInput,
  type SourceDto,
  type SourceListQuery,
  type SourcePlatform,
  type SourceType,
  type UpdateSourceInput,
} from "@foundryjobs/shared";
import { getDatabase, type Database } from "../client";
import { DatabaseNotConfiguredError, SourceConflictError } from "../errors";
import { sources } from "../schema";

type SourceRow = typeof sources.$inferSelect;
type SourceInsert = typeof sources.$inferInsert;

function requireDatabase(
  message = "DATABASE_URL is required for source repository operations",
): Database {
  if (!isEnvSet("DATABASE_URL")) {
    throw new DatabaseNotConfiguredError(message);
  }
  return getDatabase();
}

function toSourceDto(row: SourceRow): SourceDto {
  return {
    id: row.id,
    name: row.name,
    type: row.type as SourceType,
    platform: row.platform as SourcePlatform | null,
    url: row.url,
    atsType: row.atsType,
    trustLevel: row.trustLevel,
    fetchIntervalMinutes: row.fetchIntervalMinutes,
    isActive: row.isActive,
    lastFetchedAt: row.lastFetchedAt ? row.lastFetchedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function hasPostgresCode(value: unknown, code: string): boolean {
  if (typeof value !== "object" || value === null || !("code" in value)) {
    return false;
  }
  return (value as { code?: unknown }).code === code;
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (hasPostgresCode(current, "23505")) {
      return true;
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
}

function rethrowSourceError(error: unknown): never {
  if (isUniqueViolation(error)) {
    throw new SourceConflictError();
  }
  throw error;
}

function normalizeCreateInput(input: CreateSourceInput): CreateSourceInput {
  const result = validateCreateSourceInput(input);
  if (!result.ok) {
    throw new Error(`Invalid source input: ${result.errors.join("; ")}`);
  }
  return result.data;
}

function normalizeUpdateInput(input: UpdateSourceInput): UpdateSourceInput {
  const result = validateUpdateSourceInput(input);
  if (!result.ok) {
    throw new Error(`Invalid source input: ${result.errors.join("; ")}`);
  }
  return result.data;
}

function toInsertValues(input: CreateSourceInput): SourceInsert {
  return {
    name: input.name,
    type: input.type,
    platform: input.platform ?? null,
    url: input.url,
    atsType: input.atsType ?? null,
    trustLevel: input.trustLevel ?? SOURCE_DEFAULTS.trustLevel,
    fetchIntervalMinutes: input.fetchIntervalMinutes ?? SOURCE_DEFAULTS.fetchIntervalMinutes,
    isActive: input.isActive ?? SOURCE_DEFAULTS.isActive,
  };
}

export async function listSources(query: SourceListQuery = {}): Promise<SourceDto[]> {
  const database = requireDatabase();
  const conditions: SQL[] = [];

  if (query.type !== undefined) {
    conditions.push(eq(sources.type, query.type));
  }
  if (query.platform !== undefined) {
    conditions.push(eq(sources.platform, query.platform));
  }
  if (query.isActive !== undefined) {
    conditions.push(eq(sources.isActive, query.isActive));
  }
  if (query.search !== undefined) {
    const pattern = `%${escapeLikePattern(query.search)}%`;
    const searchCondition = or(ilike(sources.name, pattern), ilike(sources.url, pattern));
    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  const limit = Math.min(
    Math.max(query.limit ?? SOURCE_LIST_DEFAULT_LIMIT, 1),
    SOURCE_LIST_MAX_LIMIT,
  );
  const offset = Math.max(query.offset ?? 0, 0);

  const rows = await database
    .select()
    .from(sources)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sources.createdAt), desc(sources.id))
    .limit(limit)
    .offset(offset);

  return rows.map(toSourceDto);
}

export async function listActiveSourcesDueForFetch(now: Date): Promise<SourceDto[]> {
  const database = requireDatabase("DATABASE_URL is required for fetch repository operations");

  const nowIso = now.toISOString();
  const dueCondition = or(
    isNull(sources.lastFetchedAt),
    lte(
      sources.lastFetchedAt,
      sql`${nowIso}::timestamptz - (${sources.fetchIntervalMinutes} * interval '1 minute')`,
    ),
  );

  const rows = await database
    .select()
    .from(sources)
    .where(and(eq(sources.isActive, true), dueCondition))
    .orderBy(sql`${sources.lastFetchedAt} asc nulls first`, asc(sources.createdAt));

  return rows.map(toSourceDto);
}

export async function getSourceById(id: string): Promise<SourceDto | null> {
  const database = requireDatabase();
  if (!isUuid(id)) {
    return null;
  }

  const [row] = await database.select().from(sources).where(eq(sources.id, id)).limit(1);
  return row ? toSourceDto(row) : null;
}

export async function createSource(input: CreateSourceInput): Promise<SourceDto> {
  const database = requireDatabase();
  const values = toInsertValues(normalizeCreateInput(input));

  try {
    const [row] = await database.insert(sources).values(values).returning();
    if (!row) {
      throw new Error("Failed to create source");
    }
    return toSourceDto(row);
  } catch (error) {
    rethrowSourceError(error);
  }
}

export async function updateSource(
  id: string,
  input: UpdateSourceInput,
): Promise<SourceDto | null> {
  const database = requireDatabase();
  if (!isUuid(id)) {
    return null;
  }
  const data = normalizeUpdateInput(input);

  const patch: Partial<SourceInsert> = { updatedAt: new Date() };
  if (data.name !== undefined) {
    patch.name = data.name;
  }
  if (data.type !== undefined) {
    patch.type = data.type;
  }
  if (data.platform !== undefined) {
    patch.platform = data.platform;
  }
  if (data.url !== undefined) {
    patch.url = data.url;
  }
  if (data.atsType !== undefined) {
    patch.atsType = data.atsType;
  }
  if (data.trustLevel !== undefined) {
    patch.trustLevel = data.trustLevel;
  }
  if (data.fetchIntervalMinutes !== undefined) {
    patch.fetchIntervalMinutes = data.fetchIntervalMinutes;
  }
  if (data.isActive !== undefined) {
    patch.isActive = data.isActive;
  }

  try {
    const [row] = await database.update(sources).set(patch).where(eq(sources.id, id)).returning();
    return row ? toSourceDto(row) : null;
  } catch (error) {
    rethrowSourceError(error);
  }
}

export async function setSourceActive(id: string, isActive: boolean): Promise<SourceDto | null> {
  const database = requireDatabase();
  if (!isUuid(id)) {
    return null;
  }

  const [row] = await database
    .update(sources)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(sources.id, id))
    .returning();

  return row ? toSourceDto(row) : null;
}

export async function deleteSource(id: string): Promise<boolean> {
  const database = requireDatabase();
  if (!isUuid(id)) {
    return false;
  }

  const rows = await database
    .delete(sources)
    .where(eq(sources.id, id))
    .returning({ id: sources.id });

  return rows.length > 0;
}
