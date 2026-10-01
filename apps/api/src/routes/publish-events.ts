import type { FastifyInstance } from "fastify";
import { BUFFER_CONFIG_ERROR } from "@foundryjobs/buffer";
import { publishBufferGeneratedPost } from "@foundryjobs/buffer-publisher";
import {
  getBufferPublishablePost,
  getPublishableGeneratedPost,
  listPublishEvents,
  type PublishEventListQuery,
} from "@foundryjobs/db";
import { publishTelegramGeneratedPost } from "@foundryjobs/publisher";
import { isEnvSet, isUuid, type PublishPlatform, type PublishStatus } from "@foundryjobs/shared";

const PUBLISH_PLATFORMS: readonly PublishPlatform[] = ["telegram", "x", "instagram", "linkedin"];

const PUBLISH_STATUSES: readonly PublishStatus[] = ["pending", "success", "failed"];

const LIST_MAX_LIMIT = 200;
const LIST_MAX_OFFSET = 1_000_000;

type PublishEventQueryParseResult =
  { ok: true; value: PublishEventListQuery } | { ok: false; errors: string[] };

function parseInteger(
  value: unknown,
  field: string,
  min: number,
  max: number,
  errors: string[],
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  let parsed: number | undefined;
  if (typeof value === "number") {
    parsed = value;
  } else if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    parsed = Number.parseInt(value.trim(), 10);
  }

  if (parsed === undefined || !Number.isInteger(parsed) || parsed < min || parsed > max) {
    errors.push(`${field} must be an integer between ${min} and ${max}`);
    return undefined;
  }
  return parsed;
}

function parsePublishEventQuery(raw: unknown): PublishEventQueryParseResult {
  const input = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const errors: string[] = [];
  const value: PublishEventListQuery = {};

  if (input.platform !== undefined) {
    if (
      typeof input.platform !== "string" ||
      !(PUBLISH_PLATFORMS as readonly string[]).includes(input.platform)
    ) {
      errors.push(`platform must be one of: ${PUBLISH_PLATFORMS.join(", ")}`);
    } else {
      value.platform = input.platform as PublishPlatform;
    }
  }

  if (input.status !== undefined) {
    if (
      typeof input.status !== "string" ||
      !(PUBLISH_STATUSES as readonly string[]).includes(input.status)
    ) {
      errors.push(`status must be one of: ${PUBLISH_STATUSES.join(", ")}`);
    } else {
      value.status = input.status as PublishStatus;
    }
  }

  if (input.generatedPostId !== undefined) {
    if (typeof input.generatedPostId !== "string" || !isUuid(input.generatedPostId)) {
      errors.push("generatedPostId must be a valid UUID");
    } else {
      value.generatedPostId = input.generatedPostId;
    }
  }

  if (input.jobPostId !== undefined) {
    if (typeof input.jobPostId !== "string" || !isUuid(input.jobPostId)) {
      errors.push("jobPostId must be a valid UUID");
    } else {
      value.jobPostId = input.jobPostId;
    }
  }

  const limit = parseInteger(input.limit, "limit", 1, LIST_MAX_LIMIT, errors);
  if (limit !== undefined) {
    value.limit = limit;
  }

  const offset = parseInteger(input.offset, "offset", 0, LIST_MAX_OFFSET, errors);
  if (offset !== undefined) {
    value.offset = offset;
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value };
}

export async function registerPublishEventRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/publish-events", async (request, reply) => {
    const parsed = parsePublishEventQuery(request.query);
    if (!parsed.ok) {
      return reply.status(400).send({ error: { message: parsed.errors.join("; ") } });
    }

    const data = await listPublishEvents(parsed.value);
    return { data };
  });

  app.post<{ Params: { id: string } }>(
    "/v1/generated-posts/:id/publish/telegram",
    async (request, reply) => {
      const { id } = request.params;
      if (!isUuid(id)) {
        return reply.status(400).send({ error: { message: "id must be a valid UUID" } });
      }

      const generatedPost = await getPublishableGeneratedPost(id);
      if (!generatedPost) {
        return reply.status(404).send({ error: { message: "Generated post not found" } });
      }

      if (!isEnvSet("TELEGRAM_BOT_TOKEN") || !isEnvSet("TELEGRAM_CHAT_ID")) {
        return reply.status(500).send({
          error: {
            message: "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required for Telegram publishing",
          },
        });
      }

      const result = await publishTelegramGeneratedPost(id);
      return { data: result };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/v1/generated-posts/:id/publish/buffer",
    async (request, reply) => {
      const { id } = request.params;
      if (!isUuid(id)) {
        return reply.status(400).send({ error: { message: "id must be a valid UUID" } });
      }

      const generatedPost = await getBufferPublishablePost(id);
      if (!generatedPost) {
        return reply.status(404).send({ error: { message: "Generated post not found" } });
      }

      const result = await publishBufferGeneratedPost(id);
      if (result.status === "failed" && result.errorMessage === BUFFER_CONFIG_ERROR) {
        return reply.status(500).send({ error: { message: BUFFER_CONFIG_ERROR } });
      }
      return { data: result };
    },
  );
}
