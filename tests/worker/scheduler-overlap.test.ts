import assert from "node:assert/strict";
import test from "node:test";
import { SCHEDULED_JOB_DEFINITIONS, type ScheduledJobResult } from "@foundryjobs/shared";
import {
  WorkerScheduler,
  type ScheduledJobRunner,
  type SchedulerConfig,
} from "../../apps/worker/src/scheduler";
import { delay, waitFor } from "../helpers/async";

function definitionFor(name: (typeof SCHEDULED_JOB_DEFINITIONS)[number]["name"]) {
  const definition = SCHEDULED_JOB_DEFINITIONS.find((item) => item.name === name);
  if (!definition) {
    throw new Error(`Missing scheduled job definition for ${name}`);
  }
  return definition;
}

function singleJobConfig(
  name: (typeof SCHEDULED_JOB_DEFINITIONS)[number]["name"],
  intervalMs: number,
): SchedulerConfig {
  return {
    runOnStart: false,
    jobs: [
      {
        definition: definitionFor(name),
        intervalMinutes: intervalMs / 60_000,
        intervalMs,
        limit: null,
      },
    ],
  };
}

function successResult(name: ScheduledJobResult["name"]): ScheduledJobResult {
  const now = new Date().toISOString();
  return { name, status: "success", startedAt: now, finishedAt: now, durationMs: 1, message: "ok" };
}

test("a tick for a job that is already running is skipped, not executed concurrently", async (t) => {
  const logs: string[] = [];
  let calls = 0;
  let resolveRun: (() => void) | undefined;

  const runner: ScheduledJobRunner = (name) => {
    calls += 1;
    return new Promise<ScheduledJobResult>((resolve) => {
      resolveRun = () => resolve(successResult(name));
    });
  };

  const scheduler = new WorkerScheduler(
    singleJobConfig("fetch_due_sources", 20),
    { log: (line) => logs.push(line), error: (line) => logs.push(line) },
    runner,
  );
  t.after(async () => {
    await scheduler.stop();
  });

  scheduler.start();
  await waitFor(() => calls === 1, { label: "first overlapping tick" });
  await delay(80);

  const stopPromise = scheduler.stop();
  resolveRun?.();
  await stopPromise;

  assert.equal(calls, 1, "overlapping ticks must not invoke the runner again");
  assert.ok(
    logs.some((line) => line.includes("still running; skipping overlapping tick")),
    "skipped ticks must be logged",
  );
  assert.equal(scheduler.getSnapshot().isRunning, false);
});

test("interval scheduling stays independent per job and stops with the scheduler", async (t) => {
  const callsByJob = new Map<string, number>();
  const runner: ScheduledJobRunner = async (name) => {
    callsByJob.set(name, (callsByJob.get(name) ?? 0) + 1);
    return successResult(name);
  };

  const config: SchedulerConfig = {
    runOnStart: false,
    jobs: [
      {
        definition: definitionFor("fetch_due_sources"),
        intervalMinutes: 20 / 60_000,
        intervalMs: 20,
        limit: null,
      },
      {
        definition: definitionFor("normalize_raw_posts"),
        intervalMinutes: 600 / 60_000,
        intervalMs: 600,
        limit: null,
      },
    ],
  };

  const scheduler = new WorkerScheduler(
    config,
    { log: () => undefined, error: () => undefined },
    runner,
  );
  t.after(async () => {
    await scheduler.stop();
  });

  scheduler.start();
  await waitFor(() => (callsByJob.get("fetch_due_sources") ?? 0) >= 3, {
    label: "recurring fetch ticks",
  });
  const fetchCallsBeforeStop = callsByJob.get("fetch_due_sources") ?? 0;

  await scheduler.stop();
  await delay(60);
  assert.equal(
    callsByJob.get("fetch_due_sources"),
    fetchCallsBeforeStop,
    "timers must be cleared on stop",
  );
  assert.equal(callsByJob.get("normalize_raw_posts") ?? 0, 0);
});
