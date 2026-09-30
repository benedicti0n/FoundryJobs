import type { FastifyInstance } from "fastify";
import { listJobPosts } from "@foundryjobs/db";
import type { JobStatus } from "@foundryjobs/shared";
import { parseListQuery } from "./list-query";

const JOB_POST_STATUSES: readonly JobStatus[] = [
  "draft",
  "scored",
  "queued",
  "approved",
  "rejected",
  "published",
  "expired",
];

export async function registerJobPostRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/job-posts", async (request, reply) => {
    const parsed = parseListQuery(request.query, JOB_POST_STATUSES);
    if (!parsed.ok) {
      return reply.status(400).send({ error: { message: parsed.errors.join("; ") } });
    }

    const data = await listJobPosts({
      status: parsed.value.status as JobStatus | undefined,
      limit: parsed.value.limit,
      offset: parsed.value.offset,
    });

    return { data };
  });
}
