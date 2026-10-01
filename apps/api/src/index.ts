import Fastify, { type FastifyError } from "fastify";
import { APP_NAME, getPort } from "@foundryjobs/shared";
import { DatabaseNotConfiguredError, getDatabaseStatus } from "@foundryjobs/db";
import { registerApprovalRoutes } from "./routes/approvals";
import { registerGeneratedPostRoutes } from "./routes/generated-posts";
import { registerJobPostRoutes } from "./routes/job-posts";
import { registerRawPostRoutes } from "./routes/raw-posts";
import { registerSourceRoutes } from "./routes/sources";

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

app.setNotFoundHandler((request, reply) => {
  reply
    .status(404)
    .send({ error: { message: `Route ${request.method}:${request.url} not found` } });
});

app.setErrorHandler((error: FastifyError, request, reply) => {
  request.log.error(error);

  if (error instanceof DatabaseNotConfiguredError) {
    reply.status(500).send({ error: { message: error.message } });
    return;
  }

  const statusCode = error.statusCode ?? 500;
  const message = statusCode >= 500 ? "Internal Server Error" : error.message;
  reply.status(statusCode).send({ error: { message } });
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
await registerSourceRoutes(app);
await registerRawPostRoutes(app);
await registerJobPostRoutes(app);
await registerGeneratedPostRoutes(app);
await registerApprovalRoutes(app);
await start();
