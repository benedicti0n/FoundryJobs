export type EnvCheckStatus = "present" | "missing";

export type EnvVariableDefinition = {
  name: string;
  required: boolean;
  note?: string;
};

export type EnvCheckCategory = {
  name: string;
  description: string;
  variables: readonly EnvVariableDefinition[];
};

export type EnvVariableCheck = {
  name: string;
  category: string;
  required: boolean;
  status: EnvCheckStatus;
  note?: string;
};

export type EnvCheckResult = {
  ok: boolean;
  checks: EnvVariableCheck[];
  missingRequired: string[];
  missingOptional: string[];
};

export const ENV_CHECK_CATEGORIES: readonly EnvCheckCategory[] = [
  {
    name: "Base app",
    description: "Required for the API, dashboard auth, and scheduler database access.",
    variables: [
      { name: "DATABASE_URL", required: true },
      { name: "ADMIN_USERNAME", required: true },
      { name: "ADMIN_PASSWORD", required: true },
      { name: "ADMIN_SESSION_SECRET", required: true },
      { name: "API_ADMIN_TOKEN", required: true },
      { name: "APP_BASE_URL", required: true },
    ],
  },
  {
    name: "AI extraction",
    description: "Optional; the normalizer falls back to the deterministic rules extractor.",
    variables: [
      { name: "GEMINI_API_KEY", required: false },
      { name: "GEMINI_MODEL", required: false, note: "defaults to gemini-2.5-flash-lite" },
    ],
  },
  {
    name: "Publishing",
    description: "Optional; required only for publishing to Telegram or Buffer.",
    variables: [
      { name: "TELEGRAM_BOT_TOKEN", required: false },
      { name: "TELEGRAM_CHAT_ID", required: false },
      { name: "BUFFER_ACCESS_TOKEN", required: false },
      { name: "BUFFER_PROFILE_ID_X", required: false },
      { name: "BUFFER_PROFILE_ID_INSTAGRAM", required: false },
      { name: "BUFFER_PROFILE_ID_LINKEDIN", required: false },
    ],
  },
  {
    name: "R2 storage",
    description: "Optional; required only for uploading Instagram cards to Cloudflare R2.",
    variables: [
      { name: "R2_ACCOUNT_ID", required: false },
      { name: "R2_ACCESS_KEY_ID", required: false },
      { name: "R2_SECRET_ACCESS_KEY", required: false },
      { name: "R2_BUCKET_NAME", required: false },
      { name: "R2_PUBLIC_BASE_URL", required: false },
    ],
  },
];

function isSet(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function checkEnvironment(
  env: Record<string, string | undefined> = process.env,
): EnvCheckResult {
  const checks: EnvVariableCheck[] = [];

  for (const category of ENV_CHECK_CATEGORIES) {
    for (const variable of category.variables) {
      checks.push({
        name: variable.name,
        category: category.name,
        required: variable.required,
        status: isSet(env[variable.name]) ? "present" : "missing",
        ...(variable.note ? { note: variable.note } : {}),
      });
    }
  }

  const missingRequired = checks
    .filter((check) => check.required && check.status === "missing")
    .map((check) => check.name);
  const missingOptional = checks
    .filter((check) => !check.required && check.status === "missing")
    .map((check) => check.name);

  return {
    ok: missingRequired.length === 0,
    checks,
    missingRequired,
    missingOptional,
  };
}

export function formatEnvCheckReport(result: EnvCheckResult): string[] {
  const lines: string[] = ["FoundryJobs environment check", ""];

  for (const category of ENV_CHECK_CATEGORIES) {
    lines.push(`${category.name}: ${category.description}`);
    for (const check of result.checks.filter((entry) => entry.category === category.name)) {
      const status =
        check.status === "present"
          ? "present"
          : check.required
            ? "MISSING (required)"
            : "missing (optional)";
      const note = check.note ? ` — ${check.note}` : "";
      lines.push(`  ${check.name}: ${status}${note}`);
    }
    lines.push("");
  }

  if (result.ok) {
    lines.push(
      `Base configuration is complete. ${result.missingOptional.length} optional variable(s) missing.`,
    );
  } else {
    lines.push(`Missing required variables: ${result.missingRequired.join(", ")}`);
  }

  return lines;
}
