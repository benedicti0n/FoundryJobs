export type RelevanceBucket = "likely_relevant" | "uncertain" | "likely_irrelevant";

export type RelevanceClassification = {
  bucket: RelevanceBucket;
  signals: string[];
};

const POSITIVE_RE =
  /\b(intern|internship|graduate|new grad|fresher|trainee|apprentice|junior|associate|entry[- ]level|early career|campus|university|student|engineer i\b|analyst|support engineer|qa|quality|test engineer|developer|product engineer|data analyst|data scientist|technology|technical operations)\b/i;

const STRONG_NEGATIVE_RE =
  /\b(senior|staff|principal|director|vice president|vp|head of|distinguished|fellow)\b/i;

const SENIOR_MANAGEMENT_RE =
  /\b(engineering|product|program|project|sales|marketing|finance|operations)\s+manager\b/i;

const SENIOR_MANAGER_RE =
  /\b(senior|principal|head of|director|vp)\b.*\b(manager|lead|architect)\b/i;

export function classifyRelevance(input: {
  title?: string | null;
  text?: string | null;
}): RelevanceClassification {
  const title = (input.title ?? "").toLowerCase();
  const signals: string[] = [];

  const hasPositive = POSITIVE_RE.test(title);
  if (hasPositive) {
    signals.push("positive_role_signal");
  }

  if (/member of technical staff/i.test(title) && !/senior|principal/i.test(title)) {
    signals.push("ambiguous_staff_title");
    return { bucket: "uncertain", signals };
  }

  const seniorManagement =
    (SENIOR_MANAGEMENT_RE.test(title) && !/\bassociate\s+(product\s+)?manager\b/i.test(title)) ||
    SENIOR_MANAGER_RE.test(title);
  const strongNegative = STRONG_NEGATIVE_RE.test(title);

  if (seniorManagement) {
    signals.push("senior_management");
    return { bucket: "likely_irrelevant", signals };
  }

  if (strongNegative && !hasPositive) {
    signals.push("senior_title");
    return { bucket: "likely_irrelevant", signals };
  }

  if (strongNegative && hasPositive) {
    signals.push("mixed_seniority");
    return { bucket: "uncertain", signals };
  }

  if (hasPositive) {
    return { bucket: "likely_relevant", signals };
  }

  return { bucket: "uncertain", signals };
}

export function prioritizeByRelevance<
  T extends { rawTitle?: string | null; rawText?: string | null },
>(posts: T[]): T[] {
  const order: Record<RelevanceBucket, number> = {
    likely_relevant: 0,
    uncertain: 1,
    likely_irrelevant: 2,
  };
  return posts
    .map((post, index) => ({
      post,
      index,
      bucket: classifyRelevance({ title: post.rawTitle, text: post.rawText }).bucket,
    }))
    .sort((a, b) => order[a.bucket] - order[b.bucket] || a.index - b.index)
    .map((entry) => entry.post);
}
