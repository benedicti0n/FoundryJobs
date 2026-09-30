export type Platform = "telegram" | "x" | "instagram" | "linkedin";

export type WorkMode = "remote" | "hybrid" | "onsite" | "unknown";

export type EmploymentType = "internship" | "full_time" | "part_time" | "contract" | "unknown";

export type SourceType =
  "ats" | "company_careers" | "rss" | "web_page" | "telegram_channel" | "x_search" | "manual";

export type SourcePlatform =
  "greenhouse" | "lever" | "ashby" | "workable" | "workday" | "generic" | "telegram" | "x";

export type JobStatus =
  "draft" | "scored" | "queued" | "approved" | "rejected" | "published" | "expired";

export type GeneratedPostPlatform = "telegram" | "x" | "instagram" | "linkedin";

export type GeneratedPostStatus = "draft" | "approved" | "rejected" | "published" | "failed";

export type SpamRisk = "low" | "medium" | "high" | "unknown";

export type ApprovalDecision = "approved" | "rejected" | "needs_edit";
