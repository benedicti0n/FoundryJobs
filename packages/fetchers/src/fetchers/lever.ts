import type { RawFetchedPost, SourceDto } from "@foundryjobs/shared";
import { fetchJson } from "../http";
import type { SourceFetcher } from "../types";

type LeverPosting = {
  id?: string;
  text?: string;
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number | string;
  categories?: {
    location?: string;
    team?: string;
    department?: string;
    commitment?: string;
  };
  descriptionPlain?: string;
  description?: string;
};

const API_BASE = "https://api.lever.co/v0/postings";
export const LEVER_MAX_JOBS_PER_FETCH = 250;
const POSTING_PATTERNS = [
  /^https?:\/\/api\.lever\.co\/v0\/postings\/([^/?#]+)/i,
  /^https?:\/\/jobs\.lever\.co\/([^/?#]+)/i,
];

export function extractLeverCompanySlug(sourceUrl: string): string | null {
  for (const pattern of POSTING_PATTERNS) {
    const match = pattern.exec(sourceUrl);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

export function buildLeverApiUrl(companySlug: string): string {
  return `${API_BASE}/${encodeURIComponent(companySlug)}?mode=json`;
}

function toIsoDate(value: number | string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export const leverFetcher: SourceFetcher = {
  platform: "lever",
  async fetch(source: SourceDto): Promise<RawFetchedPost[]> {
    const companySlug = extractLeverCompanySlug(source.url);
    if (!companySlug) {
      throw new Error(`Could not determine Lever company slug from URL: ${source.url}`);
    }

    const postings = await fetchJson<LeverPosting[]>(buildLeverApiUrl(companySlug));
    if (!Array.isArray(postings)) {
      throw new Error(`Unexpected Lever response for company: ${companySlug}`);
    }

    return postings.slice(0, LEVER_MAX_JOBS_PER_FETCH).map((posting) => {
      const title = posting.text?.trim() || "Untitled role";
      const categories = posting.categories ?? {};
      const categoryParts = [
        categories.location,
        categories.team,
        categories.department,
        categories.commitment,
      ]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value));

      const rawText = [
        `Title: ${title}`,
        `Company: ${source.name}`,
        categoryParts.length > 0 ? `Categories: ${categoryParts.join(" | ")}` : null,
        posting.descriptionPlain?.trim() ?? null,
      ]
        .filter((part): part is string => Boolean(part))
        .join("\n");

      return {
        sourceId: source.id,
        externalId: posting.id ?? null,
        rawUrl: posting.hostedUrl ?? posting.applyUrl ?? source.url,
        rawTitle: title,
        rawText,
        rawHtml: posting.description ?? null,
        postedAt: toIsoDate(posting.createdAt),
      } satisfies RawFetchedPost;
    });
  },
};
