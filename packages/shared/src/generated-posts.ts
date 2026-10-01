import type { GeneratedPostPlatform, GeneratedPostStatus } from "./types";

export type GeneratedPostDto = {
  id: string;
  jobPostId: string;
  platform: GeneratedPostPlatform;
  formatType: string;
  textContent: string;
  imageUrl: string | null;
  status: GeneratedPostStatus;
  createdAt: string;
  updatedAt: string;
};

export type PlatformPostDrafts = {
  telegram: string;
  x: string;
  instagram: string;
  linkedin: string;
};

export type GeneratePostsForJobResult = {
  jobPostId: string;
  status: "generated" | "skipped" | "error";
  generatedCount: number;
  skippedReason?: string;
  errorMessage?: string;
};

export type GeneratePostsRunSummary = {
  startedAt: string;
  finishedAt: string;
  processedCount: number;
  generatedJobsCount: number;
  skippedCount: number;
  errorCount: number;
  results: GeneratePostsForJobResult[];
};

export const FOUNDRYJOBS_CTA = "Follow FoundryJobs for fresh tech hiring alerts.";

export const PLATFORM_CHARACTER_LIMITS: Record<GeneratedPostPlatform, number> = {
  x: 280,
  telegram: 4096,
  instagram: 2200,
  linkedin: 3000,
};
