import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { createJobScore, listGeneratedPosts } from "@foundryjobs/db";
import { FEATURE_X_PUBLISHING_ENV_VAR } from "@foundryjobs/shared";
import { generatePostsForJob, generatePostsForSelection } from "@foundryjobs/post-generator";
import { closeTestDatabase, createFixtureJob, createFixturePost } from "../helpers/test-db";

after(async () => {
  await closeTestDatabase();
});

beforeEach(() => {
  delete process.env[FEATURE_X_PUBLISHING_ENV_VAR];
});

async function scoredJob(): Promise<string> {
  const job = await createFixtureJob();
  await createJobScore(job.id, {
    freshnessScore: 20,
    fresherFitScore: 20,
    techRelevanceScore: 15,
    trustScore: 15,
    remoteBonus: 5,
    clarityScore: 5,
    totalScore: 80,
    spamRisk: "low",
    shouldPost: true,
    reason: "test",
  });
  return job.id;
}

test("platform-specific generation creates only the requested platform", async () => {
  const jobPostId = await scoredJob();

  const result = await generatePostsForJob(jobPostId, { platforms: ["telegram"] });
  assert.equal(result.status, "generated");
  assert.equal(result.generatedCount, 1);

  const posts = await listGeneratedPosts({ jobPostId, limit: 10 });
  assert.deepEqual(
    posts.map((post) => post.platform),
    ["telegram"],
  );
});

test("platform-specific generation is idempotent for the same platform", async () => {
  const jobPostId = await scoredJob();

  await generatePostsForJob(jobPostId, { platforms: ["telegram"] });
  const second = await generatePostsForJob(jobPostId, { platforms: ["telegram"] });

  assert.equal(second.status, "skipped");
  assert.match(second.skippedReason ?? "", /already exist/);
  assert.equal((await listGeneratedPosts({ jobPostId, limit: 10 })).length, 1);
});

test("default generation creates telegram and instagram only when X is disabled", async () => {
  const jobPostId = await scoredJob();

  const result = await generatePostsForJob(jobPostId);
  assert.equal(result.status, "generated");

  const platforms = (await listGeneratedPosts({ jobPostId, limit: 10 }))
    .map((post) => post.platform)
    .sort();
  assert.deepEqual(platforms, ["instagram", "telegram"]);
});

test("default generation includes X when the feature flag is enabled", async () => {
  process.env[FEATURE_X_PUBLISHING_ENV_VAR] = "true";
  const jobPostId = await scoredJob();

  const result = await generatePostsForJob(jobPostId);
  assert.equal(result.status, "generated");

  const platforms = (await listGeneratedPosts({ jobPostId, limit: 10 }))
    .map((post) => post.platform)
    .sort();
  assert.deepEqual(platforms, ["instagram", "telegram", "x"]);
  delete process.env[FEATURE_X_PUBLISHING_ENV_VAR];
});

test("selection-driven generation maps telegram picks and media picks to the right platforms", async () => {
  const telegramJob = await scoredJob();
  const mediaJob = await scoredJob();

  const results = await generatePostsForSelection({
    telegramJobIds: [telegramJob],
    mediaJobIds: [mediaJob],
  });
  assert.equal(results.length, 2);

  assert.deepEqual(
    (await listGeneratedPosts({ jobPostId: telegramJob, limit: 10 })).map((post) => post.platform),
    ["telegram"],
  );
  assert.deepEqual(
    (await listGeneratedPosts({ jobPostId: mediaJob, limit: 10 })).map((post) => post.platform),
    ["instagram"],
  );
});

test("a job selected for both telegram and media gets both platform drafts", async () => {
  const jobPostId = await scoredJob();

  await generatePostsForSelection({ telegramJobIds: [jobPostId], mediaJobIds: [jobPostId] });

  const platforms = (await listGeneratedPosts({ jobPostId, limit: 10 }))
    .map((post) => post.platform)
    .sort();
  assert.deepEqual(platforms, ["instagram", "telegram"]);
});

test("existing rejected posts do not block regeneration of that platform", async () => {
  const jobPostId = await scoredJob();
  await createFixturePost({
    jobPostId,
    platform: "telegram",
    status: "rejected",
    textContent: "old rejected draft",
  });

  const result = await generatePostsForJob(jobPostId, { platforms: ["telegram"] });
  assert.equal(result.status, "generated");
  assert.equal(result.generatedCount, 1);
});

test("instagram drafts receive a trigger keyword and SuperProfile state", async () => {
  const jobPostId = await scoredJob();

  await generatePostsForJob(jobPostId, { platforms: ["instagram"] });

  const [post] = await listGeneratedPosts({ jobPostId, limit: 10 });
  assert.ok(post);
  assert.equal(post.platform, "instagram");
  assert.ok(post.triggerKeyword && post.triggerKeyword.length > 0);
  assert.equal(post.triggerKeyword, post.triggerKeyword.toUpperCase());
  assert.equal(post.automationStatus, "not_provisioned");
  assert.equal(post.automationId, null);
});

test("trigger keywords stay unique across active instagram drafts", async () => {
  const first = await scoredJob();
  const second = await scoredJob();

  await generatePostsForJob(first, { platforms: ["instagram"] });
  await generatePostsForJob(second, { platforms: ["instagram"] });

  const keywords = [
    ...(await listGeneratedPosts({ jobPostId: first, limit: 10 })),
    ...(await listGeneratedPosts({ jobPostId: second, limit: 10 })),
  ].map((post) => post.triggerKeyword);
  assert.equal(new Set(keywords).size, 2);
});
