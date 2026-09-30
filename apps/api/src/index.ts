import Fastify, { type FastifyError } from "fastify";
import { APP_NAME, getPort } from "@foundryjobs/shared";
import { getDatabaseStatus } from "@foundryjobs/db";

const app = Fastify({ logger: true });

app.get("/health", async () => ({
  ok: true,
  service: "foundryjobs-api",
}));

app.get("/v1/status", async () => ({
  name: APP_NAME,
  phase: "bootstrap",
  ready: true,
}));

app.get("/v1/db/status", async () => getDatabaseStatus());

app.setErrorHandler((error: FastifyError, request, reply) => {
  request.log.error(error);
  const statusCode = error.statusCode ?? 500;
  const message = statusCode >= 500 ? "Internal Server Error" : error.message;
  reply.status(statusCode).send({ ok: false, error: message });
});

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
