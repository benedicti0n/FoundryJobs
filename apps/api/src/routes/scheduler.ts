import type { FastifyInstance } from "fastify";
import { SCHEDULED_JOB_DEFINITIONS } from "@foundryjobs/shared";

export async function registerSchedulerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/scheduler/status", async () => ({
    data: {
      note: "The scheduler runs inside the worker process. This endpoint reports the configured jobs and defaults only.",
      command: "pnpm --filter @foundryjobs/worker scheduler",
      enabledEnvVar: "SCHEDULER_ENABLED",
      runOnStartEnvVar: "SCHEDULER_RUN_ON_START",
      jobs: SCHEDULED_JOB_DEFINITIONS.map((definition) => ({
        name: definition.name,
        label: definition.label,
        intervalEnvVar: definition.intervalEnvVar,
        defaultIntervalMinutes: definition.defaultIntervalMinutes,
        limitEnvVar: definition.limitEnvVar,
        defaultLimit: definition.defaultLimit,
      })),
    },
  }));
}
