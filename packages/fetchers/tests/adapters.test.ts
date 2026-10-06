import assert from "node:assert/strict";
import test from "node:test";
import type { SourceDto } from "@foundryjobs/shared";
import { ashbyFetcher, ASHBY_MAX_JOBS_PER_FETCH } from "../src/fetchers/ashby";
import { greenhouseFetcher, GREENHOUSE_MAX_JOBS_PER_FETCH } from "../src/fetchers/greenhouse";
import { leverFetcher, LEVER_MAX_JOBS_PER_FETCH } from "../src/fetchers/lever";
import { parseRssFeed, rssFetcher } from "../src/fetchers/rss";
import { smartRecruitersFetcher } from "../src/fetchers/smartrecruiters";
import {
  extractWorkdayCoordinates,
  workdayFetcher,
  WORKDAY_MAX_JOBS_PER_FETCH,
} from "../src/fetchers/workday";
import { fetchJson } from "../src/http";
import { getFetcherForSource } from "../src/registry";

const originalFetch = globalThis.fetch;

function source(
  partial: Partial<SourceDto> & { url: string; platform: SourceDto["platform"] },
): SourceDto {
  return {
    id: "fixture-source",
    name: "Fixture Co",
    type: "ats",
    atsType: partial.platform,
    trustLevel: 80,
    fetchIntervalMinutes: 60,
    isActive: true,
    category: "general",
    region: "global",
    priority: "normal",
    lastFetchedAt: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...partial,
  };
}

type StubResponse = { status?: number; body: string; contentType?: string };

function stubFetch(
  responses: StubResponse[] | ((url: string, init?: RequestInit) => StubResponse),
): string[] {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push(url);
    const stub = typeof responses === "function" ? responses(url, init) : responses.shift();
    if (!stub) {
      throw new Error(`Unexpected fetch call: ${url}`);
    }
    return new Response(stub.body, {
      status: stub.status ?? 200,
      headers: { "content-type": stub.contentType ?? "application/json" },
    });
  }) as typeof fetch;
  return calls;
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("greenhouse adapter parses jobs and caps the batch", async () => {
  const jobs = Array.from({ length: GREENHOUSE_MAX_JOBS_PER_FETCH + 25 }, (_, index) => ({
    id: index + 1,
    title: `Role ${index + 1}`,
    absolute_url: `https://boards.greenhouse.io/fixture/jobs/${index + 1}`,
    location: { name: "Remote" },
    content: "<p>Build things</p>",
  }));
  stubFetch([{ body: JSON.stringify({ jobs }) }]);

  const posts = await greenhouseFetcher.fetch(
    source({ url: "https://boards.greenhouse.io/fixture", platform: "greenhouse" }),
  );

  assert.equal(posts.length, GREENHOUSE_MAX_JOBS_PER_FETCH);
  assert.equal(posts[0]?.externalId, "1");
  assert.match(posts[0]?.rawText ?? "", /Title: Role 1/);
});

test("ashby adapter filters unlisted jobs and caps the batch", async () => {
  const jobs = [
    {
      id: "a1",
      title: "Engineer",
      isListed: true,
      jobUrl: "https://jobs.ashbyhq.com/fixture/a1",
      descriptionPlain: "Text",
    },
    { id: "a2", title: "Hidden", isListed: false, jobUrl: "https://jobs.ashbyhq.com/fixture/a2" },
  ];
  stubFetch([{ body: JSON.stringify({ jobs }) }]);

  const posts = await ashbyFetcher.fetch(
    source({ url: "https://jobs.ashbyhq.com/fixture", platform: "ashby" }),
  );

  assert.equal(posts.length, 1);
  assert.equal(posts[0]?.externalId, "a1");
  assert.ok(ASHBY_MAX_JOBS_PER_FETCH > 0);
});

test("lever adapter parses postings and caps the batch", async () => {
  const postings = Array.from({ length: LEVER_MAX_JOBS_PER_FETCH + 10 }, (_, index) => ({
    id: `l${index}`,
    text: `Lever Role ${index}`,
    hostedUrl: `https://jobs.lever.co/fixture/l${index}`,
    categories: { location: "India" },
  }));
  stubFetch([{ body: JSON.stringify(postings) }]);

  const posts = await leverFetcher.fetch(
    source({ url: "https://jobs.lever.co/fixture", platform: "lever" }),
  );

  assert.equal(posts.length, LEVER_MAX_JOBS_PER_FETCH);
  assert.match(posts[0]?.rawText ?? "", /Lever Role 0/);
});

test("rss parser handles RSS and Atom entries", () => {
  const rss = `<rss><channel><item><title>Job A</title><link>https://example.com/a</link><guid>guid-a</guid><description><![CDATA[<p>Desc A</p>]]></description><pubDate>Tue, 06 Oct 2026 00:00:00 GMT</pubDate></item></channel></rss>`;
  const atom = `<feed><entry><title>Job B</title><link href="https://example.com/b"/><id>guid-b</id><summary>Desc B</summary><published>2026-10-06T00:00:00Z</published></entry></feed>`;

  const rssItems = parseRssFeed(rss);
  assert.equal(rssItems.length, 1);
  assert.equal(rssItems[0]?.link, "https://example.com/a");
  assert.equal(rssItems[0]?.guid, "guid-a");

  const atomItems = parseRssFeed(atom);
  assert.equal(atomItems.length, 1);
  assert.equal(atomItems[0]?.link, "https://example.com/b");
});

test("malformed rss feed yields no items without throwing", async () => {
  stubFetch([{ body: "<html>not a feed</html>", contentType: "text/html" }]);
  const posts = await rssFetcher.fetch(
    source({ url: "https://example.com/feed", platform: "rss" }),
  );
  assert.deepEqual(posts, []);
});

test("rss adapter maps items to raw posts and strips html", async () => {
  const feed = `<rss><channel>
    <item><title>Backend Intern</title><link>https://example.com/jobs/1</link><guid>1</guid><description><![CDATA[<p>Great <b>role</b></p>]]></description></item>
    <item><title>No link</title><guid>2</guid></item>
  </channel></rss>`;
  stubFetch([{ body: feed, contentType: "application/rss+xml" }]);

  const posts = await rssFetcher.fetch(
    source({ url: "https://example.com/feed", platform: "rss" }),
  );

  assert.equal(posts.length, 1);
  assert.equal(posts[0]?.rawUrl, "https://example.com/jobs/1");
  assert.match(posts[0]?.rawText ?? "", /Great role/);
});

test("workday coordinates, pagination and detail enrichment", async () => {
  const coordinates = extractWorkdayCoordinates(
    "https://fixture.wd5.myworkdayjobs.com/FixtureCareers",
  );
  assert.deepEqual(coordinates, {
    host: "fixture.wd5.myworkdayjobs.com",
    tenant: "fixture",
    site: "FixtureCareers",
  });

  const pageOne = {
    total: 30,
    jobPostings: Array.from({ length: 20 }, (_, index) => ({
      title: `WD Role ${index}`,
      externalPath: `/job/India/WD-Role-${index}_JR${index}`,
      locationsText: "India",
      bulletFields: [`JR${index}`],
    })),
  };
  const pageTwo = {
    total: 30,
    jobPostings: Array.from({ length: 10 }, (_, index) => ({
      title: `WD Role ${index + 20}`,
      externalPath: `/job/India/WD-Role-${index + 20}_JR${index + 20}`,
      locationsText: "India",
      bulletFields: [`JR${index + 20}`],
    })),
  };
  const calls = stubFetch((url, init) => {
    if (url.endsWith("/jobs")) {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return { body: JSON.stringify(body.offset === 0 ? pageOne : pageTwo) };
    }
    return {
      body: JSON.stringify({ jobPostingInfo: { jobDescription: "<p>Detailed description</p>" } }),
    };
  });

  const posts = await workdayFetcher.fetch(
    source({ url: "https://fixture.wd5.myworkdayjobs.com/FixtureCareers", platform: "workday" }),
  );

  assert.equal(posts.length, 30);
  assert.ok(posts.length <= WORKDAY_MAX_JOBS_PER_FETCH);
  assert.equal(posts[0]?.externalId, "JR0");
  assert.match(posts[0]?.rawText ?? "", /Detailed description/);
  assert.ok(calls.some((url) => url.includes("/wday/cxs/fixture/FixtureCareers/job/")));
});

test("workday malformed response fails cleanly", async () => {
  stubFetch([{ body: JSON.stringify({ unexpected: true }) }]);
  const posts = await workdayFetcher.fetch(
    source({ url: "https://fixture.wd5.myworkdayjobs.com/FixtureCareers", platform: "workday" }),
  );
  assert.deepEqual(posts, []);
});

test("smartrecruiters adapter parses postings with detail enrichment", async () => {
  const calls = stubFetch((url) => {
    if (url.includes("/postings?")) {
      return {
        body: JSON.stringify({
          totalFound: 2,
          content: [
            {
              id: "p1",
              name: "Graduate Engineer",
              releasedDate: "2026-10-01T00:00:00Z",
              location: { city: "Bengaluru", country: "India" },
              department: { label: "Engineering" },
            },
            {
              id: "p2",
              name: "Analyst",
              releasedDate: "2026-09-01T00:00:00Z",
              location: { city: "Pune", country: "India" },
            },
          ],
        }),
      };
    }
    return {
      body: JSON.stringify({
        jobAd: { sections: { jobDescription: { text: "<p>Job details</p>" } } },
      }),
    };
  });

  const posts = await smartRecruitersFetcher.fetch(
    source({ url: "https://jobs.smartrecruiters.com/FixtureCo", platform: "smartrecruiters" }),
  );

  assert.equal(posts.length, 2);
  assert.equal(posts[0]?.externalId, "p1");
  assert.equal(posts[0]?.rawUrl, "https://jobs.smartrecruiters.com/FixtureCo/p1");
  assert.match(posts[0]?.rawText ?? "", /Bengaluru/);
  assert.match(posts[0]?.rawText ?? "", /Job details/);
  assert.ok(calls.length >= 2);
});

test("http helper surfaces timeouts and http errors", async () => {
  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      });
    })) as typeof fetch;
  await assert.rejects(() => fetchJson("https://slow.example.com", 50), /timed out/);

  stubFetch([{ status: 429, body: "{}" }]);
  await assert.rejects(() => fetchJson("https://rate.example.com"), /429/);

  stubFetch([{ status: 503, body: "{}" }]);
  await assert.rejects(() => fetchJson("https://down.example.com"), /503/);
});

test("registry maps supported platforms and rejects unknown ones", () => {
  assert.ok(getFetcherForSource(source({ url: "https://jobs.lever.co/x", platform: "lever" })));
  assert.ok(getFetcherForSource(source({ url: "https://example.com/feed", platform: "rss" })));
  assert.ok(
    getFetcherForSource(
      source({ url: "https://x.wd5.myworkdayjobs.com/Site", platform: "workday" }),
    ),
  );
  assert.ok(
    getFetcherForSource(
      source({ url: "https://jobs.smartrecruiters.com/X", platform: "smartrecruiters" }),
    ),
  );
  assert.equal(
    getFetcherForSource(source({ url: "https://example.com", platform: "manual" })),
    null,
  );
  assert.equal(getFetcherForSource(source({ url: "https://example.com", platform: null })), null);
});
