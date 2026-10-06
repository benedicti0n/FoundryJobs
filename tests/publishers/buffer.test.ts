import assert from "node:assert/strict";
import test, { after } from "node:test";
import { applyApprovalAction, recordPublishSuccess } from "@foundryjobs/db";
import { BUFFER_CONFIG_ERROR, type BufferPublishOutcome } from "@foundryjobs/buffer";
import type { BufferPlatform } from "@foundryjobs/shared";
import { publishBufferGeneratedPost } from "@foundryjobs/buffer-publisher";
import {
  closeTestDatabase,
  createFixtureJob,
  createFixturePost,
  getFixturePost,
  getFixturePublishEvents,
} from "../helpers/test-db";

process.env.BUFFER_ACCESS_TOKEN = "test-buffer-token";
process.env.BUFFER_PROFILE_ID_X = "test-buffer-profile-x";
delete process.env.BUFFER_PROFILE_ID_INSTAGRAM;
delete process.env.BUFFER_PROFILE_ID_LINKEDIN;

after(async () => {
  await closeTestDatabase();
});

type FakeBufferProviders = {
  publishText: (platform: BufferPlatform, text: string) => Promise<BufferPublishOutcome>;
  publishImage: (
    platform: BufferPlatform,
    text: string,
    imageUrl: string,
  ) => Promise<BufferPublishOutcome>;
  textCalls: Array<{ platform: BufferPlatform; text: string }>;
  imageCalls: Array<{ platform: BufferPlatform; text: string; imageUrl: string }>;
};

function createFakeProviders(options: { failWith?: string } = {}): FakeBufferProviders {
  const textCalls: Array<{ platform: BufferPlatform; text: string }> = [];
  const imageCalls: Array<{ platform: BufferPlatform; text: string; imageUrl: string }> = [];
  const outcome = (platform: BufferPlatform): BufferPublishOutcome => ({
    externalPostId: `buffer-${platform}-1`,
    publishedUrl: `https://buffer.test/${platform}/1`,
  });
  return {
    textCalls,
    imageCalls,
    publishText: async (platform, text) => {
      textCalls.push({ platform, text });
      if (options.failWith) {
        throw new Error(options.failWith);
      }
      return outcome(platform);
    },
    publishImage: async (platform, text, imageUrl) => {
      imageCalls.push({ platform, text, imageUrl });
      if (options.failWith) {
        throw new Error(options.failWith);
      }
      return outcome(platform);
    },
  };
}

test("approved x posts route to the buffer text provider exactly once", async () => {
  const job = await createFixtureJob();
  const post = await createFixturePost({ jobPostId: job.id, platform: "x", status: "approved" });
  const fake = createFakeProviders();

  const result = await publishBufferGeneratedPost(post.id, {
    publishText: fake.publishText,
    publishImage: fake.publishImage,
  });

  assert.equal(result.status, "published");
  assert.equal(result.platform, "x");
  assert.equal(fake.textCalls.length, 1);
  assert.equal(fake.textCalls[0]?.platform, "x");
  assert.equal(fake.imageCalls.length, 0);

  const stored = await getFixturePost(post.id);
  assert.equal(stored?.status, "published");
  const events = await getFixturePublishEvents(post.id);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.platform, "x");
  assert.equal(events[0]?.externalPostId, "buffer-x-1");
  assert.equal(events[0]?.publishedUrl, "https://buffer.test/x/1");
  assert.ok(events[0]?.publishedAt);

  const replay = await publishBufferGeneratedPost(post.id, {
    publishText: fake.publishText,
    publishImage: fake.publishImage,
  });
  assert.equal(replay.status, "skipped");
  assert.equal(fake.textCalls.length, 1, "replays must not reach the provider");
});

test("a successful publish event blocks buffer republishing after re-approval", async () => {
  const job = await createFixtureJob();
  const post = await createFixturePost({ jobPostId: job.id, platform: "x" });

  await recordPublishSuccess({
    platform: "x",
    jobPostId: job.id,
    generatedPostId: post.id,
    externalPostId: "buffer-x-existing",
    publishedUrl: "https://buffer.test/x/existing",
  });
  await applyApprovalAction(post.id, { decision: "approved", decidedBy: "test" });

  const fake = createFakeProviders();
  const result = await publishBufferGeneratedPost(post.id, {
    publishText: fake.publishText,
    publishImage: fake.publishImage,
  });

  assert.equal(result.status, "skipped");
  assert.match(result.errorMessage ?? "", /successful publish event already exists/);
  assert.equal(fake.textCalls.length, 0);
  assert.equal(fake.imageCalls.length, 0);
});

test("ineligible statuses never reach buffer providers", async () => {
  const fake = createFakeProviders();
  for (const status of ["draft", "rejected", "failed", "published"] as const) {
    const job = await createFixtureJob();
    const post = await createFixturePost({ jobPostId: job.id, platform: "x", status });
    const result = await publishBufferGeneratedPost(post.id, {
      publishText: fake.publishText,
      publishImage: fake.publishImage,
    });
    assert.equal(result.status, "skipped");
  }
  assert.equal(fake.textCalls.length, 0);
  assert.equal(fake.imageCalls.length, 0);
});

test("telegram posts cannot fall through to buffer", async () => {
  const job = await createFixtureJob();
  const post = await createFixturePost({
    jobPostId: job.id,
    platform: "telegram",
    status: "approved",
  });
  const fake = createFakeProviders();

  const result = await publishBufferGeneratedPost(post.id, {
    publishText: fake.publishText,
    publishImage: fake.publishImage,
  });

  assert.equal(result.status, "skipped");
  assert.match(result.errorMessage ?? "", /handled by the Telegram pipeline/);
  assert.equal(fake.textCalls.length, 0);
  assert.equal(fake.imageCalls.length, 0);
});

test("unconfigured instagram and linkedin fail closed without provider calls", async () => {
  const job = await createFixtureJob();
  const instagram = await createFixturePost({
    jobPostId: job.id,
    platform: "instagram",
    status: "approved",
    imageUrl: "https://cdn.test/instagram-card.png",
  });
  const linkedin = await createFixturePost({
    jobPostId: job.id,
    platform: "linkedin",
    status: "approved",
  });
  const fake = createFakeProviders();

  const instagramResult = await publishBufferGeneratedPost(instagram.id, {
    publishText: fake.publishText,
    publishImage: fake.publishImage,
  });
  assert.equal(instagramResult.status, "failed");
  assert.equal(instagramResult.errorMessage, BUFFER_CONFIG_ERROR);

  const linkedinResult = await publishBufferGeneratedPost(linkedin.id, {
    publishText: fake.publishText,
    publishImage: fake.publishImage,
  });
  assert.equal(linkedinResult.status, "failed");
  assert.equal(linkedinResult.errorMessage, BUFFER_CONFIG_ERROR);

  assert.equal(fake.textCalls.length, 0);
  assert.equal(fake.imageCalls.length, 0);
});

test("instagram posts with local or missing images are rejected before config checks", async () => {
  const job = await createFixtureJob();
  const localImage = await createFixturePost({
    jobPostId: job.id,
    platform: "instagram",
    status: "approved",
    imageUrl: "/generated/instagram-cards/instagram-card-test.png",
  });
  const noImage = await createFixturePost({
    jobPostId: job.id,
    platform: "instagram",
    status: "approved",
    imageUrl: null,
  });
  const fake = createFakeProviders();

  const localResult = await publishBufferGeneratedPost(localImage.id, {
    publishText: fake.publishText,
    publishImage: fake.publishImage,
  });

  assert.equal(localResult.status, "skipped");
  assert.match(localResult.errorMessage ?? "", /upload the card to R2/);

  const noImageResult = await publishBufferGeneratedPost(noImage.id, {
    publishText: fake.publishText,
    publishImage: fake.publishImage,
  });

  assert.equal(noImageResult.status, "skipped");
  assert.match(noImageResult.errorMessage ?? "", /requires a public image URL/);
  assert.equal(fake.imageCalls.length, 0);
});

test("buffer provider failure records a failed event and stays retryable", async () => {
  const job = await createFixtureJob();
  const post = await createFixturePost({ jobPostId: job.id, platform: "x", status: "approved" });
  const failing = createFakeProviders({ failWith: "buffer provider exploded" });

  const result = await publishBufferGeneratedPost(post.id, {
    publishText: failing.publishText,
    publishImage: failing.publishImage,
  });

  assert.equal(result.status, "failed");
  assert.match(result.errorMessage ?? "", /buffer provider exploded/);
  assert.equal((await getFixturePost(post.id))?.status, "failed");

  const events = await getFixturePublishEvents(post.id);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.status, "failed");
  assert.equal(events[0]?.publishedAt, null);
  assert.match(events[0]?.errorMessage ?? "", /buffer provider exploded/);

  await applyApprovalAction(post.id, { decision: "approved", decidedBy: "test" });
  const retry = createFakeProviders();
  const retryResult = await publishBufferGeneratedPost(post.id, {
    publishText: retry.publishText,
    publishImage: retry.publishImage,
  });
  assert.equal(retryResult.status, "published");
  assert.equal(retry.textCalls.length, 1);
});
