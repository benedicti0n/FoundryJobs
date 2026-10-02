import type { FastifyInstance } from "fastify";
import { normalizeRawPost } from "@foundryjobs/normalizer";
import { getRawPostById, listRawPosts } from "@foundryjobs/db";
import { isUuid, type RawPostStatus } from "@foundryjobs/shared";
import { requireAdminToken } from "../auth/admin-token";
import { parseListQuery } from "./list-query";

const RAW_POST_STATUSES: readonly RawPostStatus[] = [
  "new",
  "duplicate",
  "normalized",
  "rejected",
  "error",
];

export async function registerRawPostRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/raw-posts", async (request, reply) => {
    const parsed = parseListQuery(request.query, RAW_POST_STATUSES);
    if (!parsed.ok) {
      return reply.status(400).send({ error: { message: parsed.errors.join("; ") } });
    }

    const data = await listRawPosts({
      status: parsed.value.status as RawPostStatus | undefined,
      sourceId: parsed.value.sourceId,
      limit: parsed.value.limit,
      offset: parsed.value.offset,
    });

    return { data };
  });

  app.post<{ Params: { id: string } }>(
    "/v1/raw-posts/:id/normalize",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const { id } = request.params;
      if (!isUuid(id)) {
        return reply.status(400).send({ error: { message: "id must be a valid UUID" } });
      }

      const rawPost = await getRawPostById(id);
      if (!rawPost) {
        return reply.status(404).send({ error: { message: "Raw post not found" } });
      }
      if (rawPost.status !== "new") {
        return reply.status(400).send({
          error: {
            message: `Raw post is not pending normalization (current status: ${rawPost.status})`,
          },
        });
      }

      const result = await normalizeRawPost(id);
      return { data: result };
    },
  );
}
