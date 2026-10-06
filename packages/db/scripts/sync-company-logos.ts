import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { closeDatabase } from "../src/client";
import { syncCompanyLogos } from "../src/companies/logo-sync";

const DEV_DATABASE_URL = "postgres://benediction@127.0.0.1:5432/foundryjobs_dev";
const TEST_DATABASE_URL = "postgres://benediction@127.0.0.1:5432/foundryjobs_test";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const confirmed = args.includes("--yes");
const refresh = args.includes("--refresh");
const envArg = args.find((arg) => arg.startsWith("--env="))?.slice("--env=".length) ?? "";

if (!["dev", "test", "production"].includes(envArg)) {
  console.error(
    "Usage: pnpm companies:sync-logos --env=dev|test|production [--dry-run] [--yes] [--refresh]",
  );
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
    console.error("Production logo sync requires a non-local DATABASE_URL.");
    process.exit(1);
  }
  if (!dryRun && !confirmed) {
    console.error(
      "Production logo sync requires explicit confirmation: re-run with --yes (or use --dry-run).",
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const report = await syncCompanyLogos({ dryRun, refresh });
  console.log(`Company logo sync complete (${report.dryRun ? "dry-run" : "applied"}):`);
  console.log(`  companies:  ${report.companies}`);
  console.log(`  resolved:   ${report.resolved}`);
  console.log(`  updated:    ${report.updated}`);
  console.log(`  unchanged:  ${report.unchanged}`);
  console.log(`  unresolved: ${report.unresolved}`);
  console.log(`  invalid:    ${report.invalid}`);
  for (const entry of report.entries.filter((item) => item.status === "resolved")) {
    console.log(`  + ${entry.companyName} -> ${entry.logoUrl}`);
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
