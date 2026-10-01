import type { GeneratedPostPlatform, GeneratedPostStatus } from "./types";

export type StorageUploadResult = {
  key: string;
  publicUrl: string;
  contentType: string;
  sizeBytes: number;
};

export type InstagramCardUploadResult = {
  generatedPostId: string;
  jobPostId: string | null;
  status: "uploaded" | "skipped" | "error";
  localImageUrl?: string | null;
  publicImageUrl?: string | null;
  errorMessage?: string | null;
};

export type InstagramCardUploadRunSummary = {
  startedAt: string;
  finishedAt: string;
  processedCount: number;
  uploadedCount: number;
  skippedCount: number;
  errorCount: number;
  results: InstagramCardUploadResult[];
};

export type UploadableInstagramCardDto = {
  generatedPostId: string;
  jobPostId: string;
  platform: GeneratedPostPlatform;
  status: GeneratedPostStatus;
  localImageUrl: string;
  companyName: string | null;
  roleTitle: string;
};
