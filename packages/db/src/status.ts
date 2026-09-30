import { isEnvSet } from "@foundryjobs/shared";

export type DatabaseStatus = {
  configured: boolean;
  provider: "postgres";
};

export function getDatabaseStatus(): DatabaseStatus {
  return { configured: isEnvSet("DATABASE_URL"), provider: "postgres" };
}
