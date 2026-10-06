import assert from "node:assert/strict";
import test from "node:test";
import {
  SCHEDULED_JOB_DEFINITIONS,
  type ScheduledJobName,
  type ScheduledJobResult,
} from "@foundryjobs/shared";
import {
  WorkerScheduler,
  type ScheduledJobRunner,
  type SchedulerConfig,
} from "../../apps/worker/src/scheduler";
import { delay, waitFor } from "../helpers/async";

const PIPELINE_ORDER: ScheduledJobName[] = [
  "fetch_due_sources",
  "normalize_raw_posts",
  "generate_posts",
  "render_instagram_cards",
  "upload_instagram_cards",
];

function buildConfig(runOnStart: boolean): SchedulerConfig {
  return {
    runOnStart,
    jobs: SCHEDULED_JOB_DEFINITIONS.map((definition) => ({
      definition,
      intervalMinutes: 60,
      intervalMs: 3_600_000,
      limit: definition.defaultLimit ?? null,
    })),
  };
}

function successResult(name: ScheduledJobName): ScheduledJobResult {
  const now = new Date().toISOString();
  return {
    name,
    status: "success",
    startedAt: now,
    finishedAt: now,
    durationMs: 1,
    message: "ok",
  };
}

function failedResult(name: ScheduledJobName, errorMessage: string): ScheduledJobResult {
  const now = new Date().toISOString();
  return {
    name,
    status: "failed",
    startedAt: now,
    finishedAt: now,
    durationMs: 1,
    message: "job failed",
    errorMessage,
  };
}

function captureLogger(): {
  logs: string[];
  errors: string[];
  logger: { log: (m: string) => void; error: (m: string) => void };
} {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    logs,
    errors,
    logger: {
      log: (message: string) => logs.push(message),
      error: (message: string) => errors.push(message),
    },
  };
}

test("startup runs all jobs sequentially in production pipeline order", async (t) => {
  const { logs, logger } = captureLogger();
  const events: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;

  const runner: ScheduledJobRunner = async (name) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    events.push(`start:${name}`);
    await delay(5);
    events.push(`end:${name}`);
    inFlight -= 1;
    return successResult(name);
  };

  const scheduler = new WorkerScheduler(buildConfig(true), logger, runner);
  t.after(async () => {
    await scheduler.stop();
  });

  scheduler.start();
  await waitFor(() => scheduler.getSnapshot().lastResults.length === 5, {
    label: "startup jobs",
  });

  const starts = events.filter((event) => event.startsWith("start:"));
  assert.deepEqual(
    starts.map((event) => event.slice("start:".length)),
    PIPELINE_ORDER,
  );
  assert.equal(maxInFlight, 1, "jobs must never overlap during startup");

  for (let index = 0; index < PIPELINE_ORDER.length - 1; index += 1) {
    const endOfCurrent = events.indexOf(`end:${PIPELINE_ORDER[index]}`);
    const startOfNext = events.indexOf(`start:${PIPELINE_ORDER[index + 1]}`);
    assert.ok(
      endOfCurrent < startOfNext,
      `${PIPELINE_ORDER[index + 1]} must start after ${PIPELINE_ORDER[index]} resolves`,
    );
  }

  await scheduler.stop();
  assert.equal(scheduler.getSnapshot().isRunning, false);
  assert.ok(logs.some((line) => line.includes("fetch_due_sources success")));
});

test("startup continues after a failed job and surfaces the failure", async (t) => {
  const { logs, errors, logger } = captureLogger();
  const invoked: ScheduledJobName[] = [];

  const runner: ScheduledJobRunner = async (name) => {
    invoked.push(name);
    if (name === "normalize_raw_posts") {
      return failedResult(name, "boom");
    }
    return successResult(name);
  };

  const scheduler = new WorkerScheduler(buildConfig(true), logger, runner);
  t.after(async () => {
    await scheduler.stop();
  });

  scheduler.start();
  await waitFor(() => scheduler.getSnapshot().lastResults.length === 5, {
    label: "startup jobs",
  });

  assert.deepEqual(invoked, PIPELINE_ORDER);
  const snapshot = scheduler.getSnapshot();
  const failed = snapshot.lastResults.find((result) => result.name === "normalize_raw_posts");
  assert.equal(failed?.status, "failed");
  assert.equal(failed?.errorMessage, "boom");
  assert.ok(
    errors.some((line) => line.includes("normalize_raw_posts failed") && line.includes("boom")),
    "failed job must be logged through logger.error",
  );
  assert.ok(logs.some((line) => line.includes("upload_instagram_cards success")));
});

test("startup continues after a thrown error and surfaces it", async (t) => {
  const { logs, errors, logger } = captureLogger();
  const invoked: ScheduledJobName[] = [];

  const runner: ScheduledJobRunner = async (name) => {
    invoked.push(name);
    if (name === "fetch_due_sources") {
      throw new Error("network exploded");
    }
    return successResult(name);
  };

  const scheduler = new WorkerScheduler(buildConfig(true), logger, runner);
  t.after(async () => {
    await scheduler.stop();
  });

  scheduler.start();
  await waitFor(() => scheduler.getSnapshot().lastResults.length === 4, {
    label: "remaining startup jobs",
  });
  await scheduler.stop();

  assert.deepEqual(invoked, PIPELINE_ORDER);
  assert.ok(
    errors.some(
      (line) => line.includes("fetch_due_sources failed") && line.includes("network exploded"),
    ),
    "thrown errors must be logged",
  );
  assert.ok(logs.some((line) => line.includes("upload_instagram_cards success")));
});

test("scheduler registry never includes publishing jobs", () => {
  assert.deepEqual(
    SCHEDULED_JOB_DEFINITIONS.map((definition) => definition.name),
    PIPELINE_ORDER,
  );
  for (const definition of SCHEDULED_JOB_DEFINITIONS) {
    assert.doesNotMatch(definition.name, /publish/);
    assert.doesNotMatch(definition.label, /publish/i);
  }
});

test("runOnStart=false starts no startup jobs", async (t) => {
  const runnerCalls: ScheduledJobName[] = [];
  const runner: ScheduledJobRunner = async (name) => {
    runnerCalls.push(name);
    return successResult(name);
  };

  const scheduler = new WorkerScheduler(buildConfig(false), captureLogger().logger, runner);
  t.after(async () => {
    await scheduler.stop();
  });

  scheduler.start();
  await delay(30);
  await scheduler.stop();

  assert.equal(runnerCalls.length, 0);
  assert.equal(scheduler.getSnapshot().lastResults.length, 0);
});
