import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createRawPostIfNotExists, createSource } from "@foundryjobs/db";
import { closeTestDatabase } from "../helpers/test-db";

after(async () => {
  await closeTestDatabase();
});

test("raw post dedupe rejects the same url across different sources", async () => {
  const sourceA = await createSource({
    name: "Dedupe Direct ATS",
    type: "ats",
    platform: "greenhouse",
    url: "https://boards.greenhouse.io/dedupe-direct",
    category: "big_tech",
  });
  const sourceB = await createSource({
    name: "Dedupe Aggregator",
    type: "rss",
    platform: "rss",
    url: "https://example.com/dedupe-feed.xml",
    category: "remote",
  });

  const first = await createRawPostIfNotExists({
    sourceId: sourceA.id,
    rawUrl: "https://boards.greenhouse.io/dedupe-direct/jobs/123",
    rawText: "Title: Backend Engineer\nCompany: Dedupe Direct ATS",
  });
  assert.equal(first.inserted, true);

  const duplicateUrl = await createRawPostIfNotExists({
    sourceId: sourceB.id,
    rawUrl: "https://boards.greenhouse.io/dedupe-direct/jobs/123",
    rawText: "Title: Backend Engineer (aggregator copy)",
  });
  assert.equal(duplicateUrl.inserted, false, "same canonical url must not be inserted twice");

  const duplicateContent = await createRawPostIfNotExists({
    sourceId: sourceA.id,
    rawUrl: "https://boards.greenhouse.io/dedupe-direct/jobs/999",
    rawText: "Title: Backend Engineer\nCompany: Dedupe Direct ATS",
  });
  assert.equal(duplicateContent.inserted, false, "same content hash must not be inserted twice");

  const distinct = await createRawPostIfNotExists({
    sourceId: sourceA.id,
    rawUrl: "https://boards.greenhouse.io/dedupe-direct/jobs/124",
    rawText: "Title: Frontend Engineer\nCompany: Dedupe Direct ATS",
  });
  assert.equal(distinct.inserted, true);
});
