import type { FastifyInstance } from "fastify";
import { renderInstagramCard } from "@foundryjobs/card-renderer";
import { uploadInstagramCard } from "@foundryjobs/card-uploader";
import {
  getJobPostWithLatestScore,
  getRenderableInstagramPost,
  getUploadableInstagramCard,
  listGeneratedPosts,
  type GeneratedPostListQuery,
} from "@foundryjobs/db";
import { generatePostsForJob } from "@foundryjobs/post-generator";
import { R2_CONFIG_ERROR, isR2Configured } from "@foundryjobs/storage";
import { isUuid, type GeneratedPostPlatform, type GeneratedPostStatus } from "@foundryjobs/shared";
import { requireAdminToken } from "../auth/admin-token";

const GENERATED_POST_PLATFORMS: readonly GeneratedPostPlatform[] = [
  "telegram",
  "x",
  "instagram",
  "linkedin",
];

const GENERATED_POST_STATUSES: readonly GeneratedPostStatus[] = [
  "draft",
  "approved",
  "rejected",
  "published",
  "failed",
];

const LIST_MAX_LIMIT = 200;
const LIST_MAX_OFFSET = 1_000_000;

type GeneratedPostQueryParseResult =
  { ok: true; value: GeneratedPostListQuery } | { ok: false; errors: string[] };

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

function parseGeneratedPostQuery(raw: unknown): GeneratedPostQueryParseResult {
  const input = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const errors: string[] = [];
  const value: GeneratedPostListQuery = {};

  if (input.jobPostId !== undefined) {
    if (typeof input.jobPostId !== "string" || !isUuid(input.jobPostId)) {
      errors.push("jobPostId must be a valid UUID");
    } else {
      value.jobPostId = input.jobPostId;
    }
  }

  if (input.platform !== undefined) {
    if (
      typeof input.platform !== "string" ||
      !(GENERATED_POST_PLATFORMS as readonly string[]).includes(input.platform)
    ) {
      errors.push(`platform must be one of: ${GENERATED_POST_PLATFORMS.join(", ")}`);
    } else {
      value.platform = input.platform as GeneratedPostPlatform;
    }
  }

  if (input.status !== undefined) {
    if (
      typeof input.status !== "string" ||
      !(GENERATED_POST_STATUSES as readonly string[]).includes(input.status)
    ) {
      errors.push(`status must be one of: ${GENERATED_POST_STATUSES.join(", ")}`);
    } else {
      value.status = input.status as GeneratedPostStatus;
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

export async function registerGeneratedPostRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/generated-posts", async (request, reply) => {
    const parsed = parseGeneratedPostQuery(request.query);
    if (!parsed.ok) {
      return reply.status(400).send({ error: { message: parsed.errors.join("; ") } });
    }

    const data = await listGeneratedPosts(parsed.value);
    return { data };
  });

  app.post<{ Params: { id: string } }>(
    "/v1/job-posts/:id/generate-posts",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const { id } = request.params;
      if (!isUuid(id)) {
        return reply.status(400).send({ error: { message: "id must be a valid UUID" } });
      }

      const jobPost = await getJobPostWithLatestScore(id);
      if (!jobPost) {
        return reply.status(404).send({ error: { message: "Job post not found" } });
      }

      const result = await generatePostsForJob(id);
      return { data: result };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/v1/generated-posts/:id/render/instagram-card",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const { id } = request.params;
      if (!isUuid(id)) {
        return reply.status(400).send({ error: { message: "id must be a valid UUID" } });
      }

      const body =
        typeof request.body === "object" && request.body !== null
          ? (request.body as Record<string, unknown>)
          : {};
      let regenerate = false;
      if (body.regenerate !== undefined) {
        if (typeof body.regenerate !== "boolean") {
          return reply.status(400).send({ error: { message: "regenerate must be a boolean" } });
        }
        regenerate = body.regenerate;
      }

      const generatedPost = await getRenderableInstagramPost(id);
      if (!generatedPost) {
        return reply.status(404).send({ error: { message: "Generated post not found" } });
      }

      const result = await renderInstagramCard(id, { regenerate });
      return { data: result };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/v1/generated-posts/:id/upload/instagram-card",
    { preHandler: requireAdminToken },
    async (request, reply) => {
      const { id } = request.params;
      if (!isUuid(id)) {
        return reply.status(400).send({ error: { message: "id must be a valid UUID" } });
      }

      const card = await getUploadableInstagramCard(id);
      if (!card) {
        return reply.status(404).send({ error: { message: "Generated post not found" } });
      }

      if (card.platform === "instagram" && !isR2Configured()) {
        return reply.status(500).send({ error: { message: R2_CONFIG_ERROR } });
      }

      const result = await uploadInstagramCard(id);
      return { data: result };
    },
  );
}
