import type {
  FetchRunSummary,
  FetchSourceResult,
  FetchSourceStatus,
  SourceDto,
} from "@foundryjobs/shared";
import {
  createRawPostIfNotExists,
  listActiveSourcesDueForFetch,
  updateSourceLastFetchedAt,
} from "@foundryjobs/db";
import { getFetcherForSource } from "./registry";

type FetchCounts = {
  fetched: number;
  inserted: number;
  duplicates: number;
};

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildResult(
  source: SourceDto,
  status: FetchSourceStatus,
  counts: FetchCounts,
  startedAt: Date,
  finishedAt: Date,
  errorMessage?: string,
): FetchSourceResult {
  return {
    sourceId: source.id,
    sourceName: source.name,
    platform: source.platform,
    status,
    fetchedCount: counts.fetched,
    insertedCount: counts.inserted,
    duplicateCount: counts.duplicates,
    ...(errorMessage !== undefined ? { errorMessage } : {}),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
  };
}

export async function fetchSource(source: SourceDto): Promise<FetchSourceResult> {
  const startedAt = new Date();
  const fetcher = getFetcherForSource(source);

  if (!fetcher) {
    return buildResult(
      source,
      "unsupported",
      { fetched: 0, inserted: 0, duplicates: 0 },
      startedAt,
      new Date(),
    );
  }

  if (!source.isActive) {
    return buildResult(
      source,
      "skipped",
      { fetched: 0, inserted: 0, duplicates: 0 },
      startedAt,
      new Date(),
    );
  }

  const counts: FetchCounts = { fetched: 0, inserted: 0, duplicates: 0 };

  try {
    const posts = await fetcher.fetch(source);
    counts.fetched = posts.length;

    for (const post of posts) {
      const result = await createRawPostIfNotExists(post);
      if (result.inserted) {
        counts.inserted += 1;
      } else {
        counts.duplicates += 1;
      }
    }

    await updateSourceLastFetchedAt(source.id, new Date());
    return buildResult(source, "success", counts, startedAt, new Date());
  } catch (error) {
    return buildResult(source, "failed", counts, startedAt, new Date(), describeError(error));
  }
}

export async function fetchDueSources(now: Date = new Date()): Promise<FetchRunSummary> {
  const startedAt = new Date();
  const dueSources = await listActiveSourcesDueForFetch(now);
  const results: FetchSourceResult[] = [];

  for (const source of dueSources) {
    results.push(await fetchSource(source));
  }

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    sourceCount: results.length,
    successCount: results.filter((result) => result.status === "success").length,
    failedCount: results.filter((result) => result.status === "failed").length,
    unsupportedCount: results.filter((result) => result.status === "unsupported").length,
    totalFetched: results.reduce((total, result) => total + result.fetchedCount, 0),
    totalInserted: results.reduce((total, result) => total + result.insertedCount, 0),
    totalDuplicates: results.reduce((total, result) => total + result.duplicateCount, 0),
    results,
  };
}
