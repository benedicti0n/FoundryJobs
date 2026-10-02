"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { publishGeneratedPost, type PublishChannel } from "@/lib/api";

const GENERATED_POSTS_PATH = "/generated-posts";

function redirectWithMessage(params: { message?: string; error?: string }): never {
  const search = new URLSearchParams();
  if (params.message) {
    search.set("message", params.message);
  }
  if (params.error) {
    search.set("error", params.error);
  }
  redirect(`${GENERATED_POSTS_PATH}?${search.toString()}`);
}

async function runPublishAction(formData: FormData, channel: PublishChannel): Promise<void> {
  const generatedPostId = String(formData.get("generatedPostId") ?? "").trim();
  if (generatedPostId.length === 0) {
    redirectWithMessage({ error: "Missing generated post id" });
  }

  let outcome: { message?: string; error?: string };
  try {
    const result = await publishGeneratedPost(generatedPostId, channel);
    const linkPart = result.publishedUrl ? ` (${result.publishedUrl})` : "";
    if (result.status === "published") {
      outcome = { message: `Published successfully${linkPart}` };
    } else if (result.status === "skipped") {
      outcome = { error: result.errorMessage ?? "Publish skipped" };
    } else {
      outcome = { error: result.errorMessage ?? "Publish failed" };
    }
  } catch (error) {
    outcome = { error: error instanceof Error ? error.message : "Publish action failed" };
  }

  revalidatePath(GENERATED_POSTS_PATH);
  redirectWithMessage(outcome);
}

export async function publishTelegramAction(formData: FormData): Promise<void> {
  await runPublishAction(formData, "telegram");
}

export async function publishBufferAction(formData: FormData): Promise<void> {
  await runPublishAction(formData, "buffer");
}
