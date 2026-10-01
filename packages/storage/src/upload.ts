import { readFile } from "node:fs/promises";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { StorageUploadResult } from "@foundryjobs/shared";
import { joinPublicUrl } from "./paths";
import { createR2Client, getR2Config } from "./r2-client";

export const R2_CACHE_CONTROL = "public, max-age=31536000, immutable";

export type UploadFileToR2Input = {
  localFilePath: string;
  key: string;
  contentType: string;
};

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return message.replace(/([?&][A-Za-z0-9_%-]+=[^&\s]*)/g, "").slice(0, 300);
}

export async function uploadFileToR2(input: UploadFileToR2Input): Promise<StorageUploadResult> {
  const config = getR2Config();
  const body = await readFile(input.localFilePath);
  const client = createR2Client(config);

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: input.key,
        Body: body,
        ContentType: input.contentType,
        CacheControl: R2_CACHE_CONTROL,
      }),
    );
  } catch (error) {
    throw new Error(`R2 upload failed for key ${input.key}: ${sanitizeError(error)}`);
  } finally {
    client.destroy();
  }

  return {
    key: input.key,
    publicUrl: joinPublicUrl(config.publicBaseUrl, input.key),
    contentType: input.contentType,
    sizeBytes: body.byteLength,
  };
}
