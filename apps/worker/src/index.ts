import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { closeDatabase } from "@foundryjobs/db";
import { fetchDueSources } from "@foundryjobs/fetchers";
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
} else {
  startWorkerLoop();
}
