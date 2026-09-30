import { isEnvSet } from "@foundryjobs/shared";

export type DatabaseStatus = {
  configured: boolean;
};

export function getDatabaseStatus(): DatabaseStatus {
  return { configured: isEnvSet("DATABASE_URL") };
}
