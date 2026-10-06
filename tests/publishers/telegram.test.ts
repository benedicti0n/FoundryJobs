import assert from "node:assert/strict";
import test, { after } from "node:test";
import { applyApprovalAction, recordPublishSuccess } from "@foundryjobs/db";
import type { PublishableGeneratedPostDto } from "@foundryjobs/shared";
import type { TelegramPublishOutcome } from "@foundryjobs/telegram";
import { publishTelegramGeneratedPost } from "@foundryjobs/publisher";
import {
  closeTestDatabase,
  createFixtureJob,
  createFixturePost,
  getFixturePost,
  getFixturePublishEvents,
} from "../helpers/test-db";

process.env.TELEGRAM_BOT_TOKEN = "test-telegram-token";
process.env.TELEGRAM_CHAT_ID = "test-telegram-chat";

after(async () => {
  await closeTestDatabase();
});

type FakeTelegramProvider = {
  provider: (post: PublishableGeneratedPostDto) => Promise<TelegramPublishOutcome>;
  calls: () => number;
  posts: PublishableGeneratedPostDto[];
};

function createFakeProvider(options: { failWith?: string } = {}): FakeTelegramProvider {
  const posts: PublishableGeneratedPostDto[] = [];
  let calls = 0;
  return {
    provider: async (post) => {
      calls += 1;
      posts.push(post);
      if (options.failWith) {
        throw new Error(options.failWith);
      }
      return {
        result: {
          messageId: 4242,
          chatId: "test-telegram-chat",
          chatTitle: "Test Channel",
          chatUsername: "test_channel",
          date: Math.floor(Date.now() / 1000),
        },
        externalPostId: "4242",
        publishedUrl: "https://t.me/test_channel/4242",
      };
    },
    calls: () => calls,
    posts,
  };
}

for (const status of ["draft", "rejected", "failed", "published"] as const) {
  test(`${status} posts are not publishable via telegram`, async () => {
    const job = await createFixtureJob();
    const post = await createFixturePost({ jobPostId: job.id, platform: "telegram", status });
    const fake = createFakeProvider();

    const result = await publishTelegramGeneratedPost(post.id, { provider: fake.provider });

    assert.equal(result.status, "skipped");
    assert.equal(fake.calls(), 0, "provider must never be called for ineligible posts");
    assert.equal((await getFixturePost(post.id))?.status, status);
    assert.equal((await getFixturePublishEvents(post.id)).length, 0);
  });
}

test("approved telegram post publishes once and persists provider metadata", async () => {
  const job = await createFixtureJob();
  const post = await createFixturePost({
    jobPostId: job.id,
    platform: "telegram",
    status: "approved",
  });
  const fake = createFakeProvider();

  const result = await publishTelegramGeneratedPost(post.id, { provider: fake.provider });

  assert.equal(result.status, "published");
  assert.equal(result.externalPostId, "4242");
  assert.equal(result.publishedUrl, "https://t.me/test_channel/4242");
  assert.equal(fake.calls(), 1);

  const stored = await getFixturePost(post.id);
  assert.equal(stored?.status, "published");

  const events = await getFixturePublishEvents(post.id);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.status, "success");
  assert.equal(events[0]?.externalPostId, "4242");
  assert.equal(events[0]?.publishedUrl, "https://t.me/test_channel/4242");
  assert.ok(events[0]?.publishedAt);

  const replay = await publishTelegramGeneratedPost(post.id, { provider: fake.provider });
  assert.equal(replay.status, "skipped");
  assert.equal(fake.calls(), 1, "replays must not reach the provider");
  assert.equal((await getFixturePublishEvents(post.id)).length, 1);
});

test("an existing successful publish event blocks republishing even if status is approved again", async () => {
  const job = await createFixtureJob();
  const post = await createFixturePost({ jobPostId: job.id, platform: "telegram" });

  await recordPublishSuccess({
    platform: "telegram",
    jobPostId: job.id,
    generatedPostId: post.id,
    externalPostId: "111",
    publishedUrl: "https://t.me/test_channel/111",
  });
  await applyApprovalAction(post.id, { decision: "approved", decidedBy: "test" });
  assert.equal((await getFixturePost(post.id))?.status, "approved");

  const fake = createFakeProvider();
  const result = await publishTelegramGeneratedPost(post.id, { provider: fake.provider });

  assert.equal(result.status, "skipped");
  assert.match(result.errorMessage ?? "", /successful publish event already exists/);
  assert.equal(fake.calls(), 0, "the success event guard must run before the provider");
  assert.equal((await getFixturePublishEvents(post.id)).length, 1);
  assert.equal((await getFixturePost(post.id))?.status, "approved");
});

test("provider failure records a failed event and leaves the post retryable", async () => {
  const job = await createFixtureJob();
  const post = await createFixturePost({
    jobPostId: job.id,
    platform: "telegram",
    status: "approved",
  });
  const failing = createFakeProvider({ failWith: "telegram provider exploded" });

  const result = await publishTelegramGeneratedPost(post.id, { provider: failing.provider });

  assert.equal(result.status, "failed");
  assert.match(result.errorMessage ?? "", /telegram provider exploded/);
  assert.equal(failing.calls(), 1);

  const stored = await getFixturePost(post.id);
  assert.equal(stored?.status, "failed", "failed posts must not be marked published");

  const events = await getFixturePublishEvents(post.id);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.status, "failed");
  assert.equal(events[0]?.publishedAt, null);
  assert.match(events[0]?.errorMessage ?? "", /telegram provider exploded/);

  await applyApprovalAction(post.id, { decision: "approved", decidedBy: "test" });
  const retry = createFakeProvider();
  const retryResult = await publishTelegramGeneratedPost(post.id, { provider: retry.provider });
  assert.equal(retryResult.status, "published");
  assert.equal(retry.calls(), 1);
});

test("non-telegram platforms and unknown posts are skipped without provider calls", async () => {
  const job = await createFixtureJob();
  const xPost = await createFixturePost({ jobPostId: job.id, platform: "x", status: "approved" });
  const fake = createFakeProvider();

  const wrongPlatform = await publishTelegramGeneratedPost(xPost.id, { provider: fake.provider });
  assert.equal(wrongPlatform.status, "skipped");
  assert.match(wrongPlatform.errorMessage ?? "", /not supported for publishing/);

  const missing = await publishTelegramGeneratedPost("00000000-0000-4000-8000-000000000000", {
    provider: fake.provider,
  });
  assert.equal(missing.status, "skipped");
  assert.match(missing.errorMessage ?? "", /not found/);
  assert.equal(fake.calls(), 0);
});
