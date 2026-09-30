import { isEnvSet, isUuid } from "@foundryjobs/shared";
import { getDatabase, type Database } from "../client";
import { DatabaseNotConfiguredError } from "../errors";
import { promptRuns } from "../schema";

const NORMALIZATION_DATABASE_ERROR =
  "DATABASE_URL is required for normalization repository operations";

export type PromptRunInput = {
  jobPostId?: string | null;
  task: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number | null;
};

function requireDatabase(): Database {
  if (!isEnvSet("DATABASE_URL")) {
    throw new DatabaseNotConfiguredError(NORMALIZATION_DATABASE_ERROR);
  }
  return getDatabase();
}

export async function recordPromptRun(input: PromptRunInput): Promise<boolean> {
  const database = requireDatabase();

  const [row] = await database
    .insert(promptRuns)
    .values({
      jobPostId: input.jobPostId && isUuid(input.jobPostId) ? input.jobPostId : null,
      task: input.task,
      provider: input.provider,
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      costUsd: String(input.costUsd),
      latencyMs: input.latencyMs,
    })
    .returning({ id: promptRuns.id });

  return Boolean(row);
}
