import assert from "node:assert/strict";
import test, { after } from "node:test";
import {
  applyApprovalAction,
  getGeneratedPostById,
  updateGeneratedPostText,
} from "@foundryjobs/db";
import {
  closeTestDatabase,
  createFixtureJob,
  createFixturePost,
  getFixtureApprovals,
} from "../helpers/test-db";

after(async () => {
  await closeTestDatabase();
});

test("draft -> approved records status and approval row", async () => {
  const job = await createFixtureJob();
  const post = await createFixturePost({ jobPostId: job.id, platform: "telegram" });

  const result = await applyApprovalAction(post.id, { decision: "approved", decidedBy: "test" });
  assert.ok(result);
  assert.equal(result.generatedPostStatus, "approved");
  assert.equal(result.jobPostId, job.id);

  const stored = await getGeneratedPostById(post.id);
  assert.equal(stored?.status, "approved");
  assert.deepEqual(await getFixtureApprovals(job.id), [{ decision: "approved" }]);
});

test("draft -> rejected records status and approval row", async () => {
  const job = await createFixtureJob();
  const post = await createFixturePost({ jobPostId: job.id, platform: "x" });

  const result = await applyApprovalAction(post.id, { decision: "rejected", decidedBy: "test" });
  assert.ok(result);
  assert.equal(result.generatedPostStatus, "rejected");
  assert.equal((await getGeneratedPostById(post.id))?.status, "rejected");
  assert.deepEqual(await getFixtureApprovals(job.id), [{ decision: "rejected" }]);
});

test("draft -> needs_edit records a row and leaves the post in draft", async () => {
  const job = await createFixtureJob();
  const post = await createFixturePost({ jobPostId: job.id, platform: "instagram" });

  const result = await applyApprovalAction(post.id, {
    decision: "needs_edit",
    decidedBy: "test",
    notes: "Needs a rewrite",
  });
  assert.ok(result);
  assert.equal(result.generatedPostStatus, "draft");
  assert.equal((await getGeneratedPostById(post.id))?.status, "draft");
  assert.deepEqual(await getFixtureApprovals(job.id), [{ decision: "needs_edit" }]);
});

test("failed -> approved retry is allowed", async () => {
  const job = await createFixtureJob();
  const post = await createFixturePost({
    jobPostId: job.id,
    platform: "telegram",
    status: "failed",
  });

  const result = await applyApprovalAction(post.id, { decision: "approved", decidedBy: "test" });
  assert.ok(result);
  assert.equal(result.generatedPostStatus, "approved");
  assert.equal((await getGeneratedPostById(post.id))?.status, "approved");
  assert.deepEqual(await getFixtureApprovals(job.id), [{ decision: "approved" }]);
});

test("edited text persists exactly (trimmed)", async () => {
  const job = await createFixtureJob();
  const post = await createFixturePost({ jobPostId: job.id, platform: "linkedin" });

  const updated = await updateGeneratedPostText(post.id, "  Exact edited text  ");
  assert.equal(updated?.textContent, "Exact edited text");
  assert.equal((await getGeneratedPostById(post.id))?.textContent, "Exact edited text");
});

test("empty edit is rejected", async () => {
  const job = await createFixtureJob();
  const post = await createFixturePost({ jobPostId: job.id, platform: "telegram" });

  await assert.rejects(() => updateGeneratedPostText(post.id, "   "), /must not be empty/);
  await assert.rejects(
    () => applyApprovalAction(post.id, { decision: "approved", textContent: "   " }),
    /must not be empty/,
  );
  assert.equal((await getGeneratedPostById(post.id))?.status, "draft");
});

test("applyApprovalAction returns null for unknown posts", async () => {
  const result = await applyApprovalAction("00000000-0000-4000-8000-000000000000", {
    decision: "approved",
  });
  assert.equal(result, null);
});
