import type { SourceDto } from "@foundryjobs/shared";
import { SOURCE_MANIFEST } from "@foundryjobs/db";
import { getFetcherForSource } from "../src/registry";

const enabled = process.env.LIVE_INTEGRATION_TESTS === "true";
if (!enabled) {
  console.error(
    "Refusing to run live source verification. Set LIVE_INTEGRATION_TESTS=true to enable.",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const filterArg = args.find((arg) => arg.startsWith("--filter="))?.slice("--filter=".length);
const categoryArg = args.find((arg) => arg.startsWith("--category="))?.slice("--category=".length);
const filters = filterArg ? new Set(filterArg.split(",").map((value) => value.trim())) : null;

const selected = SOURCE_MANIFEST.filter((source) => {
  if (filters && !filters.has(source.slug) && !filters.has(source.platform)) {
    return false;
  }
  if (categoryArg && source.category !== categoryArg) {
    return false;
  }
  return true;
});

function toSourceDto(definition: (typeof SOURCE_MANIFEST)[number]): SourceDto {
  return {
    id: definition.slug,
    name: definition.name,
    type: definition.type,
    platform: definition.platform,
    url: definition.url,
    atsType: definition.atsType,
    trustLevel: definition.trustLevel,
    fetchIntervalMinutes: definition.fetchIntervalMinutes,
    isActive: definition.isActive,
    category: definition.category,
    region: definition.region,
    priority: definition.priority,
    lastFetchedAt: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

async function checkUrl(url: string): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "user-agent": "FoundryJobsBot/0.1 (+https://foundryjobs.local)" },
      signal: controller.signal,
      redirect: "follow",
    });
    return response.status;
  } catch {
    return 0;
  } finally {
    clearTimeout(timer);
  }
}

type Row = {
  slug: string;
  platform: string;
  category: string;
  jobs: number;
  sampleId: string;
  sampleTitle: string;
  sampleUrlStatus: number;
  durationMs: number;
  error: string | null;
};

const rows: Row[] = [];

for (const definition of selected) {
  const startedAt = Date.now();
  const fetcher = getFetcherForSource(toSourceDto(definition));
  if (!fetcher) {
    rows.push({
      slug: definition.slug,
      platform: definition.platform,
      category: definition.category,
      jobs: 0,
      sampleId: "-",
      sampleTitle: "-",
      sampleUrlStatus: 0,
      durationMs: 0,
      error: "unsupported platform",
    });
    continue;
  }

  try {
    const posts = await fetcher.fetch(toSourceDto(definition));
    const sample = posts[0];
    const sampleUrlStatus = sample ? await checkUrl(sample.rawUrl) : 0;
    rows.push({
      slug: definition.slug,
      platform: definition.platform,
      category: definition.category,
      jobs: posts.length,
      sampleId: sample?.externalId ?? "-",
      sampleTitle: (sample?.rawTitle ?? "-").slice(0, 50),
      sampleUrlStatus,
      durationMs: Date.now() - startedAt,
      error: null,
    });
  } catch (error) {
    rows.push({
      slug: definition.slug,
      platform: definition.platform,
      category: definition.category,
      jobs: 0,
      sampleId: "-",
      sampleTitle: "-",
      sampleUrlStatus: 0,
      durationMs: Date.now() - startedAt,
      error: (error instanceof Error ? error.message : String(error)).slice(0, 160),
    });
  }
}

const pad = (value: string, width: number) => value.padEnd(width).slice(0, width);
console.log(
  `${pad("source", 34)} ${pad("platform", 16)} ${pad("category", 12)} ${pad("jobs", 6)} ${pad("url", 5)} ${pad("ms", 7)} sample`,
);
for (const row of rows) {
  console.log(
    `${pad(row.slug, 34)} ${pad(row.platform, 16)} ${pad(row.category, 12)} ${pad(String(row.jobs), 6)} ${pad(String(row.sampleUrlStatus), 5)} ${pad(String(row.durationMs), 7)} ${row.error ?? `${row.sampleId} | ${row.sampleTitle}`}`,
  );
}

const ok = rows.filter((row) => !row.error && row.jobs > 0);
const failed = rows.filter((row) => row.error);
const empty = rows.filter((row) => !row.error && row.jobs === 0);
console.log(
  `\nverified=${rows.length} ok=${ok.length} empty=${empty.length} failed=${failed.length} total_jobs=${rows.reduce((sum, row) => sum + row.jobs, 0)}`,
);
if (failed.length > 0) {
  console.log("failed sources:");
  for (const row of failed) {
    console.log(`  ${row.slug}: ${row.error}`);
  }
}
