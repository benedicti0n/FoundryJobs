import { getEnv, isEnvSet } from "@foundryjobs/shared";
import type { BufferPlatform } from "@foundryjobs/shared";

export const BUFFER_PLATFORMS: readonly BufferPlatform[] = ["x", "instagram", "linkedin"];

export const BUFFER_PROFILE_ENV_VARS: Record<BufferPlatform, string> = {
  x: "BUFFER_PROFILE_ID_X",
  instagram: "BUFFER_PROFILE_ID_INSTAGRAM",
  linkedin: "BUFFER_PROFILE_ID_LINKEDIN",
};

export const BUFFER_CONFIG_ERROR =
  "BUFFER_ACCESS_TOKEN and the matching BUFFER_PROFILE_ID_* value are required for Buffer publishing";

export function isBufferPlatform(value: string): value is BufferPlatform {
  return (BUFFER_PLATFORMS as readonly string[]).includes(value);
}

export function isBufferConfiguredForPlatform(platform: BufferPlatform): boolean {
  return isEnvSet("BUFFER_ACCESS_TOKEN") && isEnvSet(BUFFER_PROFILE_ENV_VARS[platform]);
}

export function isBufferConfigured(): boolean {
  return getMissingBufferEnvVars().length === 0;
}

export function getMissingBufferEnvVars(): string[] {
  const missing: string[] = [];
  if (!isEnvSet("BUFFER_ACCESS_TOKEN")) {
    missing.push("BUFFER_ACCESS_TOKEN");
  }
  for (const platform of BUFFER_PLATFORMS) {
    if (!isEnvSet(BUFFER_PROFILE_ENV_VARS[platform])) {
      missing.push(BUFFER_PROFILE_ENV_VARS[platform]);
    }
  }
  return missing;
}

export function getBufferProfileId(platform: BufferPlatform): string {
  const profileId = getEnv(BUFFER_PROFILE_ENV_VARS[platform]);
  if (!isEnvSet("BUFFER_ACCESS_TOKEN") || !profileId) {
    throw new Error(BUFFER_CONFIG_ERROR);
  }
  return profileId;
}
