import type { RawFetchedPost, SourceDto } from "@foundryjobs/shared";
import { fetchJson, postJson } from "../http";
import { htmlToPlainText } from "../text";
import type { SourceFetcher } from "../types";

export const WORKDAY_MAX_JOBS_PER_FETCH = 100;
export const WORKDAY_PAGE_SIZE = 20;
export const WORKDAY_MAX_PAGES = 5;
export const WORKDAY_DETAIL_LIMIT = 20;

export type WorkdayCoordinates = {
  host: string;
  tenant: string;
  site: string;
};

export function extractWorkdayCoordinates(sourceUrl: string): WorkdayCoordinates | null {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return null;
  }

  const hostMatch = /^([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com$/i.exec(url.hostname);
  if (!hostMatch) {
    return null;
  }

  const segments = url.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => !/^[a-z]{2}-[A-Z]{2}$/.test(segment));

  if (segments.length === 0) {
    return null;
  }

  return {
    host: url.hostname,
    tenant: hostMatch[1] as string,
    site: segments[segments.length - 1] as string,
  };
}

export function buildWorkdayJobsUrl(coordinates: WorkdayCoordinates): string {
  return `https://${coordinates.host}/wday/cxs/${coordinates.tenant}/${coordinates.site}/jobs`;
}

export function buildWorkdayJobUrl(coordinates: WorkdayCoordinates, externalPath: string): string {
  const path = externalPath.startsWith("/") ? externalPath : `/${externalPath}`;
  return `https://${coordinates.host}/${coordinates.site}${path}`;
}

export function buildWorkdayDetailUrl(
  coordinates: WorkdayCoordinates,
  externalPath: string,
): string {
  const path = externalPath.startsWith("/") ? externalPath : `/${externalPath}`;
  return `https://${coordinates.host}/wday/cxs/${coordinates.tenant}/${coordinates.site}${path}`;
}

type WorkdayJobsResponse = {
  total?: number;
  jobPostings?: Array<{
    title?: string;
    externalPath?: string;
    locationsText?: string;
    postedOn?: string;
    bulletFields?: string[];
  }>;
};

type WorkdayDetailResponse = {
  jobPostingInfo?: {
    title?: string;
    jobDescription?: string;
    location?: string;
    startDate?: string;
    jobReqId?: string;
  };
};

async function fetchWorkdayDescription(
  coordinates: WorkdayCoordinates,
  externalPath: string,
): Promise<string | null> {
  try {
    const payload = await fetchJson<WorkdayDetailResponse>(
      buildWorkdayDetailUrl(coordinates, externalPath),
    );
    const html = payload.jobPostingInfo?.jobDescription;
    return html ? htmlToPlainText(html) : null;
  } catch {
    return null;
  }
}

export const workdayFetcher: SourceFetcher = {
  platform: "workday",
  async fetch(source: SourceDto): Promise<RawFetchedPost[]> {
    const coordinates = extractWorkdayCoordinates(source.url);
    if (!coordinates) {
      throw new Error(`Could not determine Workday coordinates from URL: ${source.url}`);
    }

    const postings: NonNullable<WorkdayJobsResponse["jobPostings"]> = [];

    for (let page = 0; page < WORKDAY_MAX_PAGES; page += 1) {
      const offset = page * WORKDAY_PAGE_SIZE;
      const payload = await postJson<WorkdayJobsResponse>(buildWorkdayJobsUrl(coordinates), {
        appliedFacets: {},
        limit: WORKDAY_PAGE_SIZE,
        offset,
        searchText: "",
      });

      const batch = payload.jobPostings ?? [];
      postings.push(...batch);

      if (
        batch.length < WORKDAY_PAGE_SIZE ||
        postings.length >= WORKDAY_MAX_JOBS_PER_FETCH ||
        (typeof payload.total === "number" && postings.length >= payload.total)
      ) {
        break;
      }
    }

    const capped = postings.slice(0, WORKDAY_MAX_JOBS_PER_FETCH);
    const descriptions = new Map<string, string>();

    const detailTargets = capped
      .filter((posting) => posting.externalPath)
      .slice(0, WORKDAY_DETAIL_LIMIT);
    let detailIndex = 0;
    const detailWorkers = Array.from({ length: Math.min(3, detailTargets.length) }, async () => {
      while (detailIndex < detailTargets.length) {
        const target = detailTargets[detailIndex];
        detailIndex += 1;
        if (!target) {
          break;
        }
        const description = await fetchWorkdayDescription(
          coordinates,
          target.externalPath as string,
        );
        if (description) {
          descriptions.set(target.externalPath as string, description);
        }
      }
    });
    await Promise.all(detailWorkers);

    return capped
      .filter((posting) => Boolean(posting.externalPath))
      .map((posting) => {
        const externalPath = posting.externalPath as string;
        const title = posting.title?.trim() || "Untitled role";
        const location = posting.locationsText?.trim() || null;
        const requisition = posting.bulletFields?.[0]?.trim() || null;
        const description = descriptions.get(externalPath) ?? null;

        const rawText = [
          `Title: ${title}`,
          `Company: ${source.name}`,
          location ? `Location: ${location}` : null,
          requisition ? `Requisition: ${requisition}` : null,
          description,
        ]
          .filter((part): part is string => Boolean(part))
          .join("\n");

        return {
          sourceId: source.id,
          externalId: requisition ?? externalPath,
          rawUrl: buildWorkdayJobUrl(coordinates, externalPath),
          rawTitle: title,
          rawText,
          rawHtml: description,
          postedAt: posting.postedOn ?? null,
        } satisfies RawFetchedPost;
      });
  },
};
