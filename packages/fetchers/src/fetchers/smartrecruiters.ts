import type { RawFetchedPost, SourceDto } from "@foundryjobs/shared";
import { fetchJson } from "../http";
import { htmlToPlainText } from "../text";
import type { SourceFetcher } from "../types";

export const SMARTRECRUITERS_MAX_JOBS_PER_FETCH = 100;
export const SMARTRECRUITERS_PAGE_SIZE = 100;
export const SMARTRECRUITERS_MAX_PAGES = 2;
export const SMARTRECRUITERS_DETAIL_LIMIT = 20;

export function extractSmartRecruitersCompany(sourceUrl: string): string | null {
  try {
    const url = new URL(sourceUrl);
    if (!/(^|\.)smartrecruiters\.com$/i.test(url.hostname)) {
      return null;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    return segments[0] ?? null;
  } catch {
    return null;
  }
}

export function buildSmartRecruitersPostingsUrl(company: string, offset: number): string {
  return `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings?limit=${SMARTRECRUITERS_PAGE_SIZE}&offset=${offset}`;
}

export function buildSmartRecruitersJobUrl(company: string, postingId: string): string {
  return `https://jobs.smartrecruiters.com/${company}/${postingId}`;
}

type SmartRecruitersPostingsResponse = {
  totalFound?: number;
  content?: Array<{
    id?: string;
    name?: string;
    releasedDate?: string;
    location?: { city?: string; region?: string; country?: string };
    department?: { label?: string };
    typeOfEmployment?: { label?: string };
  }>;
};

type SmartRecruitersDetailResponse = {
  jobAd?: {
    sections?: {
      jobDescription?: { text?: string };
    };
  };
};

async function fetchSmartRecruitersDescription(
  company: string,
  postingId: string,
): Promise<string | null> {
  try {
    const payload = await fetchJson<SmartRecruitersDetailResponse>(
      `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(company)}/postings/${postingId}`,
    );
    const html = payload.jobAd?.sections?.jobDescription?.text;
    return html ? htmlToPlainText(html) : null;
  } catch {
    return null;
  }
}

export const smartRecruitersFetcher: SourceFetcher = {
  platform: "smartrecruiters",
  async fetch(source: SourceDto): Promise<RawFetchedPost[]> {
    const company = extractSmartRecruitersCompany(source.url);
    if (!company) {
      throw new Error(`Could not determine SmartRecruiters company from URL: ${source.url}`);
    }

    const postings: NonNullable<SmartRecruitersPostingsResponse["content"]> = [];

    for (let page = 0; page < SMARTRECRUITERS_MAX_PAGES; page += 1) {
      const offset = page * SMARTRECRUITERS_PAGE_SIZE;
      const payload = await fetchJson<SmartRecruitersPostingsResponse>(
        buildSmartRecruitersPostingsUrl(company, offset),
      );
      const batch = payload.content ?? [];
      postings.push(...batch);

      if (
        batch.length < SMARTRECRUITERS_PAGE_SIZE ||
        postings.length >= SMARTRECRUITERS_MAX_JOBS_PER_FETCH ||
        (typeof payload.totalFound === "number" && postings.length >= payload.totalFound)
      ) {
        break;
      }
    }

    const capped = postings.slice(0, SMARTRECRUITERS_MAX_JOBS_PER_FETCH);
    const descriptions = new Map<string, string>();

    const detailTargets = capped
      .filter((posting) => posting.id)
      .slice(0, SMARTRECRUITERS_DETAIL_LIMIT);
    let detailIndex = 0;
    const detailWorkers = Array.from({ length: Math.min(3, detailTargets.length) }, async () => {
      while (detailIndex < detailTargets.length) {
        const target = detailTargets[detailIndex];
        detailIndex += 1;
        if (!target) {
          break;
        }
        const description = await fetchSmartRecruitersDescription(company, target.id as string);
        if (description) {
          descriptions.set(target.id as string, description);
        }
      }
    });
    await Promise.all(detailWorkers);

    return capped
      .filter((posting) => Boolean(posting.id))
      .map((posting) => {
        const postingId = posting.id as string;
        const title = posting.name?.trim() || "Untitled role";
        const location = [
          posting.location?.city,
          posting.location?.region,
          posting.location?.country,
        ]
          .filter((part): part is string => Boolean(part))
          .join(", ");
        const department = posting.department?.label?.trim() || null;
        const employment = posting.typeOfEmployment?.label?.trim() || null;
        const description = descriptions.get(postingId) ?? null;

        const rawText = [
          `Title: ${title}`,
          `Company: ${source.name}`,
          location ? `Location: ${location}` : null,
          department ? `Department: ${department}` : null,
          employment ? `Employment: ${employment}` : null,
          description,
        ]
          .filter((part): part is string => Boolean(part))
          .join("\n");

        return {
          sourceId: source.id,
          externalId: postingId,
          rawUrl: buildSmartRecruitersJobUrl(company, postingId),
          rawTitle: title,
          rawText,
          rawHtml: description,
          postedAt: posting.releasedDate ?? null,
        } satisfies RawFetchedPost;
      });
  },
};
