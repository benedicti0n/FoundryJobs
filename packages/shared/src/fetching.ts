import { createHash } from "node:crypto";
import type { SourcePlatform } from "./sources";

export type FetchSourceStatus = "success" | "skipped" | "failed" | "unsupported";

export type RawPostStatus = "new" | "duplicate" | "normalized" | "rejected" | "error";

export type RawFetchedPost = {
  sourceId: string;
  externalId?: string | null;
  rawUrl: string;
  rawTitle?: string | null;
  rawText: string;
  rawHtml?: string | null;
  postedAt?: string | null;
};

export type FetchSourceResult = {
  sourceId: string;
  sourceName: string;
  platform: SourcePlatform | null;
  status: FetchSourceStatus;
  fetchedCount: number;
  insertedCount: number;
  duplicateCount: number;
  errorMessage?: string;
  startedAt: string;
  finishedAt: string;
};

export type FetchRunSummary = {
  startedAt: string;
  finishedAt: string;
  sourceCount: number;
  successCount: number;
  failedCount: number;
  unsupportedCount: number;
  totalFetched: number;
  totalInserted: number;
  totalDuplicates: number;
  results: FetchSourceResult[];
};

export function createContentHash(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
