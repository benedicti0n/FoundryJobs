import {
  SCHEDULED_JOB_DEFINITIONS,
  getEnv,
  type ScheduledJobDefinition,
  type ScheduledJobName,
  type ScheduledJobResult,
  type SchedulerRunSnapshot,
} from "@foundryjobs/shared";
import { runScheduledJob } from "./jobs";

export type SchedulerJobConfig = {
  definition: ScheduledJobDefinition;
  intervalMinutes: number;
  intervalMs: number;
  limit: number | null;
};

export type SchedulerConfig = {
  jobs: SchedulerJobConfig[];
  runOnStart: boolean;
};

export type SchedulerLogger = {
  log: (message: string) => void;
  error: (message: string) => void;
};

export type ScheduledJobRunner = (
  name: ScheduledJobName,
  options?: { limit?: number | null },
) => Promise<ScheduledJobResult>;

const MAX_LIMIT = 200;

export function isSchedulerEnabled(): boolean {
  return getEnv("SCHEDULER_ENABLED")?.toLowerCase() === "true";
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseLimit(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, MAX_LIMIT);
}

export function readSchedulerConfig(): SchedulerConfig {
  const jobs = SCHEDULED_JOB_DEFINITIONS.map((definition) => {
    const intervalMinutes = parsePositiveNumber(
      getEnv(definition.intervalEnvVar),
      definition.defaultIntervalMinutes,
    );
    const limit =
      definition.limitEnvVar !== null && definition.defaultLimit !== null
        ? parseLimit(getEnv(definition.limitEnvVar), definition.defaultLimit)
        : null;

    return {
      definition,
      intervalMinutes,
      intervalMs: Math.round(intervalMinutes * 60_000),
      limit,
    };
  });

  return {
    jobs,
    runOnStart: getEnv("SCHEDULER_RUN_ON_START")?.toLowerCase() === "true",
  };
}

export class WorkerScheduler {
  private readonly timers = new Map<ScheduledJobName, ReturnType<typeof setInterval>>();
  private readonly inFlight = new Set<Promise<void>>();
  private readonly running = new Set<ScheduledJobName>();
  private readonly lastResults = new Map<ScheduledJobName, ScheduledJobResult>();
  private readonly startedAt = new Date();
  private stopped = false;
  private finishedAt: Date | undefined;

  constructor(
    private readonly config: SchedulerConfig,
    private readonly logger: SchedulerLogger = console,
    private readonly runner: ScheduledJobRunner = runScheduledJob,
  ) {}

  logBoot(): void {
    this.logger.log("FoundryJobs scheduler booted");
    this.logger.log("Scheduler enabled: true");
    this.logger.log("Publishing is not scheduled; publish commands stay manual.");
    this.logger.log("Run exactly one scheduler instance per environment to avoid duplicate runs.");
    for (const job of this.config.jobs) {
      const limitPart = job.limit !== null ? `, limit ${job.limit}` : "";
      this.logger.log(`  - ${job.definition.name} every ${job.intervalMinutes}m${limitPart}`);
    }
    this.logger.log(`Scheduler run on start: ${this.config.runOnStart}`);
  }

  start(): void {
    for (const job of this.config.jobs) {
      const timer = setInterval(() => {
        void this.runJob(job);
      }, job.intervalMs);
      this.timers.set(job.definition.name, timer);
    }

    if (this.config.runOnStart) {
      void this.runStartupSequence();
    }
  }

  private async runStartupSequence(): Promise<void> {
    for (const job of this.config.jobs) {
      await this.runJob(job);
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.finishedAt = new Date();
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
    await Promise.allSettled([...this.inFlight]);
  }

  getSnapshot(): SchedulerRunSnapshot {
    return {
      startedAt: this.startedAt.toISOString(),
      ...(this.finishedAt ? { finishedAt: this.finishedAt.toISOString() } : {}),
      isRunning: !this.stopped,
      lastResults: this.config.jobs
        .map((job) => this.lastResults.get(job.definition.name))
        .filter((result): result is ScheduledJobResult => Boolean(result)),
    };
  }

  private runJob(job: SchedulerJobConfig): Promise<void> {
    if (this.stopped) {
      return Promise.resolve();
    }
    if (this.running.has(job.definition.name)) {
      this.logger.log(
        `[scheduler] ${job.definition.name} is still running; skipping overlapping tick`,
      );
      return Promise.resolve();
    }

    this.running.add(job.definition.name);
    const task = (async () => {
      this.logger.log(`[scheduler] ${job.definition.name} started`);
      try {
        const result = await this.runner(job.definition.name, { limit: job.limit });
        this.lastResults.set(job.definition.name, result);
        const detail = result.errorMessage ? ` — ${result.errorMessage}` : ` — ${result.message}`;
        const line = `[scheduler] ${result.name} ${result.status} in ${result.durationMs}ms${detail}`;
        if (result.status === "failed") {
          this.logger.error(line);
        } else {
          this.logger.log(line);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`[scheduler] ${job.definition.name} failed — ${message}`);
      } finally {
        this.running.delete(job.definition.name);
      }
    })();

    this.inFlight.add(task);
    void task.finally(() => {
      this.inFlight.delete(task);
    });
    return task;
  }
}
