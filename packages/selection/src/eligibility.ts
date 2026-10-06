import { normalizeExperience } from "./experience";
import type {
  CandidateJob,
  EligibilityReason,
  EligibilityStatus,
  NormalizedExperience,
} from "./types";

const SENIOR_TITLE_RE =
  /\b(senior|staff|principal|distinguished|director|vice president|vp|head of|chief)\b/i;
const MANAGER_TITLE_RE = /\b(manager|management|lead)\b/i;
const EARLY_MANAGER_RE = /\b(associate|assistant)\s+(product\s+)?manager\b/i;
const ARCHITECT_TITLE_RE = /\b(architect)\b/i;
const TECH_TITLE_RE =
  /\b(engineer|engineering|developer|software|sde|swe|programmer|data|analyst|analytics|qa|quality|test|automation|devops|sre|cloud|platform|backend|frontend|full[- ]?stack|mobile|android|ios|machine learning|ml|ai|security|support|technical|product|implementation|integration|systems?)\b/i;
const MASS_HIRING_RE =
  /\b(trainee|apprentice|graduate engineer|fresher|mass hiring|walk[- ]?in|hiring drive|batch of 20)\b/i;

export type EligibilityEvaluation = {
  status: EligibilityStatus;
  reasons: EligibilityReason[];
  experience: NormalizedExperience;
};

export function evaluateEligibility(job: CandidateJob): EligibilityEvaluation {
  const reasons: EligibilityReason[] = [];
  const experience = normalizeExperience(job);
  const title = job.roleTitle ?? "";
  const haystack =
    `${title} ${job.roleCategory ?? ""} ${job.qualification ?? ""} ${job.employmentType}`.toLowerCase();

  let status: EligibilityStatus = "eligible";
  let negativeSignal = false;
  let borderlineSignal = false;

  if (SENIOR_TITLE_RE.test(title)) {
    reasons.push({
      code: "senior_title",
      detail: `seniority wording in title: "${title}"`,
      impact: "negative",
    });
    negativeSignal = true;
  } else if (MANAGER_TITLE_RE.test(title) && !EARLY_MANAGER_RE.test(title)) {
    reasons.push({
      code: "senior_title",
      detail: `manager/lead wording in title: "${title}"`,
      impact: "negative",
    });
    negativeSignal = true;
  }

  if ((experience.minYears ?? 0) >= 5) {
    reasons.push({
      code: "experience_min_5plus",
      detail: `requires ${experience.minYears}+ years`,
      impact: "negative",
    });
    negativeSignal = true;
  } else if (experience.minYears === 4) {
    reasons.push({ code: "experience_min_4", detail: "requires 4+ years", impact: "negative" });
    borderlineSignal = true;
  } else if (experience.minYears !== null && experience.minYears <= 3) {
    reasons.push({
      code: "within_yoe_range",
      detail: `requires ${experience.minYears}${experience.maxYears !== null ? `-${experience.maxYears}` : "+"} years`,
      impact: "positive",
    });
  }

  if (experience.minYears === null && experience.maxYears === null) {
    reasons.push({
      code: "experience_unknown",
      detail: "no experience requirement extracted",
      impact: "neutral",
    });
  }

  if (experience.level === "internship") {
    reasons.push({ code: "internship", detail: "internship role", impact: "positive" });
  }
  if (experience.level === "fresher" || /\b(fresher|new grad|new graduate)\b/.test(haystack)) {
    reasons.push({
      code: "fresher_signal",
      detail: "fresher / new-grad wording",
      impact: "positive",
    });
  }
  if (/\b(graduate|grad)\b/.test(haystack) && !/\b(senior|principal|staff)\b/i.test(title)) {
    reasons.push({
      code: "graduate_program",
      detail: "graduate program wording",
      impact: "positive",
    });
  }
  if (/\b(trainee|apprentice|graduate engineer trainee)\b/.test(haystack)) {
    reasons.push({
      code: "trainee_or_apprentice",
      detail: "trainee/apprentice role",
      impact: "positive",
    });
  }
  if (/\b(junior|jr\.?|associate)\b/.test(haystack)) {
    reasons.push({
      code: "junior_or_associate",
      detail: "junior/associate wording",
      impact: "positive",
    });
  }

  const gradYearMatch = job.batchYears.some((year) => ["2025", "2026", "2027"].includes(year));
  if (gradYearMatch) {
    reasons.push({
      code: "grad_year_match",
      detail: `grad years: ${job.batchYears.join(", ")}`,
      impact: "positive",
    });
  } else if (job.batchYears.length > 0) {
    reasons.push({
      code: "grad_year_other",
      detail: `grad years outside 2025-2027: ${job.batchYears.join(", ")}`,
      impact: "neutral",
    });
  }

  if (MASS_HIRING_RE.test(haystack)) {
    reasons.push({
      code: "mass_hiring_campaign",
      detail: "mass-hiring campaign wording",
      impact: "positive",
    });
  }

  const techSignal =
    TECH_TITLE_RE.test(title) ||
    (job.legacyScore !== null && job.legacyScore.techRelevanceScore > 0) ||
    job.skills.length > 0;
  if (!techSignal) {
    reasons.push({
      code: "not_tech_role",
      detail: "no tech/role signal found",
      impact: "negative",
    });
    negativeSignal = true;
  }

  if (ARCHITECT_TITLE_RE.test(title) && (experience.minYears ?? 0) >= 4) {
    reasons.push({
      code: "experience_min_5plus",
      detail: "architect role with extensive experience",
      impact: "negative",
    });
    negativeSignal = true;
  }

  if (negativeSignal) {
    status = "reject";
  } else if (borderlineSignal) {
    status = "borderline";
  }

  return { status, reasons, experience };
}
