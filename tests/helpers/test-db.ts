import { eq, inArray } from "drizzle-orm";
import type { GeneratedPostPlatform, GeneratedPostStatus } from "@foundryjobs/shared";
import {
  approvals,
  closeDatabase,
  generatedPosts,
  getDatabase,
  jobPosts,
  jobScores,
  publishEvents,
  type GeneratedPostRow,
  type JobPostRow,
} from "@foundryjobs/db";

const DEFAULT_TEST_DATABASE_URL = "postgres://benediction@127.0.0.1:5432/foundryjobs_test";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
const url = new URL(testDatabaseUrl);
const databaseName = url.pathname.replace(/^\//, "");

if (!LOCAL_HOSTS.has(url.hostname)) {
  throw new Error(
    `Refusing to run tests against non-local host ${url.hostname}; tests must never touch remote databases`,
  );
}
if (!/^[a-z0-9_]+$/.test(databaseName) || !databaseName.endsWith("_test")) {
  throw new Error(
    `Refusing to run tests against database "${databaseName}"; test database names must match /^[a-z0-9_]+_test$/`,
  );
}

process.env.DATABASE_URL = testDatabaseUrl;

export const TEST_DATABASE_URL = testDatabaseUrl;

const trackedJobPostIds: string[] = [];

export type FixtureJobInput = {
  roleTitle?: string;
  companyName?: string | null;
  status?: string;
};

export async function createFixtureJob(input: FixtureJobInput = {}): Promise<JobPostRow> {
  const database = getDatabase();
  const [row] = await database
    .insert(jobPosts)
    .values({
      roleTitle: input.roleTitle ?? "Regression Test Role",
      companyName: input.companyName ?? "Test Co",
      status: input.status ?? "scored",
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create fixture job post");
  }

  trackedJobPostIds.push(row.id);
  return row;
}

export type FixturePostInput = {
  jobPostId: string;
  platform: GeneratedPostPlatform;
  status?: GeneratedPostStatus;
  textContent?: string;
  imageUrl?: string | null;
};

export async function createFixturePost(input: FixturePostInput): Promise<GeneratedPostRow> {
  const database = getDatabase();
  const [row] = await database
    .insert(generatedPosts)
    .values({
      jobPostId: input.jobPostId,
      platform: input.platform,
      status: input.status ?? "draft",
      textContent: input.textContent ?? "Regression test post content",
      imageUrl: input.imageUrl ?? null,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create fixture generated post");
  }

  return row;
}

export async function getFixturePost(id: string): Promise<GeneratedPostRow | null> {
  const database = getDatabase();
  const [row] = await database.select().from(generatedPosts).where(eq(generatedPosts.id, id));
  return row ?? null;
}

export async function getFixtureApprovals(jobPostId: string): Promise<{ decision: string }[]> {
  const database = getDatabase();
  return database
    .select({ decision: approvals.decision })
    .from(approvals)
    .where(eq(approvals.jobPostId, jobPostId));
}

export async function getFixturePublishEvents(generatedPostId: string) {
  const database = getDatabase();
  return database
    .select()
    .from(publishEvents)
    .where(eq(publishEvents.generatedPostId, generatedPostId));
}

export async function cleanupFixtures(): Promise<void> {
  if (trackedJobPostIds.length === 0) {
    return;
  }

  const database = getDatabase();
  const jobIds = [...trackedJobPostIds];
  await database.delete(publishEvents).where(inArray(publishEvents.jobPostId, jobIds));
  await database.delete(approvals).where(inArray(approvals.jobPostId, jobIds));
  await database.delete(generatedPosts).where(inArray(generatedPosts.jobPostId, jobIds));
  await database.delete(jobScores).where(inArray(jobScores.jobPostId, jobIds));
  await database.delete(jobPosts).where(inArray(jobPosts.id, jobIds));
  trackedJobPostIds.length = 0;
}

export async function closeTestDatabase(): Promise<void> {
  await cleanupFixtures();
  await closeDatabase();
}
