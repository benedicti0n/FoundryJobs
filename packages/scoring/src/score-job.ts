import {
  SPAM_KEYWORDS,
  TECH_KEYWORDS,
  countKeywordMatches,
  type ExtractedJobData,
  type JobScoreBreakdown,
  type SourcePlatform,
  type SpamRisk,
} from "@foundryjobs/shared";

export type JobScoringContext = {
  sourcePlatform?: SourcePlatform | null;
  sourceTrustLevel?: number | null;
  rawText?: string | null;
  now?: Date;
};

const ATS_PLATFORMS: readonly SourcePlatform[] = [
  "greenhouse",
  "lever",
  "ashby",
  "workable",
  "workday",
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function scoreFreshness(postedAt: string | null, now: Date): number {
  if (!postedAt) {
    return 8;
  }
  const date = new Date(postedAt);
  if (Number.isNaN(date.getTime())) {
    return 8;
  }

  const days = (now.getTime() - date.getTime()) / 86_400_000;
  if (days <= 7) {
    return 20;
  }
  if (days <= 14) {
    return 16;
  }
  if (days <= 30) {
    return 12;
  }
  if (days <= 60) {
    return 8;
  }
  if (days <= 90) {
    return 4;
  }
  return 0;
}

function scoreFresherFit(data: ExtractedJobData): number {
  if (data.employmentType === "internship") {
    return 25;
  }

  const max = data.experienceMax;
  let score: number;
  if (max == null) {
    score = 10;
  } else if (max <= 0) {
    score = 25;
  } else if (max === 1) {
    score = 22;
  } else if (max === 2) {
    score = 18;
  } else if (max === 3) {
    score = 14;
  } else {
    score = 0;
  }

  if (max !== 0 && data.batchYears.length > 0) {
    score = Math.min(25, score + 5);
  }

  return score;
}

function scoreTechRelevance(data: ExtractedJobData): number {
  if (!data.isTechRole) {
    return 0;
  }

  const skillsScore = Math.min(15, data.skills.length * 3);
  const titleHaystack = `${data.roleTitle} ${data.roleCategory ?? ""}`.toLowerCase();
  const keywordBonus = TECH_KEYWORDS.some((keyword) => titleHaystack.includes(keyword)) ? 5 : 3;

  return Math.min(20, skillsScore + keywordBonus);
}

function scoreTrust(
  data: ExtractedJobData,
  context: JobScoringContext,
  spamMatches: number,
): number {
  let score = 10;
  const platform = context.sourcePlatform ?? null;

  if (platform && ATS_PLATFORMS.includes(platform)) {
    score += 6;
  } else if (platform === "generic") {
    score += 2;
  }

  if (data.companyName) {
    score += 2;
  }
  if (data.applyUrl || data.applyEmail) {
    score += 2;
  }

  if (typeof context.sourceTrustLevel === "number") {
    if (context.sourceTrustLevel >= 70) {
      score += 2;
    } else if (context.sourceTrustLevel < 40) {
      score -= 2;
    }
  }

  if (spamMatches >= 2) {
    score -= 10;
  } else if (spamMatches === 1) {
    score -= 5;
  }

  return clamp(score, 0, 20);
}

function scoreRemote(data: ExtractedJobData, haystack: string): number {
  if (data.workMode === "remote") {
    return 10;
  }
  if (data.workMode === "hybrid") {
    return 6;
  }
  if (/remote after training|remote after probation/.test(haystack)) {
    return 5;
  }
  if (data.workMode === "onsite") {
    return 0;
  }
  return 2;
}

function scoreClarity(data: ExtractedJobData): number {
  let score = 0;
  if (data.roleTitle.trim().length >= 6) {
    score += 2;
  }
  if (data.companyName) {
    score += 1;
  }
  if (data.applyUrl || data.applyEmail) {
    score += 1;
  }
  if (data.skills.length > 0) {
    score += 1;
  }
  return Math.min(5, score);
}

export function scoreJob(
  data: ExtractedJobData,
  context: JobScoringContext = {},
): JobScoreBreakdown {
  const now = context.now ?? new Date();
  const haystack =
    `${data.roleTitle} ${data.roleCategory ?? ""} ${data.location ?? ""} ${context.rawText ?? ""} ${data.skills.join(" ")}`.toLowerCase();

  const freshnessScore = scoreFreshness(data.postedAt ?? null, now);
  const fresherFitScore = scoreFresherFit(data);
  const techRelevanceScore = scoreTechRelevance(data);

  const spamMatches = countKeywordMatches(haystack, SPAM_KEYWORDS);
  const spamRisk: SpamRisk = spamMatches >= 2 ? "high" : spamMatches === 1 ? "medium" : "low";

  const trustScore = scoreTrust(data, context, spamMatches);
  const remoteBonus = scoreRemote(data, haystack);
  const clarityScore = scoreClarity(data);

  const totalScore = clamp(
    freshnessScore + fresherFitScore + techRelevanceScore + trustScore + remoteBonus + clarityScore,
    0,
    100,
  );

  const experienceOk =
    (data.experienceMax == null || data.experienceMax <= 3) &&
    (data.experienceMin == null || data.experienceMin <= 3);

  const shouldPost =
    totalScore >= 70 && data.isHiringPost && data.isTechRole && spamRisk !== "high" && experienceOk;

  const reason = `freshness ${freshnessScore}/20, fresher fit ${fresherFitScore}/25, tech ${techRelevanceScore}/20, trust ${trustScore}/20, remote ${remoteBonus}/10, clarity ${clarityScore}/5, spam risk ${spamRisk}`;

  return {
    freshnessScore,
    fresherFitScore,
    techRelevanceScore,
    trustScore,
    remoteBonus,
    clarityScore,
    totalScore,
    spamRisk,
    shouldPost,
    reason,
  };
}
