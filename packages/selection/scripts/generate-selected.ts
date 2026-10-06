import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { closeDatabase, getDatabase, generatedPosts } from "@foundryjobs/db";
import { generatePostsForSelection } from "@foundryjobs/post-generator";
import { sql } from "drizzle-orm";
import { runSelection, withSelectionConfig } from "../src/index";
import { loadCandidates } from "../src/load-candidates";

const DEV_DATABASE_URL = "postgres://benediction@127.0.0.1:5432/foundryjobs_dev";
const TEST_DATABASE_URL = "postgres://benediction@127.0.0.1:5432/foundryjobs_test";

const args = process.argv.slice(2);
const envArg = args.find((arg) => arg.startsWith("--env="))?.slice("--env=".length) ?? "dev";

if (!["dev", "test", "production"].includes(envArg)) {
  console.error("Usage: pnpm jobs:generate-selected --env=dev|test|production");
  process.exit(1);
}

if (envArg === "dev") {
  process.env.DATABASE_URL = DEV_DATABASE_URL;
} else if (envArg === "test") {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
} else {
  const rootEnvPath = fileURLToPath(new URL("../../../.env", import.meta.url));
  if (existsSync(rootEnvPath) && !process.env.DATABASE_URL) {
    process.loadEnvFile(rootEnvPath);
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || /localhost|127\.0\.0\.1/.test(databaseUrl)) {
    console.error("Production generation requires a non-local DATABASE_URL.");
    process.exit(1);
  }
  console.log("target=production (draft rows only; no provider calls)");
}

async function main(): Promise<void> {
  const candidates = await loadCandidates();
  const selection = runSelection(candidates, withSelectionConfig());
  console.log(
    `selection: telegram=${selection.telegram.length} media=${selection.media.length} candidates=${candidates.length}`,
  );

  const results = await generatePostsForSelection({
    telegramJobIds: selection.telegram.map((item) => item.jobPostId),
    mediaJobIds: selection.media.map((item) => item.jobPostId),
  });

  for (const result of results) {
    console.log(
      `  [${result.status}] ${result.jobPostId} generated=${result.generatedCount}${result.skippedReason ? ` — ${result.skippedReason}` : ""}${result.errorMessage ? ` — ${result.errorMessage}` : ""}`,
    );
  }

  const database = getDatabase();
  const queue = await database
    .select({
      platform: generatedPosts.platform,
      status: generatedPosts.status,
      count: sql<number>`count(*)::int`,
    })
    .from(generatedPosts)
    .groupBy(generatedPosts.platform, generatedPosts.status)
    .orderBy(generatedPosts.platform, generatedPosts.status);
  console.log("generated_posts state:");
  for (const row of queue) {
    console.log(`  ${row.platform}/${row.status}=${row.count}`);
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
