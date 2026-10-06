import type { RawFetchedPost, SourceDto } from "@foundryjobs/shared";
import { fetchJson } from "../http";
import { htmlToPlainText } from "../text";
import type { SourceFetcher } from "../types";

type AshbyJob = {
  id?: string;
  title?: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  publishedAt?: string;
  isListed?: boolean;
  jobUrl?: string;
  applyUrl?: string;
  descriptionPlain?: string;
  descriptionHtml?: string;
};

type AshbyJobsResponse = {
  jobs?: AshbyJob[];
};

const API_BASE = "https://api.ashbyhq.com/posting-api/job-board";
export const ASHBY_MAX_JOBS_PER_FETCH = 250;
const BOARD_PATTERNS = [
  /^https?:\/\/api\.ashbyhq\.com\/posting-api\/job-board\/([^/?#]+)/i,
  /^https?:\/\/jobs\.ashbyhq\.com\/([^/?#]+)/i,
];

export function extractAshbyOrganization(sourceUrl: string): string | null {
  for (const pattern of BOARD_PATTERNS) {
    const match = pattern.exec(sourceUrl);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

export function buildAshbyApiUrl(organization: string): string {
  return `${API_BASE}/${encodeURIComponent(organization)}`;
}

export const ashbyFetcher: SourceFetcher = {
  platform: "ashby",
  async fetch(source: SourceDto): Promise<RawFetchedPost[]> {
    const organization = extractAshbyOrganization(source.url);
    if (!organization) {
      throw new Error(`Could not determine Ashby organization from URL: ${source.url}`);
    }

    const payload = await fetchJson<AshbyJobsResponse>(buildAshbyApiUrl(organization));
    const jobs = (payload.jobs ?? []).slice(0, ASHBY_MAX_JOBS_PER_FETCH);

    return jobs
      .filter((job) => job.isListed !== false)
      .map((job) => {
        const title = job.title?.trim() || "Untitled role";
        const location = job.location?.trim() || null;
        const department = job.department?.trim() || job.team?.trim() || null;
        const employmentType = job.employmentType?.trim() || null;
        const descriptionText =
          job.descriptionPlain?.trim() ??
          (job.descriptionHtml ? htmlToPlainText(job.descriptionHtml) : null);

        const rawText = [
          `Title: ${title}`,
          `Company: ${source.name}`,
          location ? `Location: ${location}` : null,
          department ? `Department: ${department}` : null,
          employmentType ? `Employment type: ${employmentType}` : null,
          descriptionText,
        ]
          .filter((part): part is string => Boolean(part))
          .join("\n");

        return {
          sourceId: source.id,
          externalId: job.id ?? null,
          rawUrl: job.jobUrl ?? job.applyUrl ?? source.url,
          rawTitle: title,
          rawText,
          rawHtml: job.descriptionHtml ?? null,
          postedAt: job.publishedAt ?? null,
        } satisfies RawFetchedPost;
      });
  },
};
