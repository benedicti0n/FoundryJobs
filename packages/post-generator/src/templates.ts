import type { JobPostWithScoreDto, GeneratedPostDraftInput } from "@foundryjobs/db";
import {
  FOUNDRYJOBS_CTA,
  PLATFORM_CHARACTER_LIMITS,
  type GeneratedPostPlatform,
  type PlatformPostDrafts,
} from "@foundryjobs/shared";
import {
  applyLine,
  applyTargetText,
  buildRelevanceLine,
  formatCompany,
  formatExperience,
  formatLocation,
  formatSkills,
  formatWorkMode,
  hasApplyInfo,
  normalizeSpacing,
  roleHashtag,
  truncateText,
} from "./formatters";
import { buildTelegramJobPost } from "./telegram-template";

const X_HARD_LIMIT = 320;

function joinLines(parts: Array<string | null>): string {
  return normalizeSpacing(parts.filter((part): part is string => part !== null).join("\n"));
}

export function buildTelegramDraft(job: JobPostWithScoreDto): string {
  return buildTelegramJobPost(job);
}

export function buildXDraft(job: JobPostWithScoreDto): string {
  const limit = PLATFORM_CHARACTER_LIMITS.x;
  const header = "🚨 Fresher Tech Hiring";
  const core = `${formatCompany(job.companyName)} — ${job.roleTitle}`;
  const experienceLine = `Exp: ${formatExperience(job)}`;
  const locationLine = `Loc: ${formatLocation(job.location)}`;
  const skillsLine = job.skills.length > 0 ? `Skills: ${formatSkills(job.skills, ", ", 4)}` : null;
  const apply = applyLine(job);
  const footer = "Follow @FoundryJobs";

  const candidates = [
    joinLines([header, "", core, experienceLine, locationLine, skillsLine, "", apply, "", footer]),
    joinLines([header, "", core, experienceLine, locationLine, "", apply, "", footer]),
    joinLines([header, "", core, experienceLine, "", apply, "", footer]),
    joinLines([header, "", core, apply, "", footer]),
    joinLines([`${core}\n${apply}\n@FoundryJobs`]),
  ];

  const fitting = candidates.find((candidate) => candidate.length <= limit);
  if (fitting) {
    return fitting;
  }

  const shortest = candidates.reduce((a, b) => (a.length <= b.length ? a : b));
  return truncateText(shortest, X_HARD_LIMIT);
}

export function buildInstagramDraft(job: JobPostWithScoreDto): string {
  const skills = formatSkills(job.skills, " • ");
  const applySentence = hasApplyInfo(job)
    ? "Apply using the link/email mentioned in the post."
    : "Apply link not available in source.";

  const draft = joinLines([
    "🚨 Fresher Tech Hiring Alert",
    "",
    `Role: ${job.roleTitle}`,
    `Company: ${formatCompany(job.companyName)}`,
    `Experience: ${formatExperience(job)}`,
    `Location: ${formatLocation(job.location)}`,
    skills.length > 0 ? `Skills: ${skills}` : null,
    "",
    applySentence,
    "",
    "Save this post and share it with a fresher who needs it.",
    "",
    FOUNDRYJOBS_CTA,
  ]);
  return truncateText(draft, PLATFORM_CHARACTER_LIMITS.instagram);
}

export function buildLinkedInDraft(job: JobPostWithScoreDto): string {
  const skills = job.skills.map((skill) => skill.trim()).filter((skill) => skill.length > 0);
  const relevance = buildRelevanceLine(job);
  const categoryTag = roleHashtag(job.roleCategory);
  const hashtags = ["#Hiring", "#Freshers", "#TechJobs", categoryTag, "#FoundryJobs"]
    .filter((tag): tag is string => Boolean(tag))
    .filter((tag, index, all) => all.indexOf(tag) === index)
    .join(" ");

  const skillLines = skills.length > 0 ? skills.map((skill) => `- ${skill}`) : [];

  const draft = joinLines([
    "Hiring Alert for Freshers and Early-Career Tech Candidates",
    "",
    `Company: ${formatCompany(job.companyName)}`,
    `Role: ${job.roleTitle}`,
    `Experience: ${formatExperience(job)}`,
    `Location: ${formatLocation(job.location)}`,
    `Work mode: ${formatWorkMode(job.workMode)}`,
    "",
    ...(skillLines.length > 0 ? ["Key skills:", ...skillLines] : []),
    "",
    relevance,
    "",
    `Apply: ${applyTargetText(job)}`,
    "",
    "Please verify the official source before sharing personal documents.",
    "",
    hashtags,
  ]);
  return truncateText(draft, PLATFORM_CHARACTER_LIMITS.linkedin);
}

export function generatePlatformDrafts(job: JobPostWithScoreDto): PlatformPostDrafts {
  return {
    telegram: buildTelegramDraft(job),
    x: buildXDraft(job),
    instagram: buildInstagramDraft(job),
    linkedin: buildLinkedInDraft(job),
  };
}

export function buildPlatformDrafts(
  job: JobPostWithScoreDto,
  platforms: GeneratedPostPlatform[],
  options: { telegramLogoUrl?: string | null; instagramTriggerKeyword?: string | null } = {},
): GeneratedPostDraftInput[] {
  const drafts: GeneratedPostDraftInput[] = [];
  for (const platform of platforms) {
    switch (platform) {
      case "telegram":
        drafts.push({
          platform,
          textContent: buildTelegramDraft(job),
          imageUrl: options.telegramLogoUrl ?? null,
        });
        break;
      case "x":
        drafts.push({ platform, textContent: buildXDraft(job) });
        break;
      case "instagram":
        drafts.push({
          platform,
          textContent: buildInstagramDraft(job),
          triggerKeyword: options.instagramTriggerKeyword ?? null,
        });
        break;
      case "linkedin":
        drafts.push({ platform, textContent: buildLinkedInDraft(job) });
        break;
    }
  }
  return drafts;
}
