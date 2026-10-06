import assert from "node:assert/strict";
import test from "node:test";
import { classifyRelevance, prioritizeByRelevance } from "../src/relevance-filter";

test("fresher/intern titles classify as likely_relevant", () => {
  assert.equal(classifyRelevance({ title: "Software Engineer Intern" }).bucket, "likely_relevant");
  assert.equal(classifyRelevance({ title: "Graduate Data Analyst" }).bucket, "likely_relevant");
});

test("senior titles classify as likely_irrelevant", () => {
  assert.equal(
    classifyRelevance({ title: "Senior Software Engineer" }).bucket,
    "likely_irrelevant",
  );
  assert.equal(classifyRelevance({ title: "Engineering Manager" }).bucket, "likely_irrelevant");
});

test("associate product manager remains possible", () => {
  assert.notEqual(
    classifyRelevance({ title: "Associate Product Manager" }).bucket,
    "likely_irrelevant",
  );
});

test("ambiguous titles stay uncertain", () => {
  assert.equal(classifyRelevance({ title: "Member of Technical Staff" }).bucket, "uncertain");
});

test("prioritize orders relevant before uncertain before irrelevant", () => {
  const posts = [
    { rawTitle: "Senior Staff Engineer" },
    { rawTitle: "Operations Coordinator" },
    { rawTitle: "Software Engineer Intern" },
  ];
  const ordered = prioritizeByRelevance(posts).map((post) => post.rawTitle);
  assert.deepEqual(ordered, [
    "Software Engineer Intern",
    "Operations Coordinator",
    "Senior Staff Engineer",
  ]);
});
