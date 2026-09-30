export const SOURCE_TYPES = [
  "ats",
  "company_careers",
  "rss",
  "web_page",
  "telegram_channel",
  "x_search",
  "manual",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_PLATFORMS = [
  "greenhouse",
  "lever",
  "ashby",
  "workable",
  "workday",
  "generic",
  "telegram",
  "x",
  "manual",
] as const;

export type SourcePlatform = (typeof SOURCE_PLATFORMS)[number];

export const SOURCE_TRUST_LEVEL_MIN = 0;
export const SOURCE_TRUST_LEVEL_MAX = 100;
export const SOURCE_FETCH_INTERVAL_MIN_MINUTES = 5;
export const SOURCE_FETCH_INTERVAL_MAX_MINUTES = 1440;
export const SOURCE_LIST_DEFAULT_LIMIT = 50;
export const SOURCE_LIST_MAX_LIMIT = 200;
export const SOURCE_LIST_MAX_OFFSET = 1_000_000;

export const SOURCE_DEFAULTS = {
  trustLevel: 50,
  fetchIntervalMinutes: 60,
  isActive: true,
} as const;

export type CreateSourceInput = {
  name: string;
  type: SourceType;
  platform?: SourcePlatform | null;
  url: string;
  atsType?: string | null;
  trustLevel?: number;
  fetchIntervalMinutes?: number;
  isActive?: boolean;
};

export type UpdateSourceInput = {
  name?: string;
  type?: SourceType;
  platform?: SourcePlatform | null;
  url?: string;
  atsType?: string | null;
  trustLevel?: number;
  fetchIntervalMinutes?: number;
  isActive?: boolean;
};

export type SetSourceActiveInput = {
  isActive: boolean;
};

export type SourceDto = {
  id: string;
  name: string;
  type: SourceType;
  platform: SourcePlatform | null;
  url: string;
  atsType: string | null;
  trustLevel: number;
  fetchIntervalMinutes: number;
  isActive: boolean;
  lastFetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SourceListQuery = {
  type?: SourceType;
  platform?: SourcePlatform;
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
};

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseRequiredString(value: unknown, field: string, errors: string[]): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${field} must be a non-empty string`);
    return undefined;
  }
  return value.trim();
}

function parseRequiredHttpUrl(value: unknown, field: string, errors: string[]): string | undefined {
  const raw = typeof value === "string" ? value.trim() : "";
  if (raw.length === 0 || !isValidHttpUrl(raw)) {
    errors.push(`${field} must be a valid http(s) URL`);
    return undefined;
  }
  return raw;
}

function parseOptionalNullableString(
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
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${field} must be a non-empty string or null`);
    return undefined;
  }
  return value.trim();
}

function parseRequiredEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
  errors: string[],
): T | undefined {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    errors.push(`${field} must be one of: ${allowed.join(", ")}`);
    return undefined;
  }
  return value as T;
}

function parseOptionalEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
  errors: string[],
): T | undefined {
  if (value === undefined) {
    return undefined;
  }
  return parseRequiredEnum(value, field, allowed, errors);
}

function parseOptionalNullableEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
  errors: string[],
): T | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return parseRequiredEnum(value, field, allowed, errors);
}

function parseOptionalIntegerInRange(
  value: unknown,
  field: string,
  min: number,
  max: number,
  errors: string[],
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    errors.push(`${field} must be an integer between ${min} and ${max}`);
    return undefined;
  }
  return value;
}

function parseOptionalBoolean(
  value: unknown,
  field: string,
  errors: string[],
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    errors.push(`${field} must be a boolean`);
    return undefined;
  }
  return value;
}

function parseQueryInteger(
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

export function validateCreateSourceInput(input: unknown): ValidationResult<CreateSourceInput> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["Request body must be a JSON object"] };
  }

  const errors: string[] = [];
  const name = parseRequiredString(input.name, "name", errors);
  const type = parseRequiredEnum(input.type, "type", SOURCE_TYPES, errors);
  const url = parseRequiredHttpUrl(input.url, "url", errors);
  const platform = parseOptionalNullableEnum(input.platform, "platform", SOURCE_PLATFORMS, errors);
  const atsType = parseOptionalNullableString(input.atsType, "atsType", errors);
  const trustLevel = parseOptionalIntegerInRange(
    input.trustLevel,
    "trustLevel",
    SOURCE_TRUST_LEVEL_MIN,
    SOURCE_TRUST_LEVEL_MAX,
    errors,
  );
  const fetchIntervalMinutes = parseOptionalIntegerInRange(
    input.fetchIntervalMinutes,
    "fetchIntervalMinutes",
    SOURCE_FETCH_INTERVAL_MIN_MINUTES,
    SOURCE_FETCH_INTERVAL_MAX_MINUTES,
    errors,
  );
  const isActive = parseOptionalBoolean(input.isActive, "isActive", errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  if (name === undefined || type === undefined || url === undefined) {
    return { ok: false, errors: ["name, type and url are required"] };
  }

  return {
    ok: true,
    data: {
      name,
      type,
      url,
      platform: platform ?? null,
      atsType: atsType ?? null,
      trustLevel: trustLevel ?? SOURCE_DEFAULTS.trustLevel,
      fetchIntervalMinutes: fetchIntervalMinutes ?? SOURCE_DEFAULTS.fetchIntervalMinutes,
      isActive: isActive ?? SOURCE_DEFAULTS.isActive,
    },
  };
}

export function validateUpdateSourceInput(input: unknown): ValidationResult<UpdateSourceInput> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["Request body must be a JSON object"] };
  }

  const errors: string[] = [];
  const data: UpdateSourceInput = {};
  let providedFields = 0;

  if (Object.hasOwn(input, "name")) {
    providedFields += 1;
    const name = parseRequiredString(input.name, "name", errors);
    if (name !== undefined) {
      data.name = name;
    }
  }

  if (Object.hasOwn(input, "type")) {
    providedFields += 1;
    const type = parseRequiredEnum(input.type, "type", SOURCE_TYPES, errors);
    if (type !== undefined) {
      data.type = type;
    }
  }

  if (Object.hasOwn(input, "url")) {
    providedFields += 1;
    const url = parseRequiredHttpUrl(input.url, "url", errors);
    if (url !== undefined) {
      data.url = url;
    }
  }

  if (Object.hasOwn(input, "platform")) {
    providedFields += 1;
    const platform = parseOptionalNullableEnum(
      input.platform,
      "platform",
      SOURCE_PLATFORMS,
      errors,
    );
    if (platform !== undefined) {
      data.platform = platform;
    }
  }

  if (Object.hasOwn(input, "atsType")) {
    providedFields += 1;
    const atsType = parseOptionalNullableString(input.atsType, "atsType", errors);
    if (atsType !== undefined) {
      data.atsType = atsType;
    }
  }

  if (Object.hasOwn(input, "trustLevel")) {
    providedFields += 1;
    const trustLevel = parseOptionalIntegerInRange(
      input.trustLevel,
      "trustLevel",
      SOURCE_TRUST_LEVEL_MIN,
      SOURCE_TRUST_LEVEL_MAX,
      errors,
    );
    if (trustLevel !== undefined) {
      data.trustLevel = trustLevel;
    }
  }

  if (Object.hasOwn(input, "fetchIntervalMinutes")) {
    providedFields += 1;
    const fetchIntervalMinutes = parseOptionalIntegerInRange(
      input.fetchIntervalMinutes,
      "fetchIntervalMinutes",
      SOURCE_FETCH_INTERVAL_MIN_MINUTES,
      SOURCE_FETCH_INTERVAL_MAX_MINUTES,
      errors,
    );
    if (fetchIntervalMinutes !== undefined) {
      data.fetchIntervalMinutes = fetchIntervalMinutes;
    }
  }

  if (Object.hasOwn(input, "isActive")) {
    providedFields += 1;
    const isActive = parseOptionalBoolean(input.isActive, "isActive", errors);
    if (isActive !== undefined) {
      data.isActive = isActive;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  if (providedFields === 0) {
    return { ok: false, errors: ["At least one field must be provided"] };
  }

  return { ok: true, data };
}

export function validateSetSourceActiveInput(
  input: unknown,
): ValidationResult<SetSourceActiveInput> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["Request body must be a JSON object"] };
  }
  if (typeof input.isActive !== "boolean") {
    return { ok: false, errors: ["isActive must be a boolean"] };
  }
  return { ok: true, data: { isActive: input.isActive } };
}

export function parseSourceListQuery(raw: unknown): ValidationResult<SourceListQuery> {
  const input = isRecord(raw) ? raw : {};
  const errors: string[] = [];
  const data: SourceListQuery = {};

  const type = parseOptionalEnum(input.type, "type", SOURCE_TYPES, errors);
  if (type !== undefined) {
    data.type = type;
  }

  const platform = parseOptionalEnum(input.platform, "platform", SOURCE_PLATFORMS, errors);
  if (platform !== undefined) {
    data.platform = platform;
  }

  if (input.isActive !== undefined) {
    if (input.isActive === "true" || input.isActive === true) {
      data.isActive = true;
    } else if (input.isActive === "false" || input.isActive === false) {
      data.isActive = false;
    } else {
      errors.push("isActive must be true or false");
    }
  }

  if (input.search !== undefined) {
    if (typeof input.search !== "string") {
      errors.push("search must be a string");
    } else {
      const search = input.search.trim();
      if (search.length > 0) {
        data.search = search;
      }
    }
  }

  const limit = parseQueryInteger(input.limit, "limit", 1, SOURCE_LIST_MAX_LIMIT, errors);
  if (limit !== undefined) {
    data.limit = limit;
  }

  const offset = parseQueryInteger(input.offset, "offset", 0, SOURCE_LIST_MAX_OFFSET, errors);
  if (offset !== undefined) {
    data.offset = offset;
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data };
}
