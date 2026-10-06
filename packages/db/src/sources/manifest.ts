import type {
  SourceCategory,
  SourcePlatform,
  SourcePriority,
  SourceRegion,
  SourceType,
} from "@foundryjobs/shared";

export type SourceDefinition = {
  slug: string;
  name: string;
  type: SourceType;
  platform: SourcePlatform;
  url: string;
  atsType: string | null;
  category: SourceCategory;
  region: SourceRegion;
  priority: SourcePriority;
  trustLevel: number;
  fetchIntervalMinutes: number;
  isActive: boolean;
};

function define(
  slug: string,
  name: string,
  platform: SourcePlatform,
  url: string,
  category: SourceCategory,
  region: SourceRegion,
  priority: SourcePriority,
  options: { type?: SourceType; trustLevel?: number; fetchIntervalMinutes?: number } = {},
): SourceDefinition {
  return {
    slug,
    name,
    type: options.type ?? "ats",
    platform,
    url,
    atsType: platform === "rss" ? null : platform,
    category,
    region,
    priority,
    trustLevel: options.trustLevel ?? (platform === "rss" ? 60 : 80),
    fetchIntervalMinutes: options.fetchIntervalMinutes ?? 60,
    isActive: true,
  };
}

const greenhouse = (
  slug: string,
  name: string,
  category: SourceCategory,
  region: SourceRegion,
  priority: SourcePriority,
) =>
  define(
    slug,
    name,
    "greenhouse",
    `https://boards.greenhouse.io/${slug}`,
    category,
    region,
    priority,
  );

const ashby = (
  slug: string,
  name: string,
  category: SourceCategory,
  region: SourceRegion,
  priority: SourcePriority,
) => define(slug, name, "ashby", `https://jobs.ashbyhq.com/${slug}`, category, region, priority);

const lever = (
  slug: string,
  name: string,
  category: SourceCategory,
  region: SourceRegion,
  priority: SourcePriority,
) => define(slug, name, "lever", `https://jobs.lever.co/${slug}`, category, region, priority);

export const BIG_TECH_SOURCES: SourceDefinition[] = [
  greenhouse("cloudflare", "Cloudflare", "big_tech", "global", "high"),
  greenhouse("datadog", "Datadog", "big_tech", "global", "normal"),
  greenhouse("stripe", "Stripe", "big_tech", "global", "high"),
  greenhouse("reddit", "Reddit", "big_tech", "global", "normal"),
  greenhouse("dropbox", "Dropbox", "big_tech", "global", "normal"),
  greenhouse("coinbase", "Coinbase", "big_tech", "global", "normal"),
  greenhouse("airbnb", "Airbnb", "big_tech", "global", "normal"),
  greenhouse("pinterest", "Pinterest", "big_tech", "global", "normal"),
  greenhouse("twilio", "Twilio", "big_tech", "global", "normal"),
  greenhouse("roblox", "Roblox", "big_tech", "global", "normal"),
  greenhouse("mongodb", "MongoDB", "big_tech", "global", "normal"),
  greenhouse("elastic", "Elastic", "big_tech", "global", "normal"),
  greenhouse("databricks", "Databricks", "big_tech", "global", "high"),
  greenhouse("discord", "Discord", "big_tech", "global", "normal"),
  greenhouse("figma", "Figma", "big_tech", "global", "high"),
  ashby("openai", "OpenAI", "big_tech", "global", "high"),
  define(
    "nvidia-workday",
    "NVIDIA (Workday)",
    "workday",
    "https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite",
    "big_tech",
    "global",
    "high",
    { fetchIntervalMinutes: 240 },
  ),
  define(
    "salesforce-workday",
    "Salesforce (Workday)",
    "workday",
    "https://salesforce.wd12.myworkdayjobs.com/External_Career_Site",
    "big_tech",
    "global",
    "normal",
    { fetchIntervalMinutes: 240 },
  ),
];

export const STARTUP_SOURCES: SourceDefinition[] = [
  greenhouse("samsara", "Samsara", "startup", "global", "normal"),
  greenhouse("affirm", "Affirm", "startup", "global", "normal"),
  greenhouse("chime", "Chime", "startup", "global", "low"),
  greenhouse("duolingo", "Duolingo", "startup", "global", "normal"),
  ashby("hex", "Hex", "startup", "global", "low"),
  ashby("render", "Render", "startup", "global", "low"),
  ashby("linear", "Linear", "startup", "global", "normal"),
  ashby("clerk", "Clerk", "startup", "global", "normal"),
  lever("zeta", "Zeta (Lever)", "startup", "india", "normal"),
  lever("cred", "CRED (Lever)", "startup", "india", "normal"),
];

export const YC_SOURCES: SourceDefinition[] = [
  greenhouse("instacart", "Instacart (YC S12)", "yc", "global", "normal"),
  greenhouse("brex", "Brex (YC W17)", "yc", "global", "normal"),
  greenhouse("checkr", "Checkr (YC S14)", "yc", "global", "low"),
  greenhouse("faire", "Faire (YC W17)", "yc", "global", "low"),
  greenhouse("gusto", "Gusto (YC W12)", "yc", "global", "normal"),
  greenhouse("mixpanel", "Mixpanel (YC S09)", "yc", "global", "low"),
  greenhouse("pagerduty", "PagerDuty (YC S10)", "yc", "global", "normal"),
  greenhouse("scaleai", "Scale AI (YC S16)", "yc", "global", "normal"),
  greenhouse("webflow", "Webflow (YC S13)", "yc", "global", "normal"),
  greenhouse("groww", "Groww (YC W18)", "yc", "india", "high"),
  ashby("ashby", "Ashby (YC W19)", "yc", "global", "low"),
  ashby("modal", "Modal (YC)", "yc", "global", "low"),
  ashby("posthog", "PostHog (YC W20)", "yc", "global", "low"),
  ashby("ramp", "Ramp (YC W19)", "yc", "global", "normal"),
  ashby("replit", "Replit (YC W18)", "yc", "global", "normal"),
  ashby("resend", "Resend (YC W23)", "yc", "global", "low"),
  ashby("supabase", "Supabase (YC S20)", "yc", "global", "normal"),
  ashby("vanta", "Vanta (YC S18)", "yc", "global", "low"),
  ashby("warp", "Warp (YC)", "yc", "global", "low"),
];

export const REMOTE_SOURCES: SourceDefinition[] = [
  greenhouse("gitlab", "GitLab (all-remote)", "remote", "remote", "high"),
  greenhouse("canonical", "Canonical (remote-first)", "remote", "remote", "high"),
  define(
    "himalayas-rss",
    "Himalayas Remote Jobs (RSS)",
    "rss",
    "https://himalayas.app/jobs/rss",
    "remote",
    "remote",
    "normal",
    { type: "rss", fetchIntervalMinutes: 120 },
  ),
  define(
    "weworkremotely-programming-rss",
    "We Work Remotely — Programming (RSS)",
    "rss",
    "https://weworkremotely.com/categories/remote-programming-jobs.rss",
    "remote",
    "remote",
    "normal",
    { type: "rss", fetchIntervalMinutes: 120 },
  ),
];

export const MASS_HIRING_SOURCES: SourceDefinition[] = [
  define(
    "bosch-smartrecruiters",
    "Bosch Group (SmartRecruiters)",
    "smartrecruiters",
    "https://jobs.smartrecruiters.com/BoschGroup",
    "mass_hiring",
    "mixed",
    "high",
    { fetchIntervalMinutes: 240 },
  ),
  define(
    "endava-smartrecruiters",
    "Endava (SmartRecruiters)",
    "smartrecruiters",
    "https://jobs.smartrecruiters.com/Endava",
    "mass_hiring",
    "mixed",
    "normal",
    { fetchIntervalMinutes: 240 },
  ),
  define(
    "pwc-workday",
    "PwC (Workday)",
    "workday",
    "https://pwc.wd3.myworkdayjobs.com/Global_Experienced_Careers",
    "mass_hiring",
    "mixed",
    "high",
    { fetchIntervalMinutes: 240 },
  ),
  define(
    "hp-workday",
    "HP (Workday)",
    "workday",
    "https://hp.wd5.myworkdayjobs.com/ExternalCareerSite",
    "mass_hiring",
    "mixed",
    "normal",
    { fetchIntervalMinutes: 240 },
  ),
  define(
    "micron-workday",
    "Micron (Workday)",
    "workday",
    "https://micron.wd1.myworkdayjobs.com/External",
    "mass_hiring",
    "mixed",
    "normal",
    { fetchIntervalMinutes: 240 },
  ),
  define(
    "intel-workday",
    "Intel (Workday)",
    "workday",
    "https://intel.wd1.myworkdayjobs.com/External",
    "mass_hiring",
    "mixed",
    "normal",
    { fetchIntervalMinutes: 240 },
  ),
  define(
    "visa-workday",
    "Visa (Workday)",
    "workday",
    "https://visa.wd5.myworkdayjobs.com/Visa",
    "mass_hiring",
    "mixed",
    "normal",
    { fetchIntervalMinutes: 240 },
  ),
  define(
    "cisco-workday",
    "Cisco (Workday)",
    "workday",
    "https://cisco.wd5.myworkdayjobs.com/Cisco_Careers",
    "mass_hiring",
    "mixed",
    "normal",
    { fetchIntervalMinutes: 240 },
  ),
];

export const SOURCE_MANIFEST: SourceDefinition[] = [
  ...BIG_TECH_SOURCES,
  ...STARTUP_SOURCES,
  ...YC_SOURCES,
  ...REMOTE_SOURCES,
  ...MASS_HIRING_SOURCES,
];

export function validateManifest(manifest: SourceDefinition[] = SOURCE_MANIFEST): string[] {
  const errors: string[] = [];
  const slugs = new Set<string>();
  const urls = new Set<string>();

  for (const source of manifest) {
    if (slugs.has(source.slug)) {
      errors.push(`duplicate source slug: ${source.slug}`);
    }
    slugs.add(source.slug);

    if (urls.has(source.url)) {
      errors.push(`duplicate canonical url: ${source.url}`);
    }
    urls.add(source.url);

    if (!/^https?:\/\//.test(source.url)) {
      errors.push(`source ${source.slug} has a non-http url`);
    }
    if (source.fetchIntervalMinutes < 5 || source.fetchIntervalMinutes > 1440) {
      errors.push(`source ${source.slug} has an out-of-range fetch interval`);
    }
    if (source.trustLevel < 0 || source.trustLevel > 100) {
      errors.push(`source ${source.slug} has an out-of-range trust level`);
    }
  }

  return errors;
}
