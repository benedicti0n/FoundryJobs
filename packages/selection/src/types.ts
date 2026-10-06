import type {
  SourceCategory,
  SourcePlatform,
  SourcePriority,
  SourceRegion,
} from "@foundryjobs/shared";

export type CandidateJob = {
  jobPostId: string;
  companyName: string | null;
  roleTitle: string;
  roleCategory: string | null;
  location: string | null;
  workMode: string;
  employmentType: string;
  experienceMin: number | null;
  experienceMax: number | null;
  qualification: string | null;
  batchYears: string[];
  skills: string[];
  salaryText: string | null;
  applyUrl: string | null;
  postedAt: string | null;
  createdAt: string;
  sourceId: string | null;
  sourceName: string | null;
  sourcePlatform: SourcePlatform | null;
  sourceCategory: SourceCategory | null;
  sourceRegion: SourceRegion | null;
  sourcePriority: SourcePriority | null;
  sourceTrustLevel: number | null;
  legacyScore: {
    totalScore: number;
    techRelevanceScore: number;
    freshnessScore: number;
    spamRisk: string;
    shouldPost: boolean;
  } | null;
  recentlyPublished: boolean;
};

export type EligibilityReasonCode =
  | "internship"
  | "fresher_signal"
  | "graduate_program"
  | "trainee_or_apprentice"
  | "junior_or_associate"
  | "within_yoe_range"
  | "grad_year_match"
  | "grad_year_other"
  | "experience_unknown"
  | "experience_min_4"
  | "experience_min_5plus"
  | "senior_title"
  | "not_tech_role"
  | "mass_hiring_campaign";

export type EligibilityReason = {
  code: EligibilityReasonCode;
  detail: string;
  impact: "positive" | "negative" | "neutral";
};

export type EligibilityStatus = "eligible" | "borderline" | "reject";

export type ExperienceLevel =
  "internship" | "fresher" | "entry" | "early_career" | "mid" | "senior" | "unknown";

export type NormalizedExperience = {
  minYears: number | null;
  maxYears: number | null;
  level: ExperienceLevel;
};

export type RankedCandidate = {
  job: CandidateJob;
  eligibility: {
    status: EligibilityStatus;
    reasons: EligibilityReason[];
  };
  experience: NormalizedExperience;
  qualityScore: number;
  mediaScore: number;
  scoreBreakdown: Array<{ dimension: string; points: number; max: number; detail: string }>;
};

export type TelegramSelection = {
  rank: number;
  jobPostId: string;
  company: string | null;
  role: string;
  category: string;
  score: number;
  selectionReason: string;
};

export type MediaSelection = {
  rank: number;
  jobPostId: string;
  company: string | null;
  role: string;
  category: string;
  score: number;
  mediaScore: number;
  selectionReason: string;
};

export type SelectionResult = {
  telegram: TelegramSelection[];
  media: MediaSelection[];
  nearMisses: {
    rejected: Array<{ jobPostId: string; company: string | null; role: string; reasons: string[] }>;
    eligibleNotSelected: Array<{
      jobPostId: string;
      company: string | null;
      role: string;
      score: number;
    }>;
  };
};
