import {
  COMMON_SKILLS,
  FRESHER_KEYWORDS,
  TECH_KEYWORDS,
  containsKeyword,
  countKeywordMatches,
  type EmploymentType,
  type ExtractedJobData,
  type JobExtractionResult,
  type WorkMode,
} from "@foundryjobs/shared";
import type { RawPostForExtraction } from "./prompts/job-extraction";

const LABELED_TITLE = /^Title:\s*(.+)$/im;
const LABELED_COMPANY = /^Company:\s*(.+)$/im;
const LABELED_LOCATION = /^Location:\s*(.+)$/im;
const LABELED_EMPLOYMENT = /^(?:Employment type|Commitment):\s*(.+)$/im;
const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;
const BATCH_YEAR_PATTERN = /\b20(2[3-9]|3[0-5])\b/g;
const QUALIFICATION_PATTERN =
  /(b\.?tech|b\.?e\b|bachelor|b\.?sc|mca|m\.?tech|master|bca|diploma|degree)/i;
const SALARY_PATTERNS = [
  /(?:₹|rs\.?\s?|inr\s?)[\d,.]+\s?(?:lpa|lakhs?|lakh|k|per\s+(?:month|annum))?/i,
  /\b[\d.]+\s?(?:lpa|lakhs?|lakh)\b/i,
  /(?:salary|ctc|stipend)\s*[:\-]\s*([^\n]{2,80})/i,
];

function rejected(reason: string): JobExtractionResult {
  return { status: "rejected", provider: "rules", model: null, errorMessage: reason };
}

function firstGroup(text: string, pattern: RegExp): string | null {
  const match = pattern.exec(text);
  const value = match?.[1]?.trim();
  return value && value.length > 0 ? value : null;
}

function firstLine(text: string): string | null {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
}

function stripBoardSuffix(company: string | null): string | null {
  if (!company) {
    return null;
  }
  const cleaned = company
    .replace(
      /\s*\((?:greenhouse|lever|ashby|workable|workday|generic|telegram|x|manual)[^)]*\)\s*$/i,
      "",
    )
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

function deriveRoleCategory(title: string): string | null {
  const haystack = title.toLowerCase();
  if (/full[\s-]?stack/.test(haystack)) {
    return "Full Stack";
  }
  if (/front[\s-]?end|react|angular|vue|\bui\b|\bux\b/.test(haystack)) {
    return "Frontend";
  }
  if (/back[\s-]?end|\bapi\b|server|node/.test(haystack)) {
    return "Backend";
  }
  if (/devops|\bsre\b|cloud|infrastructure|platform/.test(haystack)) {
    return "DevOps";
  }
  if (/android|\bios\b|mobile|flutter|react native/.test(haystack)) {
    return "Mobile";
  }
  if (/\bml\b|machine learning|\bai\b|deep learning|\bnlp\b|data scien/.test(haystack)) {
    return "AI/ML";
  }
  if (/\bdata\b|analyst|analytics/.test(haystack)) {
    return "Data";
  }
  if (/\bqa\b|test|sdet|quality/.test(haystack)) {
    return "QA";
  }
  if (/security|cyber/.test(haystack)) {
    return "Security";
  }
  if (/embedded|firmware|hardware/.test(haystack)) {
    return "Embedded";
  }
  return null;
}

function detectWorkMode(haystack: string): WorkMode {
  if (/remote\s*(?:or|&|\/)\s*(?:in.?office|hybrid)|hybrid|flexible work/.test(haystack)) {
    return "hybrid";
  }
  if (
    /\bremote\b|\bwork from home\b|\bwfh\b|\bwork from anywhere\b|\banywhere in india\b/.test(
      haystack,
    )
  ) {
    return "remote";
  }
  if (/\bon-?site\b|\bin-?office\b|\bwork from office\b|\bwfo\b/.test(haystack)) {
    return "onsite";
  }
  return "unknown";
}

function detectEmploymentType(haystack: string, label: string | null): EmploymentType {
  const source = `${label ?? ""} ${haystack}`.toLowerCase();
  if (/intern(ship)?\b/.test(source)) {
    return "internship";
  }
  if (/part[\s-]?time/.test(source)) {
    return "part_time";
  }
  if (/contract(or)?\b|freelance/.test(source)) {
    return "contract";
  }
  if (/full[\s-]?time|fulltime/.test(source)) {
    return "full_time";
  }
  return "unknown";
}

function extractExperience(text: string): { min: number | null; max: number | null } {
  const range = /(\d{1,2})\s*(?:-|–|—|to)\s*(\d{1,2})\s*\+?\s*(?:years?|yrs?)/i.exec(text);
  if (range?.[1] !== undefined && range[2] !== undefined) {
    return { min: Number(range[1]), max: Number(range[2]) };
  }

  const plus = /(\d{1,2})\s*\+\s*(?:years?|yrs?)/i.exec(text);
  if (plus?.[1] !== undefined) {
    return { min: Number(plus[1]), max: null };
  }

  const minimum = /(?:minimum|min\.?|at least)\s*(\d{1,2})\s*(?:years?|yrs?)/i.exec(text);
  if (minimum?.[1] !== undefined) {
    return { min: Number(minimum[1]), max: null };
  }

  return { min: null, max: null };
}

function extractQualification(text: string): string | null {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    if (QUALIFICATION_PATTERN.test(trimmed)) {
      return trimmed.length > 200 ? `${trimmed.slice(0, 197)}...` : trimmed;
    }
  }
  return null;
}

function extractSalary(text: string): string | null {
  for (const pattern of SALARY_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      const value = (match[1] ?? match[0]).trim();
      if (value.length > 0) {
        return value.length > 100 ? `${value.slice(0, 97)}...` : value;
      }
    }
  }
  return null;
}

function pickApplyUrl(text: string): string | null {
  const urls = text.match(URL_PATTERN) ?? [];
  return urls.find((url) => /apply|career|greenhouse|lever|ashby|jobs?\//i.test(url)) ?? null;
}

export function extractJobWithRules(rawPost: RawPostForExtraction): JobExtractionResult {
  const text = rawPost.rawText;

  if (text.trim().length < 20) {
    return rejected("Insufficient content");
  }

  const title =
    rawPost.rawTitle?.trim() || firstGroup(text, LABELED_TITLE) || firstLine(text) || "";
  if (title.length === 0) {
    return rejected("Missing role title");
  }

  const haystack = `${title}\n${text}`.toLowerCase();
  const skills = COMMON_SKILLS.filter((skill) => containsKeyword(haystack, skill));
  const techKeywordCount = countKeywordMatches(haystack, TECH_KEYWORDS);
  const roleCategory = deriveRoleCategory(title);
  const isTechRole = techKeywordCount > 0 || skills.length > 0 || roleCategory !== null;

  if (!isTechRole) {
    return rejected("Non-tech role");
  }

  const fresherSignal = FRESHER_KEYWORDS.some((keyword) => containsKeyword(haystack, keyword));
  const experience = extractExperience(text);

  if (experience.max !== null && experience.max > 3 && !fresherSignal) {
    return rejected(`Requires up to ${experience.max} years of experience`);
  }
  if (experience.min !== null && experience.min > 3 && !fresherSignal) {
    return rejected(`Requires at least ${experience.min} years of experience`);
  }

  let experienceMin = experience.min;
  let experienceMax = experience.max;
  if (fresherSignal && experienceMin === null && experienceMax === null) {
    experienceMin = 0;
    experienceMax = 0;
  }

  const workMode = detectWorkMode(haystack);
  const employmentType = detectEmploymentType(haystack, firstGroup(text, LABELED_EMPLOYMENT));
  const batchYears = [...new Set(text.match(BATCH_YEAR_PATTERN) ?? [])].sort();
  const applyEmail = EMAIL_PATTERN.exec(text)?.[0] ?? null;
  const applyUrl =
    pickApplyUrl(text) ?? (rawPost.rawUrl.startsWith("http") ? rawPost.rawUrl : null);

  const data: ExtractedJobData = {
    isHiringPost: true,
    isTechRole,
    companyName: stripBoardSuffix(firstGroup(text, LABELED_COMPANY)),
    roleTitle: title.slice(0, 150),
    roleCategory,
    location: firstGroup(text, LABELED_LOCATION),
    workMode,
    employmentType,
    experienceMin,
    experienceMax,
    qualification: extractQualification(text),
    batchYears,
    skills,
    salaryText: extractSalary(text),
    applyUrl,
    applyEmail,
    sourceUrl: rawPost.rawUrl,
    postedAt: rawPost.postedAt,
    reason: `Rule-based extraction matched ${skills.length} skill(s), work mode ${workMode}, employment type ${employmentType}.`,
  };

  return { status: "extracted", provider: "rules", model: null, data };
}
