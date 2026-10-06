import { eq } from "drizzle-orm";
import { isEnvSet, isPublicHttpUrl, validateRemoteImageUrl } from "@foundryjobs/shared";
import { getDatabase, type Database } from "../client";
import { DatabaseNotConfiguredError } from "../errors";
import { companies } from "../schema";
import { getCompanyBrandingByName } from "../repositories/companies";
import { listSources } from "../repositories/sources";

const ASHBY_LOGO_RE =
  /https:\/\/cdn\.ashbyprd\.com\/cdn_assets\/[a-f0-9]+\/(apple-touch-icon|favicon)\.png/gi;

const BOARD_FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT = "FoundryJobsBot/0.1 (+https://foundryjobs.local)";

export function parseAshbyLogoUrl(html: string): string | null {
  const matches = [...html.matchAll(ASHBY_LOGO_RE)].map((match) => match[0]);
  if (matches.length === 0) {
    return null;
  }
  const appleTouchIcon = matches.find((url) => url.includes("apple-touch-icon"));
  return appleTouchIcon ?? matches[0] ?? null;
}

export async function resolveAshbyLogoUrl(sourceUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BOARD_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(sourceUrl, {
      headers: { "user-agent": USER_AGENT, accept: "text/html" },
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    return parseAshbyLogoUrl(await response.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function companyNameFromSourceName(sourceName: string): string {
  return sourceName.replace(/\s*\(.*\)\s*$/, "").trim();
}

export type CompanyLogoSource = {
  companyName: string;
  sourceUrl: string;
  platform: string;
};

export type CompanyLogoDeps = {
  resolver?: (source: CompanyLogoSource) => Promise<string | null>;
  validator?: (url: string) => Promise<{ ok: boolean; reason?: string }>;
};

export type CompanyLogoDepsRequired = {
  resolver: (source: CompanyLogoSource) => Promise<string | null>;
  validator: (url: string) => Promise<{ ok: boolean; reason?: string }>;
};

export type CompanyLogoEntry = {
  companyName: string;
  logoUrl: string | null;
  status: "resolved" | "unchanged" | "unresolved" | "invalid";
  reason?: string;
};

export type CompanyLogoReport = {
  dryRun: boolean;
  companies: number;
  resolved: number;
  unchanged: number;
  unresolved: number;
  invalid: number;
  updated: number;
  entries: CompanyLogoEntry[];
};

function requireDatabase(): Database {
  if (!isEnvSet("DATABASE_URL")) {
    throw new DatabaseNotConfiguredError(
      "DATABASE_URL is required for company logo sync operations",
    );
  }
  return getDatabase();
}

async function upsertCompanyLogo(companyName: string, logoUrl: string): Promise<void> {
  const database = requireDatabase();
  const existing = await getCompanyBrandingByName(companyName);
  if (!existing) {
    await database.insert(companies).values({ name: companyName, logoUrl });
    return;
  }
  await database
    .update(companies)
    .set({ logoUrl, updatedAt: new Date() })
    .where(eq(companies.id, existing.id));
}

export async function syncCompanyLogos(
  options: { dryRun?: boolean; refresh?: boolean; deps?: CompanyLogoDeps } = {},
): Promise<CompanyLogoReport> {
  const dryRun = options.dryRun ?? false;
  const refresh = options.refresh ?? false;
  const resolver =
    options.deps?.resolver ??
    (async (source: CompanyLogoSource) =>
      source.platform === "ashby" ? resolveAshbyLogoUrl(source.sourceUrl) : null);
  const validator =
    options.deps?.validator ??
    (async (url: string) => {
      const result = await validateRemoteImageUrl(url);
      return result.ok ? { ok: true } : { ok: false, reason: result.reason };
    });

  const sources = (await listSources({ isActive: true, limit: 200 })).filter(
    (source) => source.platform !== "rss",
  );

  const byCompany = new Map<string, CompanyLogoSource>();
  for (const source of sources) {
    const companyName = companyNameFromSourceName(source.name);
    if (companyName.length === 0 || byCompany.has(companyName)) {
      continue;
    }
    byCompany.set(companyName, {
      companyName,
      sourceUrl: source.url,
      platform: source.platform ?? "unknown",
    });
  }

  const report: CompanyLogoReport = {
    dryRun,
    companies: byCompany.size,
    resolved: 0,
    unchanged: 0,
    unresolved: 0,
    invalid: 0,
    updated: 0,
    entries: [],
  };

  const candidates = new Map<
    string,
    { entry: CompanyLogoSource; logoUrl: string; existingLogo: string | null }
  >();
  const candidateUsage = new Map<string, number>();

  for (const entry of byCompany.values()) {
    const existing = await getCompanyBrandingByName(entry.companyName);
    const existingLogo = existing?.logoUrl?.trim() ?? null;

    if (existingLogo && !refresh && isPublicHttpUrl(existingLogo)) {
      report.unchanged += 1;
      report.entries.push({
        companyName: entry.companyName,
        logoUrl: existingLogo,
        status: "unchanged",
      });
      continue;
    }

    const candidate = await resolver(entry);
    if (!candidate) {
      report.unresolved += 1;
      report.entries.push({ companyName: entry.companyName, logoUrl: null, status: "unresolved" });
      continue;
    }

    candidates.set(entry.companyName, { entry, logoUrl: candidate, existingLogo });
    candidateUsage.set(candidate, (candidateUsage.get(candidate) ?? 0) + 1);
  }

  for (const { entry, logoUrl, existingLogo } of candidates.values()) {
    if ((candidateUsage.get(logoUrl) ?? 0) > 1) {
      report.unresolved += 1;
      report.entries.push({
        companyName: entry.companyName,
        logoUrl: null,
        status: "unresolved",
        reason: "shared platform default asset, not company-specific",
      });
      continue;
    }

    const validation = await validator(logoUrl);
    if (!validation.ok) {
      report.invalid += 1;
      report.entries.push({
        companyName: entry.companyName,
        logoUrl: null,
        status: "invalid",
        reason: validation.reason,
      });
      continue;
    }

    report.resolved += 1;
    if (existingLogo !== logoUrl) {
      report.updated += 1;
    }
    report.entries.push({ companyName: entry.companyName, logoUrl, status: "resolved" });
    if (!dryRun) {
      await upsertCompanyLogo(entry.companyName, logoUrl);
    }
  }

  return report;
}
