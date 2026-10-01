import type { RenderableInstagramPostDto } from "@foundryjobs/shared";

export type InstagramCardBadge = "Fresher Role" | "Internship" | "Tech Role";

export type InstagramCardViewModel = {
  brandName: string;
  badge: InstagramCardBadge;
  roleTitle: string;
  companyName: string;
  experience: string;
  location: string;
  workMode: string | null;
  skills: string | null;
  cta: string;
  footer: string;
};

export const CARD_FALLBACKS = {
  company: "Company not specified",
  location: "Location not specified",
  experience: "Not specified",
} as const;

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function formatExperienceForCard(post: RenderableInstagramPostDto): string {
  const isInternship = post.employmentType === "internship";
  const min = post.experienceMin;
  const max = post.experienceMax;

  let range: string | null = null;
  if (min !== null && max !== null) {
    if (max <= 0) {
      range = "Freshers";
    } else if (min <= 0) {
      range = `Freshers / 0–${max} YOE`;
    } else {
      range = `${min}–${max} YOE`;
    }
  } else if (min !== null) {
    range = `${min}+ YOE`;
  } else if (max !== null) {
    range = max <= 0 ? "Freshers" : `Up to ${max} YOE`;
  }

  if (isInternship) {
    return range ? `Internship / ${range}` : "Internship";
  }
  return range ?? CARD_FALLBACKS.experience;
}

function formatWorkModeForCard(post: RenderableInstagramPostDto): string | null {
  switch (post.workMode) {
    case "remote":
      return "Remote";
    case "hybrid":
      return "Hybrid";
    case "onsite":
      return "Onsite";
    default:
      return null;
  }
}

function formatSkillsForCard(skills: string[]): string | null {
  const cleaned = skills.map((skill) => skill.trim()).filter((skill) => skill.length > 0);
  if (cleaned.length === 0) {
    return null;
  }
  const joined = cleaned.join(" • ");
  return joined.length > 64 ? `${joined.slice(0, 61)}...` : joined;
}

function deriveBadge(post: RenderableInstagramPostDto): InstagramCardBadge {
  if (post.employmentType === "internship") {
    return "Internship";
  }
  if (post.experienceMax !== null && post.experienceMax <= 1) {
    return "Fresher Role";
  }
  if (post.experienceMin === 0) {
    return "Fresher Role";
  }
  return "Tech Role";
}

export function formatCardData(post: RenderableInstagramPostDto): InstagramCardViewModel {
  return {
    brandName: "FoundryJobs",
    badge: deriveBadge(post),
    roleTitle: clean(post.roleTitle) ?? "Untitled role",
    companyName: clean(post.companyName) ?? CARD_FALLBACKS.company,
    experience: formatExperienceForCard(post),
    location: clean(post.location) ?? CARD_FALLBACKS.location,
    workMode: formatWorkModeForCard(post),
    skills: formatSkillsForCard(post.skills),
    cta: "Apply Now",
    footer: "Fresh tech hiring alerts",
  };
}
