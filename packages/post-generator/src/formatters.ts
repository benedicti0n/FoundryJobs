import type { JobPostWithScoreDto } from "@foundryjobs/db";
import type { WorkMode } from "@foundryjobs/shared";

export function formatCompany(companyName: string | null): string {
  const value = companyName?.trim();
  return value && value.length > 0 ? value : "Company not specified";
}

export function formatLocation(location: string | null): string {
  const value = location?.trim();
  return value && value.length > 0 ? value : "Location not specified";
}

export function formatWorkMode(workMode: WorkMode): string {
  switch (workMode) {
    case "remote":
      return "Remote";
    case "hybrid":
      return "Hybrid";
    case "onsite":
      return "Onsite";
    default:
      return "Not specified";
  }
}

function looksFresherFriendly(job: JobPostWithScoreDto): boolean {
  const haystack =
    `${job.roleTitle} ${job.qualification ?? ""} ${job.batchYears.join(" ")}`.toLowerCase();
  return (
    /fresher|graduate|entry.level|intern|junior|trainee|associate/.test(haystack) ||
    job.batchYears.length > 0
  );
}

export function formatExperience(job: JobPostWithScoreDto): string {
  const isInternship = job.employmentType === "internship";
  const min = job.experienceMin;
  const max = job.experienceMax;

  let range: string | null = null;
  if (min !== null && max !== null) {
    if (max <= 0) {
      range = "Freshers";
    } else if (min <= 0) {
      range = `Freshers / 0–${max} YOE`;
    } else {
      range = `${min}–${max} YOE`;
    }
  } else if (min !== null) {
    range = `${min}+ YOE`;
  } else if (max !== null) {
    range = max <= 0 ? "Freshers" : `Up to ${max} YOE`;
  }

  if (isInternship) {
    return range ? `Internship / ${range}` : "Internship";
  }
  if (range) {
    return range;
  }
  return looksFresherFriendly(job) ? "Freshers eligible" : "Not specified";
}

export function formatSkills(skills: string[], separator: string, max?: number): string {
  const trimmed = skills.map((skill) => skill.trim()).filter((skill) => skill.length > 0);
  const limited = max !== undefined ? trimmed.slice(0, max) : trimmed;
  return limited.join(separator);
}

export function hasApplyInfo(job: JobPostWithScoreDto): boolean {
  return Boolean(job.applyUrl || job.applyEmail);
}

export function applyTargetText(job: JobPostWithScoreDto): string {
  if (job.applyUrl) {
    return job.applyUrl;
  }
  if (job.applyEmail) {
    return job.applyEmail;
  }
  return "Apply link not available in source";
}

export function applyLine(job: JobPostWithScoreDto): string {
  return `Apply: ${applyTargetText(job)}`;
}

export function buildRelevanceLine(job: JobPostWithScoreDto): string {
  if (job.workMode === "remote") {
    return "This is a remote-friendly tech role open to freshers and early-career candidates.";
  }
  if (job.workMode === "hybrid") {
    return "This is a hybrid tech role open to freshers and early-career candidates.";
  }
  return "Freshers and early-career candidates can apply for this tech role.";
}

export function roleHashtag(roleCategory: string | null): string | null {
  switch (roleCategory) {
    case "Data":
      return "#DataJobs";
    case "AI/ML":
      return "#AIJobs";
    case "DevOps":
      return "#DevOpsJobs";
    case "Mobile":
      return "#MobileJobs";
    case "QA":
      return "#QAJobs";
    case "Security":
      return "#SecurityJobs";
    case "Embedded":
      return "#EmbeddedJobs";
    case "Frontend":
    case "Backend":
    case "Full Stack":
      return "#SoftwareJobs";
    default:
      return null;
  }
}

export function normalizeSpacing(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function truncateText(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}
