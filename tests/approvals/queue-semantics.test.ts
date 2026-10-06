import assert from "node:assert/strict";
import test, { after } from "node:test";
import { applyApprovalAction, listApprovalQueue } from "@foundryjobs/db";
import {
  closeTestDatabase,
  createFixtureJob,
  createFixturePost,
  getFixtureApprovals,
} from "../helpers/test-db";

after(async () => {
  await closeTestDatabase();
});

test("approval queue is generated_posts(status=draft) and never equals approval rows", async () => {
  const jobA = await createFixtureJob({ roleTitle: "Queue Test Role A" });
  const jobB = await createFixtureJob({ roleTitle: "Queue Test Role B" });

  for (const platform of ["telegram", "x", "instagram", "linkedin"] as const) {
    await createFixturePost({ jobPostId: jobA.id, platform });
    await createFixturePost({ jobPostId: jobB.id, platform });
  }

  const jobBTelegram = (await listApprovalQueue({ platform: "telegram", limit: 200 })).find(
    (item) => item.jobPostId === jobB.id,
  );
  assert.ok(jobBTelegram);
  await applyApprovalAction(jobBTelegram.generatedPostId, {
    decision: "approved",
    decidedBy: "test",
  });

  const queue = await listApprovalQueue({ limit: 200 });
  const scoped = queue.filter((item) => item.jobPostId === jobA.id || item.jobPostId === jobB.id);

  assert.equal(scoped.length, 7, "8 drafts minus 1 approved post");
  assert.ok(scoped.every((item) => item.generatedPostStatus === "draft"));
  assert.ok(
    scoped.every((item) => item.generatedPostId !== jobBTelegram.generatedPostId),
    "approved posts leave the draft queue",
  );

  const approvalRowsA = await getFixtureApprovals(jobA.id);
  const approvalRowsB = await getFixtureApprovals(jobB.id);
  assert.equal(approvalRowsA.length, 0);
  assert.equal(approvalRowsB.length, 1);
  assert.notEqual(
    scoped.length,
    approvalRowsA.length + approvalRowsB.length,
    "queue counts platform drafts; approvals counts decision events",
  );
});

test("queue platform filter selects draft platform rows only", async () => {
  const job = await createFixtureJob({ roleTitle: "Queue Filter Role" });
  await createFixturePost({ jobPostId: job.id, platform: "telegram" });
  await createFixturePost({ jobPostId: job.id, platform: "x" });

  const telegramDrafts = (await listApprovalQueue({ platform: "telegram", limit: 200 })).filter(
    (item) => item.jobPostId === job.id,
  );
  assert.equal(telegramDrafts.length, 1);
  assert.equal(telegramDrafts[0]?.platform, "telegram");
});
