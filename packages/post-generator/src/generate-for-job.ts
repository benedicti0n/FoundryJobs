import {
  createGeneratedPostsForJob,
  deleteGeneratedPostsForJob,
  getCompanyBrandingByName,
  getJobPostWithLatestScore,
  listGeneratedPosts,
} from "@foundryjobs/db";
import {
  activeGeneratedPlatforms,
  isXpublishingEnabled,
  isPublicHttpUrl,
  type GeneratedPostPlatform,
  type GeneratePostsForJobResult,
} from "@foundryjobs/shared";
import { buildPlatformDrafts } from "./templates";

export type GeneratePostsForJobOptions = {
  regenerate?: boolean;
  platforms?: GeneratedPostPlatform[];
};

const ACTIVE_GENERATION_STATUSES = new Set(["draft", "approved", "published"]);

export async function resolveCompanyLogoUrl(companyName: string | null): Promise<string | null> {
  if (!companyName) {
    return null;
  }
  try {
    const branding = await getCompanyBrandingByName(companyName);
    const logoUrl = branding?.logoUrl?.trim();
    if (logoUrl && isPublicHttpUrl(logoUrl)) {
      return logoUrl;
    }
  } catch {
    // logo resolution is best-effort; generation must not fail because of it
  }
  return null;
}

export async function generatePostsForJob(
  jobPostId: string,
  options: GeneratePostsForJobOptions = {},
): Promise<GeneratePostsForJobResult> {
  try {
    const job = await getJobPostWithLatestScore(jobPostId);
    if (!job) {
      return {
        jobPostId,
        status: "error",
        generatedCount: 0,
        errorMessage: "Job post not found",
      };
    }

    if (!job.latestScore) {
      return {
        jobPostId,
        status: "skipped",
        generatedCount: 0,
        skippedReason: "Job post has no score yet",
      };
    }
    if (!job.latestScore.shouldPost) {
      return {
        jobPostId,
        status: "skipped",
        generatedCount: 0,
        skippedReason: `Job post is not flagged for posting (totalScore ${job.latestScore.totalScore})`,
      };
    }
    if (job.status !== "scored") {
      return {
        jobPostId,
        status: "skipped",
        generatedCount: 0,
        skippedReason: `Job post status is ${job.status}`,
      };
    }

    const requestedPlatforms = options.platforms ?? activeGeneratedPlatforms();
    if (requestedPlatforms.length === 0) {
      return {
        jobPostId,
        status: "skipped",
        generatedCount: 0,
        skippedReason: "No platforms requested",
      };
    }

    const existing = await listGeneratedPosts({ jobPostId, limit: 200 });
    if (existing.length > 0 && options.regenerate) {
      await deleteGeneratedPostsForJob(jobPostId);
    }

    const activePlatforms = new Set(
      existing
        .filter((post) => ACTIVE_GENERATION_STATUSES.has(post.status))
        .map((post) => post.platform),
    );
    const platformsToGenerate = options.regenerate
      ? requestedPlatforms
      : requestedPlatforms.filter((platform) => !activePlatforms.has(platform));

    if (platformsToGenerate.length === 0) {
      return {
        jobPostId,
        status: "skipped",
        generatedCount: 0,
        skippedReason: "Generated posts already exist for the requested platforms",
      };
    }

    const telegramLogoUrl = platformsToGenerate.includes("telegram")
      ? await resolveCompanyLogoUrl(job.companyName)
      : null;
    const drafts = buildPlatformDrafts(job, platformsToGenerate, { telegramLogoUrl });
    const created = await createGeneratedPostsForJob(jobPostId, drafts);

    return { jobPostId, status: "generated", generatedCount: created.length };
  } catch (error) {
    return {
      jobPostId,
      status: "error",
      generatedCount: 0,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

export type SelectionGenerationInput = {
  telegramJobIds: string[];
  mediaJobIds: string[];
};

export async function generatePostsForSelection(
  input: SelectionGenerationInput,
  options: { regenerate?: boolean } = {},
): Promise<GeneratePostsForJobResult[]> {
  const platformsByJob = new Map<string, Set<GeneratedPostPlatform>>();
  const add = (jobPostId: string, platform: GeneratedPostPlatform) => {
    const set = platformsByJob.get(jobPostId) ?? new Set<GeneratedPostPlatform>();
    set.add(platform);
    platformsByJob.set(jobPostId, set);
  };

  for (const jobPostId of input.telegramJobIds) {
    add(jobPostId, "telegram");
  }
  for (const jobPostId of input.mediaJobIds) {
    add(jobPostId, "instagram");
    if (isXpublishingEnabled()) {
      add(jobPostId, "x");
    }
  }

  const results: GeneratePostsForJobResult[] = [];
  for (const [jobPostId, platforms] of platformsByJob) {
    results.push(
      await generatePostsForJob(jobPostId, {
        platforms: [...platforms],
        regenerate: options.regenerate,
      }),
    );
  }
  return results;
}
