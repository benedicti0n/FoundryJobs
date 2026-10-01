import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getMissingBufferEnvVars } from "@foundryjobs/buffer";
import { publishApprovedBufferPosts } from "@foundryjobs/buffer-publisher";
import { renderInstagramCardsForPendingPosts } from "@foundryjobs/card-renderer";
import { uploadInstagramCardsForPendingPosts } from "@foundryjobs/card-uploader";
import { closeDatabase } from "@foundryjobs/db";
import { fetchDueSources } from "@foundryjobs/fetchers";
import { normalizeNewRawPosts } from "@foundryjobs/normalizer";
import { generatePostsForReadyJobs } from "@foundryjobs/post-generator";
import { publishApprovedTelegramPosts } from "@foundryjobs/publisher";
import { APP_NAME, isEnvSet } from "@foundryjobs/shared";
import { R2_CONFIG_ERROR, isR2Configured } from "@foundryjobs/storage";

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

async function runPublishTelegramOnce(): Promise<void> {
  if (!isEnvSet("DATABASE_URL")) {
    console.error(
      "DATABASE_URL is required to run publish-telegram:once. Set it in the environment or the root .env file.",
    );
    process.exitCode = 1;
    return;
  }

  if (!isEnvSet("TELEGRAM_BOT_TOKEN") || !isEnvSet("TELEGRAM_CHAT_ID")) {
    console.error(
      "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required to run publish-telegram:once. No posts were published.",
    );
    process.exitCode = 1;
    return;
  }

  const limit = parseWorkerLimit(process.env.PUBLISH_TELEGRAM_LIMIT, 10);

  try {
    const summary = await publishApprovedTelegramPosts(limit);
    console.log(`${APP_NAME} publish-telegram run complete (limit ${limit})`);
    console.log(
      `Processed ${summary.processedCount} approved Telegram posts (published ${summary.publishedCount}, skipped ${summary.skippedCount}, failed ${summary.failedCount})`,
    );

    for (const result of summary.results) {
      const external = result.externalPostId ? ` external=${result.externalPostId}` : "";
      const link = result.publishedUrl ? ` ${result.publishedUrl}` : "";
      const error = result.errorMessage ? ` — ${result.errorMessage}` : "";
      console.log(`  [${result.status}] ${result.generatedPostId}${external}${link}${error}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

async function runRenderInstagramCardsOnce(): Promise<void> {
  if (!isEnvSet("DATABASE_URL")) {
    console.error(
      "DATABASE_URL is required to run render-instagram-cards:once. Set it in the environment or the root .env file.",
    );
    process.exitCode = 1;
    return;
  }

  const limit = parseWorkerLimit(process.env.RENDER_INSTAGRAM_CARDS_LIMIT, 10);

  try {
    const summary = await renderInstagramCardsForPendingPosts(limit);
    console.log(`${APP_NAME} render-instagram-cards run complete (limit ${limit})`);
    console.log(
      `Processed ${summary.processedCount} Instagram posts (rendered ${summary.renderedCount}, skipped ${summary.skippedCount}, errors ${summary.errorCount})`,
    );

    for (const result of summary.results) {
      const detail = result.imageUrl
        ? ` ${result.imageUrl}`
        : result.errorMessage
          ? ` — ${result.errorMessage}`
          : "";
      console.log(`  [${result.status}] ${result.generatedPostId}${detail}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

async function runUploadInstagramCardsOnce(): Promise<void> {
  if (!isEnvSet("DATABASE_URL")) {
    console.error(
      "DATABASE_URL is required to run upload-instagram-cards:once. Set it in the environment or the root .env file.",
    );
    process.exitCode = 1;
    return;
  }

  if (!isR2Configured()) {
    console.error(`${R2_CONFIG_ERROR}. No cards were uploaded.`);
    process.exitCode = 1;
    return;
  }

  const limit = parseWorkerLimit(process.env.UPLOAD_INSTAGRAM_CARDS_LIMIT, 10);

  try {
    const summary = await uploadInstagramCardsForPendingPosts(limit);
    console.log(`${APP_NAME} upload-instagram-cards run complete (limit ${limit})`);
    console.log(
      `Processed ${summary.processedCount} Instagram cards (uploaded ${summary.uploadedCount}, skipped ${summary.skippedCount}, errors ${summary.errorCount})`,
    );

    for (const result of summary.results) {
      const detail = result.publicImageUrl
        ? ` -> ${result.publicImageUrl}`
        : result.errorMessage
          ? ` — ${result.errorMessage}`
          : "";
      console.log(`  [${result.status}] ${result.generatedPostId}${detail}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

async function runPublishBufferOnce(): Promise<void> {
  if (!isEnvSet("DATABASE_URL")) {
    console.error(
      "DATABASE_URL is required to run publish-buffer:once. Set it in the environment or the root .env file.",
    );
    process.exitCode = 1;
    return;
  }

  const missing = getMissingBufferEnvVars();
  if (missing.length > 0) {
    console.error(
      `BUFFER_ACCESS_TOKEN and the matching BUFFER_PROFILE_ID_* value are required to run publish-buffer:once. Missing: ${missing.join(", ")}. No posts were published.`,
    );
    process.exitCode = 1;
    return;
  }

  const limit = parseWorkerLimit(process.env.PUBLISH_BUFFER_LIMIT, 10);

  try {
    const summary = await publishApprovedBufferPosts(limit);
    console.log(`${APP_NAME} publish-buffer run complete (limit ${limit})`);
    console.log(
      `Processed ${summary.processedCount} approved posts (published ${summary.publishedCount}, skipped ${summary.skippedCount}, failed ${summary.failedCount})`,
    );

    for (const result of summary.results) {
      const external = result.externalPostId ? ` external=${result.externalPostId}` : "";
      const link = result.publishedUrl ? ` ${result.publishedUrl}` : "";
      const error = result.errorMessage ? ` — ${result.errorMessage}` : "";
      console.log(
        `  [${result.status}] ${result.platform ?? "unknown"} ${result.generatedPostId}${external}${link}${error}`,
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
} else if (command === "publish-telegram:once") {
  await runPublishTelegramOnce();
} else if (command === "render-instagram-cards:once") {
  await runRenderInstagramCardsOnce();
} else if (command === "upload-instagram-cards:once") {
  await runUploadInstagramCardsOnce();
} else if (command === "publish-buffer:once") {
  await runPublishBufferOnce();
} else {
  startWorkerLoop();
}
