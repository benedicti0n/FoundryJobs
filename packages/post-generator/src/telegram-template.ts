import type { JobPostWithScoreDto } from "@foundryjobs/db";
import {
  applyTargetText,
  formatBatchEligibility,
  formatExperienceCompact,
  formatSkills,
  formatWorkModeLabel,
  normalizeSpacing,
  sanitizeText,
  truncateText,
} from "./formatters";

export const TELEGRAM_MESSAGE_LIMIT = 4096;
export const TELEGRAM_BULLET_MAX = 4;
export const TELEGRAM_BULLET_MAX_CHARS = 140;

export type TelegramAlertType = {
  key: "mass_hiring" | "internship" | "fresher" | "remote" | "big_tech" | "startup" | "generic";
  heading: string;
};

const INTERN_RE = /\bintern(ship)?\b/i;
const FRESHER_RE =
  /\b(fresher|new grad|new graduate|graduate|trainee|apprentice|entry[- ]level|junior|associate)\b/i;
const CAMPAIGN_RE =
  /\b(trainee|apprentice|graduate engineer|fresher|hiring drive|walk[- ]?in|campus hiring)\b/i;

export function resolveAlertType(job: JobPostWithScoreDto): TelegramAlertType {
  const titleHaystack = `${job.roleTitle} ${job.qualification ?? ""}`.toLowerCase();
  const gradYearMatch = job.batchYears.some((year) => ["2025", "2026", "2027"].includes(year));
  const earlyExperience = (job.experienceMin ?? 0) <= 1;

  if (
    job.sourceCategory === "mass_hiring" &&
    (CAMPAIGN_RE.test(titleHaystack) || earlyExperience)
  ) {
    return { key: "mass_hiring", heading: "🔥 Mass Hiring Alert" };
  }
  if (job.employmentType === "internship" || INTERN_RE.test(job.roleTitle)) {
    return { key: "internship", heading: "🚀 Internship Hiring Alert" };
  }
  const fresherExperience = job.experienceMax !== null && job.experienceMax <= 1;
  if (gradYearMatch || FRESHER_RE.test(titleHaystack) || fresherExperience) {
    return { key: "fresher", heading: "🚨 Fresher Hiring Alert" };
  }
  if (job.workMode === "remote") {
    return { key: "remote", heading: "🌍 Remote Hiring Alert" };
  }
  if (job.sourceCategory === "big_tech") {
    return { key: "big_tech", heading: "🏢 Big Tech Hiring Alert" };
  }
  if (job.sourceCategory === "yc" || job.sourceCategory === "startup") {
    return { key: "startup", heading: "⚡ Startup Hiring Alert" };
  }
  return { key: "generic", heading: "🚨 Hiring Alert" };
}

function normalizeBulletKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function clampBullet(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= TELEGRAM_BULLET_MAX_CHARS) {
    return cleaned;
  }
  return `${cleaned.slice(0, TELEGRAM_BULLET_MAX_CHARS - 1).trimEnd()}…`;
}

export function buildTelegramRequirementBullets(job: JobPostWithScoreDto): string[] {
  const candidates: string[] = [];

  const seenSkills = new Set<string>();
  const skills = job.skills
    .map((skill) => sanitizeText(skill))
    .filter((skill): skill is string => Boolean(skill))
    .filter((skill) => {
      const key = normalizeBulletKey(skill);
      if (seenSkills.has(key)) {
        return false;
      }
      seenSkills.add(key);
      return true;
    });
  if (skills.length > 0) {
    candidates.push(formatSkills(skills, ", ", 5));
  }

  const experience = formatExperienceCompact(job);
  if (experience) {
    candidates.push(/\d/.test(experience) ? `${experience} of experience` : `${experience}`);
  }

  const batch = formatBatchEligibility(job);
  if (batch && job.batchYears.length > 0) {
    candidates.push(`${batch} eligible`);
  }

  const qualification = sanitizeText(job.qualification);
  if (
    qualification &&
    qualification.length <= TELEGRAM_BULLET_MAX_CHARS &&
    job.batchYears.length === 0
  ) {
    candidates.push(qualification);
  }

  let bullets = candidates;
  if (bullets.length < 2 && skills.length > 0) {
    bullets = [...bullets, ...skills.slice(0, 3)];
  }

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const bullet of bullets) {
    const key = normalizeBulletKey(bullet);
    if (key.length === 0 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(clampBullet(bullet));
    if (deduped.length >= TELEGRAM_BULLET_MAX) {
      break;
    }
  }

  return deduped;
}

function joinLines(parts: Array<string | null>): string {
  return normalizeSpacing(parts.filter((part): part is string => part !== null).join("\n"));
}

export function buildTelegramJobPost(job: JobPostWithScoreDto): string {
  const alert = resolveAlertType(job);
  const company = sanitizeText(job.companyName);
  const role = sanitizeText(job.roleTitle);
  const location = sanitizeText(job.location);
  const batch = formatBatchEligibility(job);
  const experience = formatExperienceCompact(job);
  const salary = sanitizeText(job.salaryText);
  const workMode = formatWorkModeLabel(job.workMode);
  const bullets = buildTelegramRequirementBullets(job);

  const draft = joinLines([
    alert.heading,
    "",
    company ? `🏢 Company: ${company}` : null,
    role ? `💼 Role: ${role}` : null,
    location ? `📍 Location: ${location}` : null,
    batch ? `🎓 Batch / Eligibility: ${batch}` : null,
    experience ? `⏳ Experience: ${experience}` : null,
    salary ? `💰 Salary / Stipend: ${salary}` : null,
    workMode ? `🏠 Work Mode: ${workMode}` : null,
    bullets.length > 0 ? "" : null,
    bullets.length > 0 ? "📌 What they're looking for:" : null,
    ...bullets.map((bullet) => `• ${bullet}`),
    "",
    "🔗 Apply:",
    applyTargetText(job),
  ]);

  return truncateText(draft, TELEGRAM_MESSAGE_LIMIT);
}
