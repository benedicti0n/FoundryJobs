import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { requireEnv } from "@foundryjobs/shared";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

let client: ReturnType<typeof postgres> | undefined;
let database: Database | undefined;

export function createDatabase(connectionString: string): Database {
  return drizzle(postgres(connectionString, { max: 5 }), { schema });
}

export function getDatabase(): Database {
  if (!database) {
    client = postgres(requireEnv("DATABASE_URL"), { max: 5 });
    database = drizzle(client, { schema });
  }
  return database;
}

export async function closeDatabase(): Promise<void> {
  await client?.end();
  client = undefined;
  database = undefined;
}
