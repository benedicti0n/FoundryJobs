import type { FastifyInstance } from "fastify";
import {
  applyApprovalAction,
  getGeneratedPostById,
  listApprovalQueue,
  updateGeneratedPostText,
} from "@foundryjobs/db";
import {
  isUuid,
  validateApprovalActionInput,
  validateUpdateGeneratedPostTextInput,
  type GeneratedPostPlatform,
  type GeneratedPostStatus,
} from "@foundryjobs/shared";
import { parsePlatformListQuery } from "./list-query";

const GENERATED_POST_PLATFORMS: readonly string[] = ["telegram", "x", "instagram", "linkedin"];

const GENERATED_POST_STATUSES: readonly string[] = [
  "draft",
  "approved",
  "rejected",
  "published",
  "failed",
];

export async function registerApprovalRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/approval-queue", async (request, reply) => {
    const parsed = parsePlatformListQuery(request.query, {
      statuses: GENERATED_POST_STATUSES,
      platforms: GENERATED_POST_PLATFORMS,
    });
    if (!parsed.ok) {
      return reply.status(400).send({ error: { message: parsed.errors.join("; ") } });
    }

    const data = await listApprovalQueue({
      platform: parsed.value.platform as GeneratedPostPlatform | undefined,
      status: parsed.value.status as GeneratedPostStatus | undefined,
      limit: parsed.value.limit,
      offset: parsed.value.offset,
    });

    return { data };
  });

  app.get<{ Params: { id: string } }>("/v1/generated-posts/:id", async (request, reply) => {
    const { id } = request.params;
    if (!isUuid(id)) {
      return reply.status(400).send({ error: { message: "id must be a valid UUID" } });
    }

    const generatedPost = await getGeneratedPostById(id);
    if (!generatedPost) {
      return reply.status(404).send({ error: { message: "Generated post not found" } });
    }
    return { data: generatedPost };
  });

  app.patch<{ Params: { id: string } }>("/v1/generated-posts/:id/text", async (request, reply) => {
    const { id } = request.params;
    if (!isUuid(id)) {
      return reply.status(400).send({ error: { message: "id must be a valid UUID" } });
    }

    const parsed = validateUpdateGeneratedPostTextInput(request.body);
    if (!parsed.ok) {
      return reply.status(400).send({ error: { message: parsed.errors.join("; ") } });
    }

    const generatedPost = await getGeneratedPostById(id);
    if (!generatedPost) {
      return reply.status(404).send({ error: { message: "Generated post not found" } });
    }

    const updated = await updateGeneratedPostText(id, parsed.data.textContent);
    if (!updated) {
      return reply.status(404).send({ error: { message: "Generated post not found" } });
    }
    return { data: updated };
  });

  app.post<{ Params: { id: string } }>(
    "/v1/generated-posts/:id/approval",
    async (request, reply) => {
      const { id } = request.params;
      if (!isUuid(id)) {
        return reply.status(400).send({ error: { message: "id must be a valid UUID" } });
      }

      const parsed = validateApprovalActionInput(request.body);
      if (!parsed.ok) {
        return reply.status(400).send({ error: { message: parsed.errors.join("; ") } });
      }

      const generatedPost = await getGeneratedPostById(id);
      if (!generatedPost) {
        return reply.status(404).send({ error: { message: "Generated post not found" } });
      }

      if (parsed.data.decision === "approved") {
        const effectiveText = (parsed.data.textContent ?? generatedPost.textContent).trim();
        if (effectiveText.length === 0) {
          return reply
            .status(400)
            .send({ error: { message: "Cannot approve a generated post with empty text" } });
        }
      }

      const result = await applyApprovalAction(id, parsed.data);
      if (!result) {
        return reply.status(404).send({ error: { message: "Generated post not found" } });
      }
      return { data: result };
    },
  );
}
