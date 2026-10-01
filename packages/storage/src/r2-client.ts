import { S3Client } from "@aws-sdk/client-s3";
import { getEnv, isEnvSet } from "@foundryjobs/shared";

export const R2_REQUIRED_ENV_VARS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_BASE_URL",
] as const;

export const R2_CONFIG_ERROR =
  "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_BASE_URL are required for R2 uploads";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicBaseUrl: string;
};

function requireEnvValue(name: string): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(R2_CONFIG_ERROR);
  }
  return value;
}

export function isR2Configured(): boolean {
  return R2_REQUIRED_ENV_VARS.every((name) => isEnvSet(name));
}

export function getR2Config(): R2Config {
  if (!isR2Configured()) {
    throw new Error(R2_CONFIG_ERROR);
  }

  return {
    accountId: requireEnvValue("R2_ACCOUNT_ID"),
    accessKeyId: requireEnvValue("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnvValue("R2_SECRET_ACCESS_KEY"),
    bucketName: requireEnvValue("R2_BUCKET_NAME"),
    publicBaseUrl: requireEnvValue("R2_PUBLIC_BASE_URL"),
  };
}

export function createR2Client(config: R2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}
