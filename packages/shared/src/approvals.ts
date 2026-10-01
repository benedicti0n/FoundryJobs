import type { ValidationResult } from "./sources";
import type {
  ApprovalDecision,
  EmploymentType,
  GeneratedPostPlatform,
  GeneratedPostStatus,
  SpamRisk,
  WorkMode,
} from "./types";

export const APPROVAL_DECISIONS = ["approved", "rejected", "needs_edit"] as const;

export type ApprovalQueueItemDto = {
  generatedPostId: string;
  jobPostId: string;
  platform: GeneratedPostPlatform;
  formatType: string;
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
  totalScore: number | null;
  shouldPost: boolean | null;
  spamRisk: SpamRisk | null;
  aiReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApprovalActionInput = {
  decision: ApprovalDecision;
  notes?: string | null;
  decidedBy?: string | null;
  textContent?: string | null;
};

export type ApprovalActionResult = {
  generatedPostId: string;
  jobPostId: string;
  platform: GeneratedPostPlatform;
  decision: ApprovalDecision;
  generatedPostStatus: GeneratedPostStatus;
  approvalId: string;
  textContent: string;
};

export type ApprovalQueueQuery = {
  platform?: GeneratedPostPlatform;
  status?: GeneratedPostStatus;
  limit?: number;
  offset?: number;
};

export type UpdateGeneratedPostTextInput = {
  textContent: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOptionalNullableString(
  value: unknown,
  field: string,
  errors: string[],
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    errors.push(`${field} must be a string or null`);
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateApprovalActionInput(input: unknown): ValidationResult<ApprovalActionInput> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["Request body must be a JSON object"] };
  }

  const errors: string[] = [];

  let decision: ApprovalDecision | undefined;
  if (
    typeof input.decision !== "string" ||
    !(APPROVAL_DECISIONS as readonly string[]).includes(input.decision)
  ) {
    errors.push(`decision must be one of: ${APPROVAL_DECISIONS.join(", ")}`);
  } else {
    decision = input.decision as ApprovalDecision;
  }

  const notes = readOptionalNullableString(input.notes, "notes", errors);
  const decidedBy = readOptionalNullableString(input.decidedBy, "decidedBy", errors);

  let textContent: string | null | undefined;
  if (input.textContent === undefined) {
    textContent = undefined;
  } else if (input.textContent === null) {
    textContent = null;
  } else if (typeof input.textContent !== "string" || input.textContent.trim().length === 0) {
    errors.push("textContent must be a non-empty string when provided");
  } else {
    textContent = input.textContent.trim();
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  if (decision === undefined) {
    return { ok: false, errors: ["decision is required"] };
  }

  return {
    ok: true,
    data: {
      decision,
      notes: notes ?? null,
      decidedBy: decidedBy ?? null,
      textContent: textContent ?? null,
    },
  };
}

export function validateUpdateGeneratedPostTextInput(
  input: unknown,
): ValidationResult<UpdateGeneratedPostTextInput> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["Request body must be a JSON object"] };
  }
  if (typeof input.textContent !== "string" || input.textContent.trim().length === 0) {
    return { ok: false, errors: ["textContent must be a non-empty string"] };
  }
  return { ok: true, data: { textContent: input.textContent.trim() } };
}
