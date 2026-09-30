import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { requireEnv } from "@foundryjobs/shared";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

let database: Database | undefined;

export function createDatabase(connectionString: string): Database {
  const client = postgres(connectionString, { max: 5 });
  return drizzle(client, { schema });
}

export function getDatabase(): Database {
  database ??= createDatabase(requireEnv("DATABASE_URL"));
  return database;
}
