import type { SourceDto } from "@foundryjobs/shared";
import { ashbyFetcher } from "./fetchers/ashby";
import { greenhouseFetcher } from "./fetchers/greenhouse";
import { leverFetcher } from "./fetchers/lever";
import { rssFetcher } from "./fetchers/rss";
import { smartRecruitersFetcher } from "./fetchers/smartrecruiters";
import { workdayFetcher } from "./fetchers/workday";
import type { SourceFetcher } from "./types";

const FETCHERS: SourceFetcher[] = [
  greenhouseFetcher,
  leverFetcher,
  ashbyFetcher,
  workdayFetcher,
  smartRecruitersFetcher,
  rssFetcher,
];

export function getFetcherForSource(source: SourceDto): SourceFetcher | null {
  if (!source.platform) {
    return null;
  }
  return FETCHERS.find((fetcher) => fetcher.platform === source.platform) ?? null;
}
