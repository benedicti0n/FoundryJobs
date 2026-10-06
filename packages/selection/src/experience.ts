import type { CandidateJob, ExperienceLevel, NormalizedExperience } from "./types";

const INTERNSHIP_RE = /\b(intern|internship|co-?op)\b/i;
const FRESHER_RE =
  /\b(fresher|new grad|new graduate|graduate|entry[- ]level|0[- ]?1|0[- ]?2|2025|2026|2027)\b/i;
const TRAINEE_RE = /\b(trainee|apprentice|graduate engineer trainee|get)\b/i;
const JUNIOR_RE = /\b(junior|jr\.?|associate)\b/i;

export function classifyExperienceLevel(
  minYears: number | null,
  maxYears: number | null,
  employmentType: string,
  title: string,
): ExperienceLevel {
  if (employmentType === "internship" || INTERNSHIP_RE.test(title)) {
    return "internship";
  }
  if (maxYears !== null && maxYears <= 0) {
    return "fresher";
  }
  if (maxYears !== null && maxYears <= 1) {
    return "entry";
  }
  if (minYears !== null && minYears <= 3 && (maxYears === null || maxYears <= 3)) {
    return "early_career";
  }
  if (maxYears === null && minYears === null) {
    return "unknown";
  }
  if ((minYears ?? 0) >= 5) {
    return "senior";
  }
  return "mid";
}

export function normalizeExperience(job: CandidateJob): NormalizedExperience {
  const min = typeof job.experienceMin === "number" ? job.experienceMin : null;
  const max = typeof job.experienceMax === "number" ? job.experienceMax : null;
  const minYears = min !== null ? Math.max(0, min) : null;
  const maxYears = max !== null ? Math.max(0, max) : null;

  return {
    minYears,
    maxYears,
    level: classifyExperienceLevel(minYears, maxYears, job.employmentType, job.roleTitle),
  };
}

export function experienceFitPoints(level: ExperienceLevel): number {
  switch (level) {
    case "internship":
    case "fresher":
    case "entry":
      return 8;
    case "early_career":
      return 7;
    case "unknown":
      return 3;
    case "mid":
      return 1;
    case "senior":
      return 0;
  }
}

export function gradFresherSignalPoints(job: CandidateJob, level: ExperienceLevel): number {
  const haystack =
    `${job.roleTitle} ${job.qualification ?? ""} ${job.employmentType}`.toLowerCase();
  let points = 0;

  if (level === "internship") {
    points = 10;
  } else if (level === "fresher" || FRESHER_RE.test(haystack)) {
    points = 10;
  } else if (TRAINEE_RE.test(haystack)) {
    points = 9;
  } else if (JUNIOR_RE.test(haystack)) {
    points = 6;
  } else if (level === "entry") {
    points = 9;
  } else if (level === "early_career") {
    points = 6;
  }

  const gradYearMatch = job.batchYears.some((year) => ["2025", "2026", "2027"].includes(year));
  if (gradYearMatch) {
    points = Math.min(10, points + 4);
  }

  if (/high school/i.test(haystack)) {
    points = Math.min(points, 4);
  }

  return points;
}
