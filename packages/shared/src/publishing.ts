import type { GeneratedPostPlatform, GeneratedPostStatus } from "./types";

export type PublishPlatform = GeneratedPostPlatform;

export type PublishStatus = "pending" | "success" | "failed";

export type PublishEventDto = {
  id: string;
  jobPostId: string;
  generatedPostId: string | null;
  platform: PublishPlatform;
  externalPostId: string | null;
  publishedUrl: string | null;
  status: PublishStatus;
  errorMessage: string | null;
  publishedAt: string | null;
  createdAt: string;
};

export type PublishableGeneratedPostDto = {
  generatedPostId: string;
  jobPostId: string;
  platform: PublishPlatform;
  formatType: string;
  status: GeneratedPostStatus;
  textContent: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TelegramPublishResult = {
  generatedPostId: string;
  jobPostId: string | null;
  status: "published" | "skipped" | "failed";
  externalPostId?: string | null;
  publishedUrl?: string | null;
  errorMessage?: string | null;
};

export type PublishTelegramRunSummary = {
  startedAt: string;
  finishedAt: string;
  processedCount: number;
  publishedCount: number;
  skippedCount: number;
  failedCount: number;
  results: TelegramPublishResult[];
};

export type CreatePublishEventInput = {
  jobPostId: string;
  generatedPostId: string | null;
  platform: PublishPlatform;
  externalPostId?: string | null;
  publishedUrl?: string | null;
  status: PublishStatus;
  errorMessage?: string | null;
  publishedAt?: string | null;
};
