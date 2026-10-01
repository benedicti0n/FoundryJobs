import { stat } from "node:fs/promises";
import { getUploadableInstagramCard, updateGeneratedPostImageUrl } from "@foundryjobs/db";
import type { InstagramCardUploadResult } from "@foundryjobs/shared";
import { buildInstagramCardObjectKey, uploadFileToR2 } from "@foundryjobs/storage";
import { isLocalCardImageUrl, resolveLocalCardFilePath } from "./local-paths";

export async function uploadInstagramCard(
  generatedPostId: string,
): Promise<InstagramCardUploadResult> {
  try {
    const card = await getUploadableInstagramCard(generatedPostId);
    if (!card) {
      return {
        generatedPostId,
        jobPostId: null,
        status: "error",
        errorMessage: "Generated post not found",
      };
    }

    if (card.platform !== "instagram") {
      return {
        generatedPostId: card.generatedPostId,
        jobPostId: card.jobPostId,
        status: "skipped",
        localImageUrl: card.localImageUrl,
        errorMessage: `Platform ${card.platform} is not supported by the Instagram card uploader`,
      };
    }

    if (card.localImageUrl.length === 0) {
      return {
        generatedPostId: card.generatedPostId,
        jobPostId: card.jobPostId,
        status: "skipped",
        localImageUrl: null,
        errorMessage: "No local image URL",
      };
    }

    if (!isLocalCardImageUrl(card.localImageUrl)) {
      return {
        generatedPostId: card.generatedPostId,
        jobPostId: card.jobPostId,
        status: "skipped",
        localImageUrl: card.localImageUrl,
        errorMessage: "Image URL is already remote or unsupported",
      };
    }

    const localFilePath = resolveLocalCardFilePath(card.localImageUrl);
    if (!localFilePath) {
      return {
        generatedPostId: card.generatedPostId,
        jobPostId: card.jobPostId,
        status: "error",
        localImageUrl: card.localImageUrl,
        errorMessage: `Could not resolve a local file for ${card.localImageUrl}`,
      };
    }

    try {
      await stat(localFilePath);
    } catch {
      return {
        generatedPostId: card.generatedPostId,
        jobPostId: card.jobPostId,
        status: "error",
        localImageUrl: card.localImageUrl,
        errorMessage: `Local image file not found: ${localFilePath}`,
      };
    }

    const upload = await uploadFileToR2({
      localFilePath,
      key: buildInstagramCardObjectKey(card.generatedPostId),
      contentType: "image/png",
    });

    const updated = await updateGeneratedPostImageUrl(card.generatedPostId, upload.publicUrl);
    if (!updated) {
      return {
        generatedPostId: card.generatedPostId,
        jobPostId: card.jobPostId,
        status: "error",
        localImageUrl: card.localImageUrl,
        errorMessage: "Failed to update the generated post image URL",
      };
    }

    return {
      generatedPostId: card.generatedPostId,
      jobPostId: card.jobPostId,
      status: "uploaded",
      localImageUrl: card.localImageUrl,
      publicImageUrl: upload.publicUrl,
    };
  } catch (error) {
    return {
      generatedPostId,
      jobPostId: null,
      status: "error",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}
