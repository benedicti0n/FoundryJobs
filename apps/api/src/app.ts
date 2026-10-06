import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import { APP_NAME, isEnvSet } from "@foundryjobs/shared";
import { DatabaseNotConfiguredError, getDatabaseStatus } from "@foundryjobs/db";
import { registerApprovalRoutes } from "./routes/approvals";
import { registerGeneratedPostRoutes } from "./routes/generated-posts";
import { registerJobPostRoutes } from "./routes/job-posts";
import { registerPublishEventRoutes } from "./routes/publish-events";
import { registerSchedulerRoutes } from "./routes/scheduler";
import { registerRawPostRoutes } from "./routes/raw-posts";
import { registerSourceRoutes } from "./routes/sources";

export type CreateAppOptions = {
  logger?: boolean;
};

export async function createApp(options: CreateAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });

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

  app.get("/ready", async () => {
    const databaseConfigured = isEnvSet("DATABASE_URL");
    const adminTokenConfigured = isEnvSet("API_ADMIN_TOKEN");
    return {
      ok: databaseConfigured && adminTokenConfigured,
      databaseConfigured,
      adminTokenConfigured,
    };
  });

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

  await registerSourceRoutes(app);
  await registerRawPostRoutes(app);
  await registerJobPostRoutes(app);
  await registerGeneratedPostRoutes(app);
  await registerApprovalRoutes(app);
  await registerPublishEventRoutes(app);
  await registerSchedulerRoutes(app);

  return app;
}
