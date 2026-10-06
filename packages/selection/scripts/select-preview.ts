import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { desc, eq, getTableColumns, sql } from "drizzle-orm";
import {
  closeDatabase,
  getDatabase,
  jobPosts,
  jobScores,
  publishEvents,
  rawPosts,
  sources,
} from "@foundryjobs/db";
import { runSelection, SELECTION_CONFIG, withSelectionConfig } from "../src/index";
import type { CandidateJob } from "../src/types";

const DEV_DATABASE_URL = "postgres://benediction@127.0.0.1:5432/foundryjobs_dev";
const TEST_DATABASE_URL = "postgres://benediction@127.0.0.1:5432/foundryjobs_test";

const args = process.argv.slice(2);
const envArg = args.find((arg) => arg.startsWith("--env="))?.slice("--env=".length) ?? "dev";
const limitArg = args.find((arg) => arg.startsWith("--limit="))?.slice("--limit=".length);
const asJson = args.includes("--json");

if (!["dev", "test", "production"].includes(envArg)) {
  console.error("Usage: pnpm jobs:select --env=dev|test|production [--limit=10] [--json]");
  process.exit(1);
}

if (envArg === "dev") {
  process.env.DATABASE_URL = DEV_DATABASE_URL;
} else if (envArg === "test") {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
} else {
  const rootEnvPath = fileURLToPath(new URL("../../../../.env", import.meta.url));
  if (existsSync(rootEnvPath) && !process.env.DATABASE_URL) {
    process.loadEnvFile(rootEnvPath);
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || /localhost|127\.0\.0\.1/.test(databaseUrl)) {
    console.error("Production preview requires a non-local DATABASE_URL.");
    process.exit(1);
  }
  console.log("target=production (read-only preview)");
}

async function loadCandidates(): Promise<CandidateJob[]> {
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

const pad = (value: string, width: number) => value.padEnd(width).slice(0, width);

async function main(): Promise<void> {
  const candidates = await loadCandidates();
  const config = withSelectionConfig(
    limitArg
      ? { telegramMaxPosts: Number.parseInt(limitArg, 10) || SELECTION_CONFIG.telegramMaxPosts }
      : {},
  );
  const result = runSelection(candidates, config);

  if (asJson) {
    console.log(JSON.stringify({ candidates: candidates.length, ...result }, null, 2));
    return;
  }

  console.log(`candidates=${candidates.length} (read-only preview, nothing published)\n`);
  console.log("TELEGRAM TOP 10");
  console.log(
    `${pad("#", 3)} ${pad("Company", 22)} ${pad("Role", 42)} ${pad("Category", 12)} ${pad("Score", 6)} Reason`,
  );
  for (const item of result.telegram) {
    console.log(
      `${pad(String(item.rank), 3)} ${pad(item.company ?? "?", 22)} ${pad(item.role, 42)} ${pad(item.category, 12)} ${pad(String(item.score), 6)} ${item.selectionReason}`,
    );
  }

  console.log("\nMEDIA TOP 2 (Instagram + X)");
  console.log(
    `${pad("#", 3)} ${pad("Company", 22)} ${pad("Role", 42)} ${pad("Category", 12)} ${pad("Score", 6)} ${pad("Media", 6)} Reason`,
  );
  for (const item of result.media) {
    console.log(
      `${pad(String(item.rank), 3)} ${pad(item.company ?? "?", 22)} ${pad(item.role, 42)} ${pad(item.category, 12)} ${pad(String(item.score), 6)} ${pad(String(item.mediaScore), 6)} ${item.selectionReason}`,
    );
  }

  console.log("\nNEAR MISSES");
  console.log(
    `rejected=${result.nearMisses.rejected.length} eligible_not_selected=${result.nearMisses.eligibleNotSelected.length}`,
  );
  const rejectReasonCounts = new Map<string, number>();
  for (const rejected of result.nearMisses.rejected) {
    for (const reason of rejected.reasons) {
      rejectReasonCounts.set(reason, (rejectReasonCounts.get(reason) ?? 0) + 1);
    }
  }
  for (const [reason, count] of [...rejectReasonCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  reject:${reason}=${count}`);
  }
  for (const miss of result.nearMisses.eligibleNotSelected.slice(0, 5)) {
    console.log(`  not_selected: ${miss.company ?? "?"} | ${miss.role} | score ${miss.score}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
