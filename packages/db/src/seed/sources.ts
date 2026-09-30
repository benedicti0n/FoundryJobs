import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  isEnvSet,
  SOURCE_DEFAULTS,
  validateCreateSourceInput,
  type CreateSourceInput,
} from "@foundryjobs/shared";
import { closeDatabase, getDatabase } from "../client";
import { sources } from "../schema";

const rootEnvPath = fileURLToPath(new URL("../../../../.env", import.meta.url));

if (existsSync(rootEnvPath)) {
  process.loadEnvFile(rootEnvPath);
}

const starterSources: CreateSourceInput[] = [
  {
    name: "Acme Corp (Greenhouse)",
    type: "ats",
    platform: "greenhouse",
    url: "https://boards.greenhouse.io/acmecorp",
    atsType: "greenhouse",
    trustLevel: 70,
  },
  {
    name: "Acme Corp (Lever)",
    type: "ats",
    platform: "lever",
    url: "https://jobs.lever.co/acmecorp",
    atsType: "lever",
    trustLevel: 70,
  },
  {
    name: "Acme Corp (Ashby)",
    type: "ats",
    platform: "ashby",
    url: "https://jobs.ashbyhq.com/acmecorp",
    atsType: "ashby",
    trustLevel: 70,
  },
  {
    name: "Example Remote Jobs RSS",
    type: "rss",
    platform: "generic",
    url: "https://example.com/remote-jobs.rss",
    trustLevel: 60,
  },
  {
    name: "Manual Submissions",
    type: "manual",
    platform: "manual",
    url: "https://example.com/manual-submissions",
    trustLevel: 40,
    fetchIntervalMinutes: 1440,
  },
];

function toInsertValues(input: CreateSourceInput): typeof sources.$inferInsert {
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

async function seedSources(): Promise<void> {
  if (!isEnvSet("DATABASE_URL")) {
    console.error(
      "DATABASE_URL is required to seed sources. Set it in the environment or the root .env file, then re-run.",
    );
    process.exitCode = 1;
    return;
  }

  const values = starterSources.map((source) => {
    const result = validateCreateSourceInput(source);
    if (!result.ok) {
      throw new Error(`Invalid starter source "${source.name}": ${result.errors.join("; ")}`);
    }
    return toInsertValues(result.data);
  });

  const database = getDatabase();
  const inserted = await database
    .insert(sources)
    .values(values)
    .onConflictDoNothing({ target: sources.url })
    .returning({ id: sources.id });

  console.log(
    `Source seed complete: ${inserted.length} inserted, ${values.length - inserted.length} already present (skipped).`,
  );
}

seedSources()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
