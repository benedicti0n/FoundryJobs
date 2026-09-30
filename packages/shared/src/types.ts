export type Platform = "telegram" | "x" | "instagram" | "linkedin";

export type WorkMode = "remote" | "hybrid" | "onsite" | "unknown";

export type EmploymentType = "internship" | "full_time" | "part_time" | "contract" | "unknown";

export type JobStatus =
  "draft" | "scored" | "queued" | "approved" | "rejected" | "published" | "expired";

export type GeneratedPostPlatform = "telegram" | "x" | "instagram" | "linkedin";

export type GeneratedPostStatus = "draft" | "approved" | "rejected" | "published" | "failed";

export type SpamRisk = "low" | "medium" | "high" | "unknown";

export type ApprovalDecision = "approved" | "rejected" | "needs_edit";
