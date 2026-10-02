import { uploadInstagramCard } from "@foundryjobs/card-uploader";
import {
  closeDatabase,
  listApprovedBufferPostsReadyToPublish,
  listApprovedTelegramPostsReadyToPublish,
  listInstagramCardsNeedingUpload,
} from "@foundryjobs/db";
import { publishBufferGeneratedPost } from "@foundryjobs/buffer-publisher";
import { publishTelegramGeneratedPost } from "@foundryjobs/publisher";
import { isEnvSet } from "@foundryjobs/shared";

const LIVE_CONFIRMATION_ERROR =
  "Live integration tests are disabled. Set LIVE_INTEGRATION_TESTS=true to run this command.";

const R2_ENV_VARS = [
  "DATABASE_URL",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_BASE_URL",
] as const;

function confirmLiveTests(): boolean {
  if ((process.env.LIVE_INTEGRATION_TESTS ?? "").toLowerCase() !== "true") {
    console.error(LIVE_CONFIRMATION_ERROR);
    process.exitCode = 1;
    return false;
  }
  return true;
}

function requireEnvVars(names: readonly string[]): boolean {
  const missing = names.filter((name) => !isEnvSet(name));
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    process.exitCode = 1;
    return false;
  }
  return true;
}

export async function runTelegramLiveTest(): Promise<void> {
  if (!confirmLiveTests()) {
    return;
  }
  if (!requireEnvVars(["DATABASE_URL", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"])) {
    return;
  }

  try {
    console.log("Live Telegram test: publishing exactly one approved Telegram draft.");
    const ready = await listApprovedTelegramPostsReadyToPublish(1);
    const post = ready[0];
    if (!post) {
      console.error("No approved Telegram generated post is ready to publish.");
      process.exitCode = 1;
      return;
    }

    console.log(`Selected generatedPostId: ${post.generatedPostId}`);
    const result = await publishTelegramGeneratedPost(post.generatedPostId);
    console.log(`Result: ${JSON.stringify(result)}`);

    if (result.status !== "published") {
      process.exitCode = 1;
    }
  } finally {
    await closeDatabase();
  }
}

export async function runR2LiveTest(): Promise<void> {
  if (!confirmLiveTests()) {
    return;
  }
  if (!requireEnvVars(R2_ENV_VARS)) {
    return;
  }

  try {
    console.log("Live R2 test: uploading exactly one local Instagram card.");
    const cards = await listInstagramCardsNeedingUpload(1);
    const card = cards[0];
    if (!card) {
      console.error("No Instagram generated post with a local image is ready to upload.");
      process.exitCode = 1;
      return;
    }

    console.log(`Selected generatedPostId: ${card.generatedPostId}`);
    const result = await uploadInstagramCard(card.generatedPostId);
    console.log(`Result: ${JSON.stringify(result)}`);

    if (result.status !== "uploaded") {
      process.exitCode = 1;
    }
  } finally {
    await closeDatabase();
  }
}

export async function runBufferLiveTest(): Promise<void> {
  if (!confirmLiveTests()) {
    return;
  }

  const platform = (process.env.BUFFER_TEST_PLATFORM ?? "x").toLowerCase();
  if (platform !== "x" && platform !== "instagram") {
    console.error('BUFFER_TEST_PLATFORM must be "x" or "instagram".');
    process.exitCode = 1;
    return;
  }

  const profileEnvVar =
    platform === "instagram" ? "BUFFER_PROFILE_ID_INSTAGRAM" : "BUFFER_PROFILE_ID_X";
  if (!requireEnvVars(["DATABASE_URL", "BUFFER_ACCESS_TOKEN", profileEnvVar])) {
    return;
  }

  try {
    console.log(
      `Live Buffer test: publishing exactly one approved ${platform} draft through Buffer.`,
    );
    const ready = await listApprovedBufferPostsReadyToPublish(200);
    const post = ready.find((candidate) => candidate.platform === platform);
    if (!post) {
      console.error(`No approved ${platform} generated post is ready to publish.`);
      process.exitCode = 1;
      return;
    }

    console.log(`Selected generatedPostId: ${post.generatedPostId}`);
    const result = await publishBufferGeneratedPost(post.generatedPostId);
    console.log(`Result: ${JSON.stringify(result)}`);

    if (result.status !== "published") {
      process.exitCode = 1;
    }
  } finally {
    await closeDatabase();
  }
}
