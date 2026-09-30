import type { RawFetchedPost, SourceDto } from "@foundryjobs/shared";
import { fetchJson } from "../http";
import { htmlToPlainText } from "../text";
import type { SourceFetcher } from "../types";

type GreenhouseJob = {
  id?: number | string;
  title?: string;
  absolute_url?: string;
  updated_at?: string;
  first_published?: string;
  published_at?: string;
  location?: { name?: string };
  departments?: Array<{ name?: string }>;
  content?: string;
};

type GreenhouseJobsResponse = {
  jobs?: GreenhouseJob[];
};

const API_BASE = "https://boards-api.greenhouse.io/v1/boards";
const BOARD_PATTERNS = [
  /^https?:\/\/boards-api\.greenhouse\.io\/v1\/boards\/([^/?#]+)/i,
  /^https?:\/\/(?:job-)?boards\.greenhouse\.io\/([^/?#]+)/i,
];

export function extractGreenhouseBoardToken(sourceUrl: string): string | null {
  for (const pattern of BOARD_PATTERNS) {
    const match = pattern.exec(sourceUrl);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

export function buildGreenhouseApiUrl(boardToken: string): string {
  return `${API_BASE}/${encodeURIComponent(boardToken)}/jobs?content=true`;
}

export const greenhouseFetcher: SourceFetcher = {
  platform: "greenhouse",
  async fetch(source: SourceDto): Promise<RawFetchedPost[]> {
    const boardToken = extractGreenhouseBoardToken(source.url);
    if (!boardToken) {
      throw new Error(`Could not determine Greenhouse board token from URL: ${source.url}`);
    }

    const payload = await fetchJson<GreenhouseJobsResponse>(buildGreenhouseApiUrl(boardToken));
    const jobs = payload.jobs ?? [];

    return jobs.map((job) => {
      const title = job.title?.trim() || "Untitled role";
      const locationName = job.location?.name?.trim() || null;
      const departments = (job.departments ?? [])
        .map((department) => department.name?.trim())
        .filter((name): name is string => Boolean(name));
      const contentText = job.content ? htmlToPlainText(job.content) : null;

      const rawText = [
        `Title: ${title}`,
        `Company: ${source.name}`,
        locationName ? `Location: ${locationName}` : null,
        departments.length > 0 ? `Departments: ${departments.join(", ")}` : null,
        contentText,
      ]
        .filter((part): part is string => Boolean(part))
        .join("\n");

      return {
        sourceId: source.id,
        externalId: job.id !== undefined && job.id !== null ? String(job.id) : null,
        rawUrl: job.absolute_url ?? source.url,
        rawTitle: title,
        rawText,
        rawHtml: job.content ?? null,
        postedAt: job.first_published ?? job.published_at ?? job.updated_at ?? null,
      } satisfies RawFetchedPost;
    });
  },
};
