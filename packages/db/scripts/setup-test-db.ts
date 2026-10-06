import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const DEFAULT_TEST_DATABASE_URL = "postgres://benediction@127.0.0.1:5432/foundryjobs_test";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
const url = new URL(testDatabaseUrl);
const databaseName = url.pathname.replace(/^\//, "");

if (!LOCAL_HOSTS.has(url.hostname)) {
  throw new Error(
    `Refusing to set up test database on non-local host ${url.hostname}; tests must never touch remote databases`,
  );
}
if (!/^[a-z0-9_]+$/.test(databaseName) || !databaseName.endsWith("_test")) {
  throw new Error(
    `Refusing to reset database "${databaseName}"; test database names must match /^[a-z0-9_]+_test$/`,
  );
}

const adminUrl = new URL(url.toString());
adminUrl.pathname = "/postgres";

const admin = postgres(adminUrl.toString(), { max: 1 });
try {
  await admin.unsafe(`drop database if exists "${databaseName}" with (force)`);
  await admin.unsafe(`create database "${databaseName}"`);
} finally {
  await admin.end();
}

const client = postgres(url.toString(), { max: 1 });
try {
  await migrate(drizzle(client), {
    migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  });
} finally {
  await client.end();
}

console.log(`Test database "${databaseName}" recreated and migrated`);
