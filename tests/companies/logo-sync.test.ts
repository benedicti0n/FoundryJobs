import assert from "node:assert/strict";
import test, { after } from "node:test";
import { like, or } from "drizzle-orm";
import {
  companies,
  createSource,
  getCompanyBrandingByName,
  getDatabase,
  parseAshbyLogoUrl,
  sources,
  syncCompanyLogos,
} from "@foundryjobs/db";
import { closeTestDatabase } from "../helpers/test-db";

after(async () => {
  const database = getDatabase();
  await database
    .delete(companies)
    .where(
      or(
        like(companies.name, "Fixture Logo Co%"),
        like(companies.name, "Bad Logo Co%"),
        like(companies.name, "Shared One%"),
        like(companies.name, "Shared Two%"),
      ),
    );
  await database
    .delete(sources)
    .where(
      or(
        like(sources.name, "Fixture Logo Co%"),
        like(sources.name, "Bad Logo Co%"),
        like(sources.name, "Shared One%"),
        like(sources.name, "Shared Two%"),
      ),
    );
  await closeTestDatabase();
});

function uniqueResolver(source: { companyName: string }): Promise<string | null> {
  const slug = source.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return Promise.resolve(`https://cdn.example.com/${slug}.png`);
}

const okValidator = async () => ({ ok: true });

test("ashby logo extraction prefers apple-touch-icon", () => {
  const html = `<link href="https://cdn.ashbyprd.com/cdn_assets/abc123/favicon.png"><link href="https://cdn.ashbyprd.com/cdn_assets/abc123/apple-touch-icon.png">`;
  assert.equal(
    parseAshbyLogoUrl(html),
    "https://cdn.ashbyprd.com/cdn_assets/abc123/apple-touch-icon.png",
  );
  assert.equal(parseAshbyLogoUrl("<html>no logos</html>"), null);
});

test("logo sync dry-run resolves without persisting", async () => {
  await createSource({
    name: "Fixture Logo Co (Ashby)",
    type: "ats",
    platform: "ashby",
    url: "https://jobs.ashbyhq.com/fixture-logo-co",
  });
  const report = await syncCompanyLogos({
    dryRun: true,
    deps: { resolver: uniqueResolver, validator: okValidator },
  });
  assert.ok(report.resolved >= 1);
  assert.ok(report.updated >= 1);
  assert.equal(await getCompanyBrandingByName("Fixture Logo Co"), null);
});

test("logo sync apply persists and is idempotent", async () => {
  const report = await syncCompanyLogos({
    deps: { resolver: uniqueResolver, validator: okValidator },
  });
  assert.ok(report.resolved >= 1);
  const company = await getCompanyBrandingByName("Fixture Logo Co");
  assert.equal(company?.logoUrl, "https://cdn.example.com/fixture-logo-co.png");

  const second = await syncCompanyLogos({
    deps: {
      resolver: async () => {
        throw new Error("resolver must not run for unchanged logos");
      },
      validator: okValidator,
    },
  });
  assert.ok(second.unchanged >= 1);
});

test("invalid logos are not persisted", async () => {
  await createSource({
    name: "Bad Logo Co (Ashby)",
    type: "ats",
    platform: "ashby",
    url: "https://jobs.ashbyhq.com/bad-logo-co",
  });
  const report = await syncCompanyLogos({
    deps: {
      resolver: async (source) =>
        source.companyName === "Bad Logo Co"
          ? "https://cdn.example.com/broken.png"
          : uniqueResolver(source),
      validator: async (url) =>
        url.includes("broken") ? { ok: false, reason: "404" } : { ok: true },
    },
  });
  assert.ok(report.invalid >= 1);
  assert.equal(await getCompanyBrandingByName("Bad Logo Co"), null);
});

test("shared platform default assets are treated as unresolved", async () => {
  await createSource({
    name: "Shared One (Ashby)",
    type: "ats",
    platform: "ashby",
    url: "https://jobs.ashbyhq.com/shared-one",
  });
  await createSource({
    name: "Shared Two (Ashby)",
    type: "ats",
    platform: "ashby",
    url: "https://jobs.ashbyhq.com/shared-two",
  });
  const shared = "https://cdn.ashbyprd.com/cdn_assets/abc123/apple-touch-icon.png";
  const report = await syncCompanyLogos({
    deps: { resolver: async () => shared, validator: okValidator },
  });
  assert.equal(report.resolved, 0);
  assert.ok(report.entries.some((entry) => entry.reason?.includes("shared platform default")));
});
