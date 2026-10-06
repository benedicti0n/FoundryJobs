import assert from "node:assert/strict";
import test from "node:test";
import { generateInstagramTriggerKeyword } from "../src/instagram-keyword";

test("keyword generation is deterministic from the company name", () => {
  const first = generateInstagramTriggerKeyword("Google", "Software Engineer", new Set());
  const second = generateInstagramTriggerKeyword("Google", "Software Engineer", new Set());
  assert.deepEqual(first, second);
  assert.deepEqual(first, { display: "GOOGLE", normalized: "google" });
});

test("display is uppercase and normalized is lowercase and consistent", () => {
  const keyword = generateInstagramTriggerKeyword("Figma", "Data Engineer Intern", new Set());
  assert.equal(keyword.display, keyword.display.toUpperCase());
  assert.equal(keyword.normalized, keyword.display.toLowerCase());
});

test("collision appends a deterministic role shorthand", () => {
  const keyword = generateInstagramTriggerKeyword(
    "Figma",
    "Data Engineer Intern",
    new Set(["figma"]),
  );
  assert.equal(keyword.display, "FIGMADATAEN");
  assert.equal(keyword.normalized, "figmadataen");
});

test("double collision falls back to a numeric suffix", () => {
  const keyword = generateInstagramTriggerKeyword(
    "Figma",
    "Data Engineer Intern",
    new Set(["figma", "figmadataen"]),
  );
  assert.equal(keyword.display, "FIGMA2");
});

test("numeric suffixes keep incrementing deterministically", () => {
  const keyword = generateInstagramTriggerKeyword(
    "Figma",
    "Data Engineer Intern",
    new Set(["figma", "figmadataen", "figma2", "figma3"]),
  );
  assert.equal(keyword.display, "FIGMA4");
});

test("generic keywords are never produced", () => {
  for (const company of ["Link", "Free", "Guide", "Jobs", "Hiring"]) {
    const keyword = generateInstagramTriggerKeyword(company, "Software Engineer", new Set());
    assert.ok(!["LINK", "FREE", "GUIDE", "JOBS", "HIRING"].includes(keyword.display));
  }
});

test("empty company falls back to the role or FJOB", () => {
  const keyword = generateInstagramTriggerKeyword(null, "Software Engineer", new Set());
  assert.equal(keyword.display, "SOFTWARE");
  const fallback = generateInstagramTriggerKeyword(null, null, new Set());
  assert.equal(fallback.display, "FJOB");
});

test("taken keywords are matched case-insensitively", () => {
  const keyword = generateInstagramTriggerKeyword("Google", "SWE", new Set(["GoOgLe"]));
  assert.equal(keyword.display, "GOOGLESWE");
});
