import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import type { FastifyInstance } from "fastify";
import { closeTestDatabase } from "../helpers/test-db";
import { createApp } from "../../apps/api/src/app";

const TEST_ADMIN_TOKEN = `test-admin-token-${randomUUID()}`;
process.env.API_ADMIN_TOKEN = TEST_ADMIN_TOKEN;

let app: FastifyInstance;
const unknownId = "00000000-0000-4000-8000-000000000000";

before(async () => {
  app = await createApp();
  await app.ready();
});

after(async () => {
  await app.close();
  await closeTestDatabase();
});

test("mutations without a token are rejected with 401", async () => {
  const approval = await app.inject({
    method: "POST",
    url: `/v1/generated-posts/${unknownId}/approval`,
    payload: { decision: "approved" },
  });
  assert.equal(approval.statusCode, 401);
  assert.equal(approval.json().error.message, "Unauthorized");

  const publish = await app.inject({
    method: "POST",
    url: `/v1/generated-posts/${unknownId}/publish/telegram`,
  });
  assert.equal(publish.statusCode, 401);

  const edit = await app.inject({
    method: "PATCH",
    url: `/v1/generated-posts/${unknownId}/text`,
    payload: { textContent: "hello" },
  });
  assert.equal(edit.statusCode, 401);
});

test("mutations with a wrong token are rejected with 401", async () => {
  const response = await app.inject({
    method: "POST",
    url: `/v1/generated-posts/${unknownId}/approval`,
    headers: { "x-admin-token": "definitely-wrong" },
    payload: { decision: "approved" },
  });
  assert.equal(response.statusCode, 401);
});

test("the real token is accepted and reaches validation/DB lookups", async () => {
  const notFound = await app.inject({
    method: "POST",
    url: `/v1/generated-posts/${unknownId}/approval`,
    headers: { "x-admin-token": TEST_ADMIN_TOKEN },
    payload: { decision: "approved" },
  });
  assert.equal(notFound.statusCode, 404);

  const invalidBody = await app.inject({
    method: "POST",
    url: `/v1/generated-posts/${unknownId}/approval`,
    headers: { "x-admin-token": TEST_ADMIN_TOKEN },
    payload: { decision: "not-a-decision" },
  });
  assert.equal(invalidBody.statusCode, 400);

  const invalidEdit = await app.inject({
    method: "PATCH",
    url: `/v1/generated-posts/${unknownId}/text`,
    headers: { "x-admin-token": TEST_ADMIN_TOKEN },
    payload: { textContent: "   " },
  });
  assert.equal(invalidEdit.statusCode, 400);
});

test("publish endpoints authorize before doing any provider work", async () => {
  const noToken = await app.inject({
    method: "POST",
    url: `/v1/generated-posts/${unknownId}/publish/buffer`,
  });
  assert.equal(noToken.statusCode, 401);

  const withToken = await app.inject({
    method: "POST",
    url: `/v1/generated-posts/${unknownId}/publish/buffer`,
    headers: { "x-admin-token": TEST_ADMIN_TOKEN },
  });
  assert.equal(withToken.statusCode, 404);
});

test("read-only endpoints stay public and /ready reports configuration", async () => {
  const queue = await app.inject({ method: "GET", url: "/v1/approval-queue?limit=1" });
  assert.equal(queue.statusCode, 200);

  const ready = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(ready.statusCode, 200);
  assert.equal(ready.json().ok, true);
});
