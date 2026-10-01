import type { EmploymentType, GeneratedPostStatus, WorkMode } from "./types";

export type InstagramCardRenderResult = {
  generatedPostId: string;
  jobPostId: string | null;
  status: "rendered" | "skipped" | "error";
  imageUrl?: string | null;
  errorMessage?: string | null;
};

export type InstagramCardRunSummary = {
  startedAt: string;
  finishedAt: string;
  processedCount: number;
  renderedCount: number;
  skippedCount: number;
  errorCount: number;
  results: InstagramCardRenderResult[];
};

export type RenderableInstagramPostDto = {
  generatedPostId: string;
  jobPostId: string;
  textContent: string;
  imageUrl: string | null;
  generatedPostStatus: GeneratedPostStatus;
  companyName: string | null;
  roleTitle: string;
  location: string | null;
  workMode: WorkMode;
  employmentType: EmploymentType;
  experienceMin: number | null;
  experienceMax: number | null;
  skills: string[];
  salaryText: string | null;
  totalScore: number | null;
  shouldPost: boolean | null;
};
