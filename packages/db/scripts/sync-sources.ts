import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { closeDatabase } from "../src/client";
import { syncSources } from "../src/sources/sync";

const DEV_DATABASE_URL = "postgres://benediction@127.0.0.1:5432/foundryjobs_dev";
const TEST_DATABASE_URL = "postgres://benediction@127.0.0.1:5432/foundryjobs_test";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const confirmed = args.includes("--yes");
const envArg = args.find((arg) => arg.startsWith("--env="))?.slice("--env=".length) ?? "";

if (!["dev", "test", "production"].includes(envArg)) {
  console.error("Usage: pnpm sources:sync --env=dev|test|production [--dry-run] [--yes]");
  console.error("--env is required so the target database is always explicit.");
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
  if (!databaseUrl) {
    console.error(
      "Production sync requires DATABASE_URL to be set in the environment or root .env.",
    );
    process.exit(1);
  }
  let host: string;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    console.error("DATABASE_URL is not a valid URL.");
    process.exit(1);
  }
  if (host === "127.0.0.1" || host === "localhost") {
    console.error("Refusing production sync: DATABASE_URL points at localhost.");
    process.exit(1);
  }
  if (!dryRun && !confirmed) {
    console.error(
      "Production sync requires explicit confirmation: re-run with --yes (or use --dry-run).",
    );
    process.exit(1);
  }
  console.log(`production target host=${host}${dryRun ? " (dry run)" : ""}`);
}

async function main(): Promise<void> {
  const result = await syncSources({ dryRun });
  console.log(`Source sync complete (${result.dryRun ? "dry-run" : "applied"}):`);
  console.log(
    `  added:       ${result.added.length}${result.added.length ? ` -> ${result.added.join(", ")}` : ""}`,
  );
  console.log(
    `  updated:     ${result.updated.length}${result.updated.length ? ` -> ${result.updated.join(", ")}` : ""}`,
  );
  console.log(`  unchanged:   ${result.unchanged.length}`);
  console.log(
    `  deactivated: ${result.deactivated.length}${result.deactivated.length ? ` -> ${result.deactivated.join(", ")}` : ""}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
