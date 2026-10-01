export type ScheduledJobName =
  | "fetch_due_sources"
  | "normalize_raw_posts"
  | "generate_posts"
  | "render_instagram_cards"
  | "upload_instagram_cards";

export type ScheduledJobStatus = "success" | "skipped" | "failed";

export type ScheduledJobResult = {
  name: ScheduledJobName;
  status: ScheduledJobStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  message: string;
  errorMessage?: string;
};

export type SchedulerRunSnapshot = {
  startedAt: string;
  finishedAt?: string;
  isRunning: boolean;
  lastResults: ScheduledJobResult[];
};

export type ScheduledJobDefinition = {
  name: ScheduledJobName;
  label: string;
  intervalEnvVar: string;
  defaultIntervalMinutes: number;
  limitEnvVar: string | null;
  defaultLimit: number | null;
};

export const SCHEDULED_JOB_DEFINITIONS: readonly ScheduledJobDefinition[] = [
  {
    name: "fetch_due_sources",
    label: "Fetch due sources",
    intervalEnvVar: "SCHEDULER_FETCH_INTERVAL_MINUTES",
    defaultIntervalMinutes: 30,
    limitEnvVar: null,
    defaultLimit: null,
  },
  {
    name: "normalize_raw_posts",
    label: "Normalize raw posts",
    intervalEnvVar: "SCHEDULER_NORMALIZE_INTERVAL_MINUTES",
    defaultIntervalMinutes: 15,
    limitEnvVar: "SCHEDULER_NORMALIZE_LIMIT",
    defaultLimit: 25,
  },
  {
    name: "generate_posts",
    label: "Generate posts",
    intervalEnvVar: "SCHEDULER_GENERATE_POSTS_INTERVAL_MINUTES",
    defaultIntervalMinutes: 15,
    limitEnvVar: "SCHEDULER_GENERATE_POSTS_LIMIT",
    defaultLimit: 25,
  },
  {
    name: "render_instagram_cards",
    label: "Render Instagram cards",
    intervalEnvVar: "SCHEDULER_RENDER_IG_CARDS_INTERVAL_MINUTES",
    defaultIntervalMinutes: 30,
    limitEnvVar: "SCHEDULER_RENDER_IG_CARDS_LIMIT",
    defaultLimit: 10,
  },
  {
    name: "upload_instagram_cards",
    label: "Upload Instagram cards",
    intervalEnvVar: "SCHEDULER_UPLOAD_IG_CARDS_INTERVAL_MINUTES",
    defaultIntervalMinutes: 30,
    limitEnvVar: "SCHEDULER_UPLOAD_IG_CARDS_LIMIT",
    defaultLimit: 10,
  },
];
