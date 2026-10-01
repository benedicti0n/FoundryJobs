import { isUuid } from "@foundryjobs/shared";

const LIST_MAX_LIMIT = 200;
const LIST_MAX_OFFSET = 1_000_000;

export type ParsedListQuery = {
  status?: string;
  sourceId?: string;
  limit?: number;
  offset?: number;
};

export type ListQueryParseResult =
  { ok: true; value: ParsedListQuery } | { ok: false; errors: string[] };

function parseInteger(
  value: unknown,
  field: string,
  min: number,
  max: number,
  errors: string[],
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  let parsed: number | undefined;
  if (typeof value === "number") {
    parsed = value;
  } else if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    parsed = Number.parseInt(value.trim(), 10);
  }

  if (parsed === undefined || !Number.isInteger(parsed) || parsed < min || parsed > max) {
    errors.push(`${field} must be an integer between ${min} and ${max}`);
    return undefined;
  }
  return parsed;
}

export type ParsedPlatformListQuery = {
  platform?: string;
  status?: string;
  limit?: number;
  offset?: number;
};

export type PlatformListQueryParseResult =
  { ok: true; value: ParsedPlatformListQuery } | { ok: false; errors: string[] };

export function parsePlatformListQuery(
  raw: unknown,
  options: { statuses: readonly string[]; platforms: readonly string[] },
): PlatformListQueryParseResult {
  const input = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const errors: string[] = [];
  const value: ParsedPlatformListQuery = {};

  if (input.platform !== undefined) {
    if (typeof input.platform !== "string" || !options.platforms.includes(input.platform)) {
      errors.push(`platform must be one of: ${options.platforms.join(", ")}`);
    } else {
      value.platform = input.platform;
    }
  }

  if (input.status !== undefined) {
    if (typeof input.status !== "string" || !options.statuses.includes(input.status)) {
      errors.push(`status must be one of: ${options.statuses.join(", ")}`);
    } else {
      value.status = input.status;
    }
  }

  const limit = parseInteger(input.limit, "limit", 1, LIST_MAX_LIMIT, errors);
  if (limit !== undefined) {
    value.limit = limit;
  }

  const offset = parseInteger(input.offset, "offset", 0, LIST_MAX_OFFSET, errors);
  if (offset !== undefined) {
    value.offset = offset;
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value };
}

export function parseListQuery(
  raw: unknown,
  allowedStatuses: readonly string[],
): ListQueryParseResult {
  const input = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const errors: string[] = [];
  const value: ParsedListQuery = {};

  if (input.status !== undefined) {
    if (typeof input.status !== "string" || !allowedStatuses.includes(input.status)) {
      errors.push(`status must be one of: ${allowedStatuses.join(", ")}`);
    } else {
      value.status = input.status;
    }
  }

  if (input.sourceId !== undefined) {
    if (typeof input.sourceId !== "string" || !isUuid(input.sourceId)) {
      errors.push("sourceId must be a valid UUID");
    } else {
      value.sourceId = input.sourceId;
    }
  }

  const limit = parseInteger(input.limit, "limit", 1, LIST_MAX_LIMIT, errors);
  if (limit !== undefined) {
    value.limit = limit;
  }

  const offset = parseInteger(input.offset, "offset", 0, LIST_MAX_OFFSET, errors);
  if (offset !== undefined) {
    value.offset = offset;
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value };
}
