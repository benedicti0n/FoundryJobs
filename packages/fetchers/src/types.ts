import type { RawFetchedPost, SourceDto, SourcePlatform } from "@foundryjobs/shared";

export type SourceFetcher = {
  platform: SourcePlatform;
  fetch(source: SourceDto): Promise<RawFetchedPost[]>;
};
