import type { GeneratedPostPlatform } from "./types";

export const FEATURE_X_PUBLISHING_ENV_VAR = "FEATURE_X_PUBLISHING_ENABLED";

export function isXpublishingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[FEATURE_X_PUBLISHING_ENV_VAR]?.toLowerCase() === "true";
}

export const DEFAULT_GENERATED_PLATFORMS: readonly GeneratedPostPlatform[] = [
  "telegram",
  "instagram",
];

export function activeGeneratedPlatforms(
  env: NodeJS.ProcessEnv = process.env,
): GeneratedPostPlatform[] {
  const platforms: GeneratedPostPlatform[] = [...DEFAULT_GENERATED_PLATFORMS];
  if (isXpublishingEnabled(env)) {
    platforms.push("x");
  }
  return platforms;
}
