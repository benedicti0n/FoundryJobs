import type { RawFetchedPost, SourceDto } from "@foundryjobs/shared";
import { fetchText } from "../http";
import { htmlToPlainText } from "../text";
import type { SourceFetcher } from "../types";

export const RSS_MAX_JOBS_PER_FETCH = 50;

type ParsedFeedItem = {
  title: string | null;
  link: string | null;
  guid: string | null;
  description: string | null;
  publishedAt: string | null;
};

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function extractTag(block: string, tags: string[]): string | null {
  for (const tag of tags) {
    const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(block);
    if (match?.[1]) {
      return decodeEntities(match[1]);
    }
    const selfClosing = new RegExp(`<${tag}(?:\\s[^>]*)?href="([^"]+)"[^>]*/?>`, "i").exec(block);
    if (selfClosing?.[1]) {
      return decodeEntities(selfClosing[1]);
    }
  }
  return null;
}

export function parseRssFeed(xml: string): ParsedFeedItem[] {
  const blocks = [
    ...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi),
    ...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi),
  ].map((match) => match[1] ?? "");

  return blocks.map((block) => ({
    title: extractTag(block, ["title"]),
    link: extractTag(block, ["link"]),
    guid: extractTag(block, ["guid", "id"]),
    description: extractTag(block, ["description", "summary", "content:encoded", "content"]),
    publishedAt: extractTag(block, ["pubDate", "published", "updated"]),
  }));
}

function isHttpUrl(value: string | null): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function toRawText(item: ParsedFeedItem, source: SourceDto): string {
  const descriptionText = item.description ? htmlToPlainText(item.description) : null;
  return [item.title ? `Title: ${item.title}` : null, `Company: ${source.name}`, descriptionText]
    .filter((part): part is string => Boolean(part))
    .join("\n");
}

export const rssFetcher: SourceFetcher = {
  platform: "rss",
  async fetch(source: SourceDto): Promise<RawFetchedPost[]> {
    const xml = await fetchText(source.url);
    const items = parseRssFeed(xml).slice(0, RSS_MAX_JOBS_PER_FETCH);

    return items
      .map((item): RawFetchedPost | null => {
        const rawUrl = isHttpUrl(item.link) ? item.link : isHttpUrl(item.guid) ? item.guid : null;
        if (!rawUrl) {
          return null;
        }
        return {
          sourceId: source.id,
          externalId: item.guid ?? rawUrl,
          rawUrl,
          rawTitle: item.title,
          rawText: toRawText(item, source),
          rawHtml: item.description,
          postedAt: item.publishedAt,
        };
      })
      .filter((post): post is RawFetchedPost => post !== null);
  },
};
