import { timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

export const API_ADMIN_SETUP_ERROR = "API admin token is not configured. Set API_ADMIN_TOKEN.";

function safeEqual(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function requireAdminToken(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const expected = process.env.API_ADMIN_TOKEN;
  if (!expected || expected.trim().length === 0) {
    reply.status(500).send({ error: { message: API_ADMIN_SETUP_ERROR } });
    return;
  }

  const header = request.headers["x-admin-token"];
  const provided = Array.isArray(header) ? header[0] : header;
  if (typeof provided !== "string" || provided.length === 0 || !safeEqual(provided, expected)) {
    reply.status(401).send({ error: { message: "Unauthorized" } });
  }
}
