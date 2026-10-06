import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import {
  activeGeneratedPlatforms,
  FEATURE_X_PUBLISHING_ENV_VAR,
  isXpublishingEnabled,
} from "@foundryjobs/shared";
import { publishBufferGeneratedPost } from "@foundryjobs/buffer-publisher";
import { publishTelegramGeneratedPost } from "@foundryjobs/publisher";
import {
  closeTestDatabase,
  createFixtureJob,
  createFixturePost,
  getFixturePost,
} from "../helpers/test-db";

process.env.BUFFER_ACCESS_TOKEN = "test-buffer-token";
process.env.BUFFER_PROFILE_ID_X = "test-profile-x";
process.env.BUFFER_PROFILE_ID_INSTAGRAM = "test-profile-instagram";
process.env.TELEGRAM_BOT_TOKEN = "test-telegram-token";
process.env.TELEGRAM_CHAT_ID = "test-chat";

after(async () => {
  await closeTestDatabase();
});

beforeEach(() => {
  delete process.env[FEATURE_X_PUBLISHING_ENV_VAR];
});

function fakeBufferProviders() {
  const textCalls: string[] = [];
  const imageCalls: string[] = [];
  return {
    textCalls,
    imageCalls,
    publishText: async (platform: string) => {
      textCalls.push(platform);
      return { externalPostId: `buf-${platform}`, publishedUrl: `https://buffer.test/${platform}` };
    },
    publishImage: async (platform: string) => {
      imageCalls.push(platform);
      return { externalPostId: `buf-${platform}`, publishedUrl: `https://buffer.test/${platform}` };
    },
  };
}

test("X publishing flag defaults to false and active platforms exclude x", () => {
  assert.equal(isXpublishingEnabled({}), false);
  assert.deepEqual(activeGeneratedPlatforms({}), ["telegram", "instagram"]);
  assert.deepEqual(activeGeneratedPlatforms({ [FEATURE_X_PUBLISHING_ENV_VAR]: "true" }), [
    "telegram",
    "instagram",
    "x",
  ]);
});

test("X flag false: buffer publish skips with zero provider calls", async () => {
  const job = await createFixtureJob();
  const post = await createFixturePost({ jobPostId: job.id, platform: "x", status: "approved" });
  const fake = fakeBufferProviders();

  const result = await publishBufferGeneratedPost(post.id, {
    publishText: fake.publishText as never,
    publishImage: fake.publishImage as never,
  });

  assert.equal(result.status, "skipped");
  assert.match(result.errorMessage ?? "", /disabled/);
  assert.equal(fake.textCalls.length, 0);
  assert.equal(fake.imageCalls.length, 0);
  assert.equal((await getFixturePost(post.id))?.status, "approved");
});

test("X flag true: existing X behavior still works", async () => {
  process.env[FEATURE_X_PUBLISHING_ENV_VAR] = "true";
  const job = await createFixtureJob();
  const post = await createFixturePost({ jobPostId: job.id, platform: "x", status: "approved" });
  const fake = fakeBufferProviders();

  const result = await publishBufferGeneratedPost(post.id, {
    publishText: fake.publishText as never,
    publishImage: fake.publishImage as never,
  });

  assert.equal(result.status, "published");
  assert.equal(fake.textCalls.length, 1);
  assert.equal((await getFixturePost(post.id))?.status, "published");
  delete process.env[FEATURE_X_PUBLISHING_ENV_VAR];
});

test("X flag false does not affect Instagram publishing", async () => {
  const job = await createFixtureJob();
  const post = await createFixturePost({
    jobPostId: job.id,
    platform: "instagram",
    status: "approved",
    imageUrl: "https://cdn.test/card.png",
  });
  const fake = fakeBufferProviders();

  const result = await publishBufferGeneratedPost(post.id, {
    publishText: fake.publishText as never,
    publishImage: fake.publishImage as never,
  });

  assert.equal(result.status, "published");
  assert.equal(fake.imageCalls.length, 1);
});

test("X flag false does not affect Telegram publishing", async () => {
  const job = await createFixtureJob();
  const post = await createFixturePost({
    jobPostId: job.id,
    platform: "telegram",
    status: "approved",
  });
  let providerCalls = 0;

  const result = await publishTelegramGeneratedPost(post.id, {
    provider: async (publishable, options) => {
      providerCalls += 1;
      assert.equal(options?.logoUrl ?? null, null);
      return {
        result: {
          messageId: 1,
          chatId: "chat",
          chatTitle: null,
          chatUsername: "test_channel",
          date: null,
        },
        externalPostId: "1",
        publishedUrl: "https://t.me/test_channel/1",
        messageIds: [1],
      };
    },
  });

  assert.equal(result.status, "published");
  assert.equal(providerCalls, 1);
});

test("telegram publisher skips X-platform posts regardless of flag", async () => {
  const job = await createFixtureJob();
  const post = await createFixturePost({ jobPostId: job.id, platform: "x", status: "approved" });

  const result = await publishTelegramGeneratedPost(post.id, {
    provider: async () => {
      throw new Error("provider must not be called");
    },
  });

  assert.equal(result.status, "skipped");
});
