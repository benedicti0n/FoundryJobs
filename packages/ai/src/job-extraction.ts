import {
  isEnvSet,
  type EmploymentType,
  type ExtractedJobData,
  type JobExtractionResult,
  type WorkMode,
} from "@foundryjobs/shared";
import { generateStructuredJson, getGeminiModel } from "./gemini";
import { buildJobExtractionPrompt, type RawPostForExtraction } from "./prompts/job-extraction";
import { extractJobWithRules } from "./rule-extractor";

const WORK_MODES: readonly WorkMode[] = ["remote", "hybrid", "onsite", "unknown"];
const EMPLOYMENT_TYPES: readonly EmploymentType[] = [
  "internship",
  "full_time",
  "part_time",
  "contract",
  "unknown",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fence?.[1]?.trim() ?? trimmed;
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(stripMarkdownFences(text));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function asStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asIntOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeExtractedData(raw: unknown): ExtractedJobData | null {
  if (!isRecord(raw)) {
    return null;
  }

  const roleTitle = asStringOrNull(raw.roleTitle);
  if (!roleTitle) {
    return null;
  }

  const workMode = WORK_MODES.includes(raw.workMode as WorkMode)
    ? (raw.workMode as WorkMode)
    : "unknown";
  const employmentType = EMPLOYMENT_TYPES.includes(raw.employmentType as EmploymentType)
    ? (raw.employmentType as EmploymentType)
    : "unknown";

  return {
    isHiringPost: asBoolean(raw.isHiringPost, true),
    isTechRole: asBoolean(raw.isTechRole, true),
    companyName: asStringOrNull(raw.companyName),
    roleTitle,
    roleCategory: asStringOrNull(raw.roleCategory),
    location: asStringOrNull(raw.location),
    workMode,
    employmentType,
    experienceMin: asIntOrNull(raw.experienceMin),
    experienceMax: asIntOrNull(raw.experienceMax),
    qualification: asStringOrNull(raw.qualification),
    batchYears: asStringArray(raw.batchYears),
    skills: asStringArray(raw.skills),
    salaryText: asStringOrNull(raw.salaryText),
    applyUrl: asStringOrNull(raw.applyUrl),
    applyEmail: asStringOrNull(raw.applyEmail),
    sourceUrl: asStringOrNull(raw.sourceUrl),
    postedAt: asStringOrNull(raw.postedAt),
    reason: asStringOrNull(raw.reason),
  };
}

export async function extractJobFromRawPost(
  rawPost: RawPostForExtraction,
): Promise<JobExtractionResult> {
  if (!isEnvSet("GEMINI_API_KEY")) {
    return extractJobWithRules(rawPost);
  }

  const fallbackModel = getGeminiModel();

  try {
    const generation = await generateStructuredJson(buildJobExtractionPrompt(rawPost));
    const usage = {
      inputTokens: generation.inputTokens,
      outputTokens: generation.outputTokens,
      latencyMs: generation.latencyMs,
    };

    const parsed = parseJsonObject(generation.text);
    if (!parsed) {
      return {
        status: "error",
        provider: "gemini",
        model: generation.model,
        errorMessage: "Gemini returned invalid JSON",
        usage,
      };
    }

    if (parsed.status === "rejected") {
      return {
        status: "rejected",
        provider: "gemini",
        model: generation.model,
        errorMessage: asStringOrNull(parsed.reason) ?? "Rejected by Gemini extraction",
        usage,
      };
    }

    const data = normalizeExtractedData(parsed.data);
    if (!data) {
      return {
        status: "error",
        provider: "gemini",
        model: generation.model,
        errorMessage: "Gemini response is missing required extraction fields",
        usage,
      };
    }

    return { status: "extracted", provider: "gemini", model: generation.model, data, usage };
  } catch (error) {
    return {
      status: "error",
      provider: "gemini",
      model: fallbackModel,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}
