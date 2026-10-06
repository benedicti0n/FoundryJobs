import { eq, sql } from "drizzle-orm";
import { isEnvSet } from "@foundryjobs/shared";
import { getDatabase, type Database } from "../client";
import { DatabaseNotConfiguredError } from "../errors";
import { companies } from "../schema";

export type CompanyBranding = {
  id: string;
  name: string;
  domain: string | null;
  logoUrl: string | null;
};

function requireDatabase(): Database {
  if (!isEnvSet("DATABASE_URL")) {
    throw new DatabaseNotConfiguredError(
      "DATABASE_URL is required for company repository operations",
    );
  }
  return getDatabase();
}

export async function getCompanyBrandingByName(name: string): Promise<CompanyBranding | null> {
  const database = requireDatabase();
  const normalized = name.trim();
  if (normalized.length === 0) {
    return null;
  }

  const [row] = await database
    .select({
      id: companies.id,
      name: companies.name,
      domain: companies.domain,
      logoUrl: companies.logoUrl,
    })
    .from(companies)
    .where(sql`lower(${companies.name}) = lower(${normalized})`)
    .limit(1);

  return row ?? null;
}

export async function getCompanyBrandingByDomain(domain: string): Promise<CompanyBranding | null> {
  const database = requireDatabase();
  const normalized = domain.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }

  const [row] = await database
    .select({
      id: companies.id,
      name: companies.name,
      domain: companies.domain,
      logoUrl: companies.logoUrl,
    })
    .from(companies)
    .where(eq(companies.domain, normalized))
    .limit(1);

  return row ?? null;
}
