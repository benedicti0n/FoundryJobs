import { withSelectionConfig, type SelectionConfig } from "./config";
import { evaluateEligibility } from "./eligibility";
import { rankCandidate } from "./ranking";
import type {
  CandidateJob,
  MediaSelection,
  RankedCandidate,
  SelectionResult,
  TelegramSelection,
} from "./types";

const ATS_PLATFORMS = new Set([
  "greenhouse",
  "lever",
  "ashby",
  "workday",
  "smartrecruiters",
  "workable",
]);

function compareRanked(a: RankedCandidate, b: RankedCandidate): number {
  if (b.qualityScore !== a.qualityScore) {
    return b.qualityScore - a.qualityScore;
  }
  if (b.mediaScore !== a.mediaScore) {
    return b.mediaScore - a.mediaScore;
  }
  return a.job.jobPostId.localeCompare(b.job.jobPostId);
}

export function normalizeApplyUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.hostname.toLowerCase()}${path}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function normalizeCompanyKey(name: string | null, fallback: string | null): string {
  const raw = (name ?? fallback ?? "unknown").toLowerCase();
  return raw.replace(/[^a-z0-9]+/g, "");
}

function dedupeKey(candidate: RankedCandidate): string {
  const urlKey = normalizeApplyUrl(candidate.job.applyUrl);
  if (urlKey) {
    return `url:${urlKey}`;
  }
  return `ct:${normalizeCompanyKey(candidate.job.companyName, candidate.job.sourceName)}:${candidate.job.roleTitle.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

function prefersDirectSource(a: RankedCandidate, b: RankedCandidate): number {
  const aDirect = a.job.sourcePlatform && ATS_PLATFORMS.has(a.job.sourcePlatform) ? 1 : 0;
  const bDirect = b.job.sourcePlatform && ATS_PLATFORMS.has(b.job.sourcePlatform) ? 1 : 0;
  return aDirect - bDirect;
}

export function dedupeCandidates(candidates: RankedCandidate[]): RankedCandidate[] {
  const byKey = new Map<string, RankedCandidate>();
  for (const candidate of candidates) {
    const key = dedupeKey(candidate);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, candidate);
      continue;
    }
    const directPreference = prefersDirectSource(candidate, existing);
    if (
      directPreference > 0 ||
      (directPreference === 0 && compareRanked(candidate, existing) < 0)
    ) {
      byKey.set(key, candidate);
    }
  }
  return [...byKey.values()].sort(compareRanked);
}

export function capCandidates(
  candidates: RankedCandidate[],
  config: SelectionConfig,
): RankedCandidate[] {
  const perCompany = new Map<string, number>();
  const perSource = new Map<string, number>();
  const kept: RankedCandidate[] = [];

  for (const candidate of candidates) {
    const companyKey = normalizeCompanyKey(candidate.job.companyName, candidate.job.sourceName);
    const sourceKey = candidate.job.sourceId ?? "unknown";
    const companyCount = perCompany.get(companyKey) ?? 0;
    const sourceCount = perSource.get(sourceKey) ?? 0;
    if (
      companyCount >= config.maxCandidatesPerCompany ||
      sourceCount >= config.maxCandidatesPerSource
    ) {
      continue;
    }
    perCompany.set(companyKey, companyCount + 1);
    perSource.set(sourceKey, sourceCount + 1);
    kept.push(candidate);
  }

  return kept;
}

export function buildCandidatePool(
  jobs: CandidateJob[],
  config: SelectionConfig,
  now: Date = new Date(),
): RankedCandidate[] {
  const ranked = jobs
    .filter((job) => !job.recentlyPublished)
    .map((job) => rankCandidate(job, evaluateEligibility(job), now));
  return capCandidates(dedupeCandidates(ranked), config);
}

function categoryLabel(job: CandidateJob): string {
  return job.sourceCategory ?? "general";
}

export function selectTelegram(
  pool: RankedCandidate[],
  config: SelectionConfig,
): TelegramSelection[] {
  const eligible = pool.filter((candidate) => candidate.eligibility.status !== "reject");
  const remaining = [...eligible];
  const perCompany = new Map<string, number>();
  const selections: TelegramSelection[] = [];

  const take = (candidate: RankedCandidate, reason: string) => {
    const companyKey = normalizeCompanyKey(candidate.job.companyName, candidate.job.sourceName);
    perCompany.set(companyKey, (perCompany.get(companyKey) ?? 0) + 1);
    remaining.splice(remaining.indexOf(candidate), 1);
    selections.push({
      rank: selections.length + 1,
      jobPostId: candidate.job.jobPostId,
      company: candidate.job.companyName,
      role: candidate.job.roleTitle,
      category: categoryLabel(candidate.job),
      score: candidate.qualityScore,
      selectionReason:
        candidate.eligibility.status === "borderline" ? `${reason} (borderline)` : reason,
    });
  };

  const canTake = (candidate: RankedCandidate): boolean => {
    const companyKey = normalizeCompanyKey(candidate.job.companyName, candidate.job.sourceName);
    return (perCompany.get(companyKey) ?? 0) < config.maxTelegramPerCompany;
  };

  for (const slot of config.telegramSlotTargets) {
    let filled = 0;
    for (const candidate of [...remaining]) {
      if (filled >= slot.count || selections.length >= config.telegramMaxPosts) {
        break;
      }
      if (!slot.categories.includes(categoryLabel(candidate.job))) {
        continue;
      }
      if (!canTake(candidate)) {
        continue;
      }
      take(candidate, `slot:${slot.label}`);
      filled += 1;
    }
  }

  for (let index = 0; index < config.wildcardSlots; index += 1) {
    if (selections.length >= config.telegramMaxPosts) {
      break;
    }
    const wildcard = remaining.find(canTake);
    if (!wildcard) {
      break;
    }
    take(wildcard, "wildcard:top_remaining");
  }

  while (selections.length < config.telegramMaxPosts) {
    const backfill = remaining.find(canTake);
    if (!backfill) {
      break;
    }
    take(backfill, "backfill:highest_remaining");
  }

  return selections;
}

export function selectMedia(pool: RankedCandidate[], config: SelectionConfig): MediaSelection[] {
  const candidates = pool
    .filter((candidate) => candidate.eligibility.status !== "reject" && candidate.mediaScore > 0)
    .sort((a, b) => {
      if (b.mediaScore !== a.mediaScore) {
        return b.mediaScore - a.mediaScore;
      }
      return compareRanked(a, b);
    });

  const perCompany = new Map<string, number>();
  const selections: MediaSelection[] = [];

  for (const candidate of candidates) {
    if (selections.length >= config.mediaMaxPosts) {
      break;
    }
    const companyKey = normalizeCompanyKey(candidate.job.companyName, candidate.job.sourceName);
    if ((perCompany.get(companyKey) ?? 0) >= config.maxMediaPerCompany) {
      continue;
    }
    perCompany.set(companyKey, (perCompany.get(companyKey) ?? 0) + 1);
    selections.push({
      rank: selections.length + 1,
      jobPostId: candidate.job.jobPostId,
      company: candidate.job.companyName,
      role: candidate.job.roleTitle,
      category: categoryLabel(candidate.job),
      score: candidate.qualityScore,
      mediaScore: candidate.mediaScore,
      selectionReason: `media score ${candidate.mediaScore}, category ${categoryLabel(candidate.job)}`,
    });
  }

  return selections;
}

export function runSelection(
  jobs: CandidateJob[],
  overrides: Partial<SelectionConfig> = {},
  now: Date = new Date(),
): SelectionResult {
  const config = withSelectionConfig(overrides);
  const pool = buildCandidatePool(jobs, config, now);
  const telegram = selectTelegram(pool, config);
  const media = selectMedia(pool, config);
  const selectedIds = new Set([
    ...telegram.map((item) => item.jobPostId),
    ...media.map((item) => item.jobPostId),
  ]);

  const rejected = jobs
    .filter((job) => !job.recentlyPublished)
    .map((job) => ({ job, evaluation: evaluateEligibility(job) }))
    .filter((entry) => entry.evaluation.status === "reject")
    .map((entry) => ({
      jobPostId: entry.job.jobPostId,
      company: entry.job.companyName,
      role: entry.job.roleTitle,
      reasons: entry.evaluation.reasons
        .filter((reason) => reason.impact === "negative")
        .map((reason) => reason.code),
    }));

  const eligibleNotSelected = pool
    .filter((candidate) => !selectedIds.has(candidate.job.jobPostId))
    .slice(0, 10)
    .map((candidate) => ({
      jobPostId: candidate.job.jobPostId,
      company: candidate.job.companyName,
      role: candidate.job.roleTitle,
      score: candidate.qualityScore,
    }));

  return { telegram, media, nearMisses: { rejected, eligibleNotSelected } };
}
