import { APP_NAME, getPort } from "@foundryjobs/shared";
import { getDatabaseStatus } from "@foundryjobs/db";
import { createApp } from "./app";

const app = await createApp({ logger: true });

const port = getPort(4000);

async function start(): Promise<void> {
  try {
    await app.listen({ port, host: "0.0.0.0" });
    app.log.info({ port, database: getDatabaseStatus() }, `${APP_NAME} API listening`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info(`${signal} received, shutting down`);
  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

function registerShutdownHandlers(): void {
  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

registerShutdownHandlers();
await start();
