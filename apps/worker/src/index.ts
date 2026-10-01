import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { closeDatabase } from "@foundryjobs/db";
import { fetchDueSources } from "@foundryjobs/fetchers";
import { normalizeNewRawPosts } from "@foundryjobs/normalizer";
import { generatePostsForReadyJobs } from "@foundryjobs/post-generator";
import { APP_NAME, isEnvSet } from "@foundryjobs/shared";

const rootEnvPath = fileURLToPath(new URL("../../../.env", import.meta.url));

if (existsSync(rootEnvPath)) {
  process.loadEnvFile(rootEnvPath);
}

async function runFetchOnce(): Promise<void> {
  if (!isEnvSet("DATABASE_URL")) {
    console.error(
      "DATABASE_URL is required to run fetch:once. Set it in the environment or the root .env file.",
    );
    process.exitCode = 1;
    return;
  }

  try {
    const summary = await fetchDueSources();
    console.log(`${APP_NAME} fetch run complete`);
    console.log(
      `Sources: ${summary.sourceCount} (success ${summary.successCount}, failed ${summary.failedCount}, unsupported ${summary.unsupportedCount})`,
    );
    console.log(
      `Posts: fetched ${summary.totalFetched}, inserted ${summary.totalInserted}, duplicates ${summary.totalDuplicates}`,
    );

    for (const result of summary.results) {
      const detail =
        result.status === "failed" ? ` — ${result.errorMessage ?? "unknown error"}` : "";
      console.log(
        `  [${result.status}] ${result.sourceName} (${result.platform ?? "no platform"}): fetched ${result.fetchedCount}, inserted ${result.insertedCount}, duplicates ${result.duplicateCount}${detail}`,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

function parseWorkerLimit(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, 200);
}

async function runNormalizeOnce(): Promise<void> {
  if (!isEnvSet("DATABASE_URL")) {
    console.error(
      "DATABASE_URL is required to run normalize:once. Set it in the environment or the root .env file.",
    );
    process.exitCode = 1;
    return;
  }

  const limit = parseWorkerLimit(process.env.NORMALIZE_LIMIT, 25);
  const provider = isEnvSet("GEMINI_API_KEY") ? "gemini" : "rules";

  try {
    const summary = await normalizeNewRawPosts(limit);
    console.log(
      `${APP_NAME} normalize run complete (limit ${limit}, extraction provider ${provider})`,
    );
    console.log(
      `Processed ${summary.processedCount} raw posts (normalized ${summary.normalizedCount}, rejected ${summary.rejectedCount}, errors ${summary.errorCount})`,
    );

    for (const result of summary.results) {
      const jobPart = result.jobPostId ? ` -> job ${result.jobPostId}` : "";
      const scorePart =
        result.totalScore !== undefined
          ? ` score=${result.totalScore} shouldPost=${result.shouldPost}`
          : "";
      const errorPart = result.errorMessage ? ` — ${result.errorMessage}` : "";
      console.log(`  [${result.status}] ${result.rawPostId}${jobPart}${scorePart}${errorPart}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

async function runGeneratePostsOnce(): Promise<void> {
  if (!isEnvSet("DATABASE_URL")) {
    console.error(
      "DATABASE_URL is required to run generate-posts:once. Set it in the environment or the root .env file.",
    );
    process.exitCode = 1;
    return;
  }

  const limit = parseWorkerLimit(process.env.GENERATE_POSTS_LIMIT, 25);

  try {
    const summary = await generatePostsForReadyJobs(limit);
    console.log(`${APP_NAME} generate-posts run complete (limit ${limit})`);
    console.log(
      `Processed ${summary.processedCount} job posts (generated ${summary.generatedJobsCount}, skipped ${summary.skippedCount}, errors ${summary.errorCount})`,
    );

    for (const result of summary.results) {
      const reasonPart = result.skippedReason
        ? ` — ${result.skippedReason}`
        : result.errorMessage
          ? ` — ${result.errorMessage}`
          : "";
      console.log(
        `  [${result.status}] ${result.jobPostId} generated=${result.generatedCount}${reasonPart}`,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

function startWorkerLoop(): void {
  const heartbeat = setInterval(() => undefined, 30_000);

  function shutdown(signal: NodeJS.Signals): void {
    console.log(`${APP_NAME} worker received ${signal}, shutting down`);
    clearInterval(heartbeat);
    process.exit(0);
  }

  console.log(`${APP_NAME} worker booted`);
  console.log("No scheduled jobs registered yet");

  process.once("SIGINT", () => {
    shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    shutdown("SIGTERM");
  });
}

const command = process.argv[2];

if (command === "fetch:once") {
  await runFetchOnce();
} else if (command === "normalize:once") {
  await runNormalizeOnce();
} else if (command === "generate-posts:once") {
  await runGeneratePostsOnce();
} else {
  startWorkerLoop();
}
