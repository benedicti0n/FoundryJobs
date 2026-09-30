import type { EmploymentType, SpamRisk, WorkMode } from "./types";

export type JobNormalizationStatus = "normalized" | "rejected" | "error";

export type JobExtractionProvider = "gemini" | "rules";

export type ExtractedJobData = {
  isHiringPost: boolean;
  isTechRole: boolean;
  companyName?: string | null;
  roleTitle: string;
  roleCategory?: string | null;
  location?: string | null;
  workMode: WorkMode;
  employmentType: EmploymentType;
  experienceMin?: number | null;
  experienceMax?: number | null;
  qualification?: string | null;
  batchYears: string[];
  skills: string[];
  salaryText?: string | null;
  applyUrl?: string | null;
  applyEmail?: string | null;
  sourceUrl?: string | null;
  postedAt?: string | null;
  reason?: string | null;
};

export type JobExtractionUsage = {
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
};

export type JobExtractionResult = {
  status: "extracted" | "rejected" | "error";
  data?: ExtractedJobData;
  errorMessage?: string;
  provider: JobExtractionProvider;
  model?: string | null;
  usage?: JobExtractionUsage;
};

export type JobScoreBreakdown = {
  freshnessScore: number;
  fresherFitScore: number;
  techRelevanceScore: number;
  trustScore: number;
  remoteBonus: number;
  clarityScore: number;
  totalScore: number;
  spamRisk: SpamRisk;
  shouldPost: boolean;
  reason: string;
};

export type NormalizeRawPostResult = {
  rawPostId: string;
  status: JobNormalizationStatus;
  jobPostId?: string;
  totalScore?: number;
  shouldPost?: boolean;
  errorMessage?: string;
  provider?: JobExtractionProvider;
};

export type NormalizeRunSummary = {
  startedAt: string;
  finishedAt: string;
  processedCount: number;
  normalizedCount: number;
  rejectedCount: number;
  errorCount: number;
  results: NormalizeRawPostResult[];
};

export const TECH_KEYWORDS = [
  "software",
  "developer",
  "engineer",
  "engineering",
  "programmer",
  "coder",
  "sde",
  "sdet",
  "backend",
  "frontend",
  "full stack",
  "fullstack",
  "full-stack",
  "web",
  "mobile",
  "android",
  "ios",
  "flutter",
  "react native",
  "devops",
  "sre",
  "site reliability",
  "cloud",
  "platform",
  "infrastructure",
  "database",
  "data",
  "analytics",
  "analyst",
  "machine learning",
  "deep learning",
  "artificial intelligence",
  "ai",
  "ml",
  "nlp",
  "computer vision",
  "robotics",
  "embedded",
  "firmware",
  "systems",
  "network",
  "security",
  "cyber",
  "qa",
  "quality assurance",
  "test",
  "automation",
  "blockchain",
  "web3",
  "game",
  "unity",
  "unreal",
  "technical",
  "technology",
  "computer science",
  "python",
  "java",
  "javascript",
  "typescript",
  "golang",
  "rust",
  "kotlin",
  "swift",
  "sql",
  "html",
  "css",
  "api",
  "microservices",
] as const;

export const FRESHER_KEYWORDS = [
  "fresher",
  "freshers",
  "fresh graduate",
  "fresh graduates",
  "graduate",
  "graduates",
  "new grad",
  "entry level",
  "entry-level",
  "intern",
  "internship",
  "trainee",
  "apprentice",
  "campus",
  "walk-in",
  "walkin",
  "junior",
  "associate",
] as const;

export const SPAM_KEYWORDS = [
  "data entry",
  "work from home data entry",
  "registration fee",
  "registration fees",
  "pay to apply",
  "security deposit",
  "processing fee",
  "training fee",
  "job guarantee",
  "100% job guarantee",
  "earn daily",
  "earn money",
  "quick money",
  "limited seats",
  "whatsapp only",
  "dm me",
  "click here",
  "no experience needed",
  "part time typing",
  "copy paste",
  "ad posting",
  "usdt",
  "crypto investment",
  "investment required",
] as const;

export const COMMON_SKILLS = [
  "javascript",
  "typescript",
  "python",
  "java",
  "c++",
  "c#",
  "golang",
  "rust",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "scala",
  "matlab",
  "react",
  "react native",
  "next.js",
  "vue",
  "angular",
  "svelte",
  "node.js",
  "express",
  "django",
  "flask",
  "fastapi",
  "spring boot",
  "rails",
  ".net",
  "laravel",
  "graphql",
  "rest api",
  "html",
  "css",
  "tailwind",
  "sass",
  "bootstrap",
  "jquery",
  "sql",
  "mysql",
  "postgresql",
  "postgres",
  "sqlite",
  "mongodb",
  "redis",
  "elasticsearch",
  "cassandra",
  "dynamodb",
  "kafka",
  "rabbitmq",
  "docker",
  "kubernetes",
  "aws",
  "azure",
  "gcp",
  "firebase",
  "terraform",
  "ansible",
  "jenkins",
  "github actions",
  "gitlab ci",
  "git",
  "linux",
  "bash",
  "machine learning",
  "deep learning",
  "pytorch",
  "tensorflow",
  "scikit-learn",
  "pandas",
  "numpy",
  "spark",
  "hadoop",
  "airflow",
  "tableau",
  "power bi",
  "excel",
  "selenium",
  "cypress",
  "playwright",
  "jest",
  "pytest",
  "junit",
  "flutter",
  "swiftui",
  "figma",
  "unity",
  "unreal",
  "embedded c",
  "rtos",
  "etl",
  "data structures",
  "algorithms",
  "dsa",
  "oop",
  "microservices",
  "grpc",
] as const;

export function containsKeyword(haystack: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9+#])`, "i").test(haystack);
}

export function countKeywordMatches(haystack: string, keywords: readonly string[]): number {
  return keywords.reduce(
    (count, keyword) => (containsKeyword(haystack, keyword) ? count + 1 : count),
    0,
  );
}
