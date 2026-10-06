import { experienceFitPoints, gradFresherSignalPoints } from "./experience";
import type { EligibilityEvaluation } from "./eligibility";
import type { CandidateJob, RankedCandidate } from "./types";

export function freshnessPoints(postedAt: string | null, now: Date): number {
  if (!postedAt) {
    return 5;
  }
  const date = new Date(postedAt);
  if (Number.isNaN(date.getTime())) {
    return 5;
  }
  const hours = (now.getTime() - date.getTime()) / 3_600_000;
  if (hours <= 24) {
    return 10;
  }
  if (hours <= 72) {
    return 8;
  }
  if (hours <= 168) {
    return 6;
  }
  if (hours <= 336) {
    return 3;
  }
  return 1;
}

function indiaRemotePoints(job: CandidateJob): number {
  const location = (job.location ?? "").toLowerCase();
  const india =
    job.sourceRegion === "india" ||
    /india|bengaluru|bangalore|hyderabad|pune|mumbai|chennai|gurgaon|noida|delhi/.test(location);
  if (india) {
    return 10;
  }
  if (job.workMode === "remote" || job.sourceRegion === "remote") {
    return 8;
  }
  if (job.sourceRegion === "mixed") {
    return 6;
  }
  if (job.sourceRegion === "global") {
    return 4;
  }
  return 3;
}

function sourceQualityPoints(job: CandidateJob): number {
  const trust = job.sourceTrustLevel ?? 50;
  let points = Math.round((trust / 100) * 6);
  if (job.sourcePriority === "high") {
    points += 2;
  } else if (job.sourcePriority === "normal") {
    points += 1;
  }
  switch (job.sourceCategory) {
    case "big_tech":
    case "yc":
      points += 2;
      break;
    case "mass_hiring":
    case "startup":
    case "remote":
      points += 1;
      break;
    default:
      break;
  }
  return Math.min(10, points);
}

function completenessPoints(job: CandidateJob): number {
  let points = 0;
  if (job.applyUrl) {
    points += 2;
  }
  if (job.salaryText) {
    points += 1;
  }
  if (job.skills.length >= 3) {
    points += 1;
  }
  if (job.batchYears.length > 0) {
    points += 1;
  }
  return Math.min(5, points);
}

function massHiringScalePoints(job: CandidateJob, evaluation: EligibilityEvaluation): number {
  if (evaluation.status === "reject") {
    return 0;
  }
  const campaign = /trainee|apprentice|graduate engineer|fresher|hiring drive|walk[- ]?in/.test(
    `${job.roleTitle} ${job.qualification ?? ""}`.toLowerCase(),
  );
  if (job.sourceCategory === "mass_hiring" && campaign) {
    return 5;
  }
  if (job.sourceCategory === "mass_hiring" && (evaluation.experience.minYears ?? 0) <= 1) {
    return 4;
  }
  if (job.sourceCategory === "mass_hiring") {
    return 3;
  }
  if (campaign) {
    return 3;
  }
  return 0;
}

const NON_ENGLISH_TITLE_RE =
  /\b(praktikum|praktikant|werkstudent|ausbildung|berufspraktikum|stage|alternance|stagiaire|hospitation|m\/w\/d)\b/i;

function isNonEnglishTitle(title: string): boolean {
  return NON_ENGLISH_TITLE_RE.test(title);
}

export function mediaWorthiness(job: CandidateJob, evaluation: EligibilityEvaluation): number {
  if (evaluation.status === "reject" || !job.applyUrl) {
    return 0;
  }

  let score = 0;
  score += evaluation.status === "eligible" ? 25 : 12;

  const title = job.roleTitle.trim();
  const vagueTitle = title.length < 6 || /^(job|opening|hiring|opportunity)$/i.test(title);
  score += vagueTitle ? 0 : 15;

  switch (job.sourceCategory) {
    case "big_tech":
      score += 20;
      break;
    case "yc":
      score += 16;
      break;
    case "mass_hiring":
      score += 12;
      break;
    case "startup":
      score += 12;
      break;
    case "remote":
      score += 10;
      break;
    default:
      score += 6;
      break;
  }
  if (job.sourcePriority === "high") {
    score += 2;
  }
  score = Math.min(47, score);

  score += Math.round((gradFresherSignalPoints(job, evaluation.experience.level) / 10) * 15);
  score += freshnessPoints(job.postedAt, new Date());

  let visualData = 0;
  if (job.applyUrl) {
    visualData += 4;
  }
  if (job.skills.length >= 3) {
    visualData += 2;
  }
  if (job.salaryText) {
    visualData += 2;
  }
  if (job.batchYears.length > 0) {
    visualData += 2;
  }
  score += Math.min(10, visualData);

  const locationPoints = indiaRemotePoints(job);
  score += locationPoints >= 8 ? 5 : locationPoints >= 6 ? 3 : 1;

  if (isNonEnglishTitle(job.roleTitle)) {
    score = Math.max(0, score - 15);
  }

  return Math.max(0, Math.min(100, score));
}

export function rankCandidate(
  job: CandidateJob,
  evaluation: EligibilityEvaluation,
  now: Date = new Date(),
): RankedCandidate {
  const breakdown: RankedCandidate["scoreBreakdown"] = [];
  const add = (dimension: string, points: number, max: number, detail: string) => {
    breakdown.push({ dimension, points: Math.max(0, Math.min(max, points)), max, detail });
  };

  const audienceBase =
    evaluation.status === "eligible" ? 22 : evaluation.status === "borderline" ? 12 : 0;
  const experienceFit = experienceFitPoints(evaluation.experience.level);
  add("audience_fit", audienceBase, 22, `eligibility ${evaluation.status}`);
  add("experience_fit", experienceFit, 8, `level ${evaluation.experience.level}`);

  const techRelevance = job.legacyScore?.techRelevanceScore ?? 0;
  add(
    "role_relevance",
    Math.round((techRelevance / 20) * 15),
    15,
    `legacy tech relevance ${techRelevance}/20`,
  );

  const gradPoints = gradFresherSignalPoints(job, evaluation.experience.level);
  add("grad_fresher_signals", gradPoints, 10, "fresher/new-grad signals");

  const locationPoints = indiaRemotePoints(job);
  add("india_remote_relevance", locationPoints, 10, `region ${job.sourceRegion ?? "unknown"}`);

  const freshPoints = freshnessPoints(job.postedAt, now);
  add(
    "freshness",
    freshPoints,
    10,
    job.postedAt ? `posted ${job.postedAt}` : "posted date unknown",
  );

  const sourcePoints = sourceQualityPoints(job);
  add("source_quality", sourcePoints, 10, `category ${job.sourceCategory ?? "general"}`);

  const completePoints = completenessPoints(job);
  add("completeness", completePoints, 5, "data completeness");

  const massPoints = massHiringScalePoints(job, evaluation);
  add("mass_hiring_scale", massPoints, 5, "mass-hiring campaign signal");

  const media = mediaWorthiness(job, evaluation);
  add("media_worthiness", Math.round((media / 100) * 5), 5, `media score ${media}`);

  const languagePenalty = isNonEnglishTitle(job.roleTitle) ? 8 : 0;
  if (languagePenalty > 0) {
    breakdown.push({
      dimension: "language_penalty",
      points: -languagePenalty,
      max: 0,
      detail: "non-English posting title",
    });
  }

  const qualityScore = Math.max(
    0,
    Math.min(
      100,
      breakdown.reduce((total, entry) => total + entry.points, 0),
    ),
  );

  return {
    job,
    eligibility: { status: evaluation.status, reasons: evaluation.reasons },
    experience: evaluation.experience,
    qualityScore,
    mediaScore: media,
    scoreBreakdown: breakdown,
  };
}
