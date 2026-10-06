import assert from "node:assert/strict";
import test, { after } from "node:test";
import {
  SOURCE_MANIFEST,
  createSource,
  listSources,
  syncSources,
  validateManifest,
  type SourceDefinition,
} from "@foundryjobs/db";
import { closeTestDatabase } from "../helpers/test-db";

after(async () => {
  await closeTestDatabase();
});

test("manifest is valid and contains no demo or placeholder sources", () => {
  assert.deepEqual(validateManifest(SOURCE_MANIFEST), []);

  const urls = SOURCE_MANIFEST.map((entry) => entry.url).join(" ");
  assert.doesNotMatch(urls, /acmecorp|example\.com|leverdemo|manual-submissions/);

  const categories = new Set(SOURCE_MANIFEST.map((entry) => entry.category));
  for (const category of ["big_tech", "startup", "yc", "remote", "mass_hiring"]) {
    assert.ok(categories.has(category as never), `expected category ${category}`);
  }

  assert.ok(SOURCE_MANIFEST.every((entry) => entry.isActive));
  assert.ok(SOURCE_MANIFEST.length >= 25 && SOURCE_MANIFEST.length <= 80);
});

test("manifest validation rejects duplicate slugs and urls", () => {
  const base: SourceDefinition = {
    slug: "dup",
    name: "Dup",
    type: "ats",
    platform: "greenhouse",
    url: "https://boards.greenhouse.io/dup",
    atsType: "greenhouse",
    category: "startup",
    region: "global",
    priority: "normal",
    trustLevel: 80,
    fetchIntervalMinutes: 60,
    isActive: true,
  };

  const duplicateSlug = validateManifest([
    base,
    { ...base, url: "https://boards.greenhouse.io/dup2" },
  ]);
  assert.ok(duplicateSlug.some((error) => error.includes("duplicate source slug")));

  const duplicateUrl = validateManifest([base, { ...base, slug: "dup2" }]);
  assert.ok(duplicateUrl.some((error) => error.includes("duplicate canonical url")));
});

test("sync dry-run reports changes without touching the database", async () => {
  const stray = await createSource({
    name: "Acme Corp (Greenhouse)",
    type: "ats",
    platform: "greenhouse",
    url: "https://boards.greenhouse.io/acmecorp-dryrun",
  });
  assert.equal(stray.isActive, true);

  const manifest: SourceDefinition[] = [
    {
      slug: "dryrun-new",
      name: "Dry Run New",
      type: "ats",
      platform: "greenhouse",
      url: "https://boards.greenhouse.io/dryrun-new",
      atsType: "greenhouse",
      category: "startup",
      region: "global",
      priority: "normal",
      trustLevel: 80,
      fetchIntervalMinutes: 60,
      isActive: true,
    },
  ];

  const result = await syncSources({ dryRun: true, manifest });

  assert.deepEqual(result.added, ["dryrun-new"]);
  assert.ok(
    result.deactivated.includes(stray.url),
    "stray demo source must be scheduled for deactivation",
  );

  const afterDryRun = await listSources({ limit: 200 });
  assert.equal(
    afterDryRun.find((source) => source.url === manifest[0]?.url),
    undefined,
  );
  assert.equal(afterDryRun.find((source) => source.url === stray.url)?.isActive, true);
});

test("sync applies adds, updates, deactivations and is idempotent", async () => {
  const stray = await createSource({
    name: "Lever Demo",
    type: "ats",
    platform: "lever",
    url: "https://jobs.lever.co/leverdemo-sync-test",
  });

  const manifest: SourceDefinition[] = [
    {
      slug: "sync-test",
      name: "Sync Test Co",
      type: "ats",
      platform: "ashby",
      url: "https://jobs.ashbyhq.com/sync-test",
      atsType: "ashby",
      category: "yc",
      region: "india",
      priority: "high",
      trustLevel: 80,
      fetchIntervalMinutes: 60,
      isActive: true,
    },
  ];

  const before = (await listSources({ limit: 200 })).length;
  const first = await syncSources({ manifest });
  assert.deepEqual(first.added, ["sync-test"]);
  assert.ok(first.deactivated.includes(stray.url), "stray demo source must be deactivated");

  const created = (await listSources({ limit: 200 })).find(
    (source) => source.url === manifest[0]?.url,
  );
  assert.ok(created);
  assert.equal(created.category, "yc");
  assert.equal(created.region, "india");
  assert.equal(created.priority, "high");
  assert.equal(
    (await listSources({ limit: 200 })).find((s) => s.url === stray.url)?.isActive,
    false,
  );

  const second = await syncSources({ manifest });
  assert.deepEqual(second.added, []);
  assert.deepEqual(second.updated, []);
  assert.deepEqual(second.deactivated, []);
  assert.deepEqual(second.unchanged, ["sync-test"]);

  const after = (await listSources({ limit: 200 })).length;
  assert.equal(after, before + 1, "sync must not delete rows");
});
