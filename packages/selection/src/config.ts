export const SELECTION_CONFIG = {
  telegramMaxPosts: 10,
  mediaMaxPosts: 2,
  maxCandidatesPerCompany: 5,
  maxCandidatesPerSource: 10,
  maxTelegramPerCompany: 2,
  maxMediaPerCompany: 1,
  repostExclusionDays: 30,
  telegramSlotTargets: [
    { label: "mass_hiring", categories: ["mass_hiring"], count: 3 },
    { label: "big_tech", categories: ["big_tech"], count: 2 },
    { label: "startup_yc", categories: ["startup", "yc"], count: 2 },
    { label: "remote", categories: ["remote"], count: 2 },
  ],
  wildcardSlots: 1,
} as const;

export type SelectionConfig = {
  telegramMaxPosts: number;
  mediaMaxPosts: number;
  maxCandidatesPerCompany: number;
  maxCandidatesPerSource: number;
  maxTelegramPerCompany: number;
  maxMediaPerCompany: number;
  repostExclusionDays: number;
  telegramSlotTargets: ReadonlyArray<{
    label: string;
    categories: readonly string[];
    count: number;
  }>;
  wildcardSlots: number;
};

export function withSelectionConfig(overrides: Partial<SelectionConfig> = {}): SelectionConfig {
  return {
    telegramMaxPosts: overrides.telegramMaxPosts ?? SELECTION_CONFIG.telegramMaxPosts,
    mediaMaxPosts: overrides.mediaMaxPosts ?? SELECTION_CONFIG.mediaMaxPosts,
    maxCandidatesPerCompany:
      overrides.maxCandidatesPerCompany ?? SELECTION_CONFIG.maxCandidatesPerCompany,
    maxCandidatesPerSource:
      overrides.maxCandidatesPerSource ?? SELECTION_CONFIG.maxCandidatesPerSource,
    maxTelegramPerCompany:
      overrides.maxTelegramPerCompany ?? SELECTION_CONFIG.maxTelegramPerCompany,
    maxMediaPerCompany: overrides.maxMediaPerCompany ?? SELECTION_CONFIG.maxMediaPerCompany,
    repostExclusionDays: overrides.repostExclusionDays ?? SELECTION_CONFIG.repostExclusionDays,
    telegramSlotTargets: overrides.telegramSlotTargets ?? SELECTION_CONFIG.telegramSlotTargets,
    wildcardSlots: overrides.wildcardSlots ?? SELECTION_CONFIG.wildcardSlots,
  };
}
