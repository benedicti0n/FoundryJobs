import type { GeneratedPostPlatform, GeneratedPostStatus } from "./types";

export type BufferPlatform = "x" | "instagram" | "linkedin";

export type BufferPublishResult = {
  generatedPostId: string;
  jobPostId: string | null;
  platform: GeneratedPostPlatform | null;
  status: "published" | "skipped" | "failed";
  externalPostId?: string | null;
  publishedUrl?: string | null;
  errorMessage?: string | null;
};

export type BufferPublishRunSummary = {
  startedAt: string;
  finishedAt: string;
  processedCount: number;
  publishedCount: number;
  skippedCount: number;
  failedCount: number;
  results: BufferPublishResult[];
};

export type BufferProfileConfig = {
  accessToken: string;
  profileIds: Record<BufferPlatform, string>;
};

export type BufferPublishablePostDto = {
  generatedPostId: string;
  jobPostId: string;
  platform: BufferPlatform;
  status: GeneratedPostStatus;
  textContent: string;
  imageUrl: string | null;
  companyName: string | null;
  roleTitle: string;
};
