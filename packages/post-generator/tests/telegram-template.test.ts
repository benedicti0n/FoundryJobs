import assert from "node:assert/strict";
import test from "node:test";
import type { JobPostWithScoreDto } from "@foundryjobs/db";
import {
  buildTelegramJobPost,
  buildTelegramRequirementBullets,
  resolveAlertType,
  TELEGRAM_MESSAGE_LIMIT,
} from "../src/telegram-template";

function job(overrides: Partial<JobPostWithScoreDto> = {}): JobPostWithScoreDto {
  return {
    id: "job-1",
    rawPostId: null,
    companyName: "Google",
    roleTitle: "Software Engineer Intern",
    roleCategory: "Engineering",
    location: "Bengaluru, India",
    workMode: "hybrid",
    employmentType: "internship",
    experienceMin: 0,
    experienceMax: 1,
    qualification: "Currently pursuing a relevant technical degree",
    batchYears: ["2026", "2027"],
    skills: ["Python", "Java", "C++"],
    salaryText: "₹80,000/month",
    applyUrl: "https://example.com/job",
    applyEmail: null,
    sourceUrl: null,
    postedAt: null,
    status: "scored",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    latestScore: { totalScore: 85, shouldPost: true, spamRisk: "low", aiReason: null },
    sourceCategory: "big_tech",
    ...overrides,
  };
}

test("1. all fields present renders the full format", () => {
  const post = buildTelegramJobPost(job());
  assert.match(post, /^🚀 Internship Hiring Alert/);
  assert.match(post, /🏢 Company: Google/);
  assert.match(post, /💼 Role: Software Engineer Intern/);
  assert.match(post, /📍 Location: Bengaluru, India/);
  assert.match(post, /🎓 Batch \/ Eligibility: 2026\/2027 graduates/);
  assert.match(post, /⏳ Experience: Internship \/ 0–1 years/);
  assert.match(post, /💰 Salary \/ Stipend: ₹80,000\/month/);
  assert.match(post, /🏠 Work Mode: Hybrid/);
  assert.match(post, /📌 What they're looking for:/);
  assert.match(post, /🔗 Apply:\nhttps:\/\/example\.com\/job$/);
});

test("2. missing salary omits the salary line", () => {
  const post = buildTelegramJobPost(job({ salaryText: null }));
  assert.doesNotMatch(post, /Salary \/ Stipend/);
});

test("3. missing batch omits the batch line", () => {
  const post = buildTelegramJobPost(job({ batchYears: [], qualification: null }));
  assert.doesNotMatch(post, /Batch \/ Eligibility/);
});

test("4. unknown work mode omits the work mode line", () => {
  const post = buildTelegramJobPost(job({ workMode: "unknown" }));
  assert.doesNotMatch(post, /Work Mode/);
});

test("5. missing experience omits the experience line", () => {
  const post = buildTelegramJobPost(
    job({ employmentType: "full_time", experienceMin: null, experienceMax: null }),
  );
  assert.doesNotMatch(post, /⏳ Experience/);
});

test("6. requirement bullets dedupe identical fragments", () => {
  const bullets = buildTelegramRequirementBullets(
    job({
      skills: ["Python", "python", "Python"],
      batchYears: [],
      qualification: null,
      employmentType: "full_time",
      experienceMin: null,
      experienceMax: null,
    }),
  );
  assert.equal(bullets.length, 1);
});

test("7. requirement bullets cap at 4", () => {
  const bullets = buildTelegramRequirementBullets(
    job({
      skills: ["A", "B", "C", "D", "E", "F", "G"],
      batchYears: ["2026"],
      qualification: "Degree",
    }),
  );
  assert.ok(bullets.length <= 4);
});

test("8. direct application URL is preserved untruncated", () => {
  const url = `https://boards.greenhouse.io/figma/jobs/6178851004?gh_jid=6178851004&utm_source=foundryjobs`;
  const post = buildTelegramJobPost(job({ applyUrl: url, applyEmail: null }));
  assert.ok(post.includes(url));
});

test("9. alert type mass_hiring", () => {
  assert.equal(
    resolveAlertType(
      job({
        sourceCategory: "mass_hiring",
        roleTitle: "Graduate Engineer Trainee",
        employmentType: "full_time",
      }),
    ).heading,
    "🔥 Mass Hiring Alert",
  );
});

test("10. alert type internship", () => {
  assert.equal(
    resolveAlertType(job({ sourceCategory: "startup" })).heading,
    "🚀 Internship Hiring Alert",
  );
});

test("11. alert type fresher", () => {
  assert.equal(
    resolveAlertType(
      job({
        roleTitle: "Software Engineer",
        employmentType: "full_time",
        sourceCategory: "startup",
        batchYears: ["2026"],
      }),
    ).heading,
    "🚨 Fresher Hiring Alert",
  );
});

test("12. alert type remote", () => {
  assert.equal(
    resolveAlertType(
      job({
        roleTitle: "Backend Engineer",
        employmentType: "full_time",
        workMode: "remote",
        batchYears: [],
        sourceCategory: "remote",
        experienceMin: null,
        experienceMax: null,
      }),
    ).heading,
    "🌍 Remote Hiring Alert",
  );
});

test("13. alert type big_tech", () => {
  assert.equal(
    resolveAlertType(
      job({
        roleTitle: "Backend Engineer",
        employmentType: "full_time",
        workMode: "onsite",
        batchYears: [],
        sourceCategory: "big_tech",
        experienceMin: null,
        experienceMax: null,
      }),
    ).heading,
    "🏢 Big Tech Hiring Alert",
  );
});

test("14. alert type startup/YC", () => {
  assert.equal(
    resolveAlertType(
      job({
        roleTitle: "Backend Engineer",
        employmentType: "full_time",
        workMode: "onsite",
        batchYears: [],
        sourceCategory: "yc",
        experienceMin: null,
        experienceMax: null,
      }),
    ).heading,
    "⚡ Startup Hiring Alert",
  );
});

test("15. generic fallback", () => {
  assert.equal(
    resolveAlertType(
      job({
        roleTitle: "Backend Engineer",
        employmentType: "full_time",
        workMode: "onsite",
        batchYears: [],
        sourceCategory: null,
        experienceMin: null,
        experienceMax: null,
      }),
    ).heading,
    "🚨 Hiring Alert",
  );
});

test("16. no null/undefined strings appear in output", () => {
  const post = buildTelegramJobPost(
    job({
      salaryText: null,
      location: null,
      batchYears: [],
      qualification: null,
      experienceMin: null,
      experienceMax: null,
      workMode: "unknown",
      skills: [],
    }),
  );
  assert.doesNotMatch(post, /undefined|null|N\/A|Not Disclosed/);
});

test("17. html in values is sanitized", () => {
  const post = buildTelegramJobPost(
    job({ companyName: "<b>Acme</b> &amp; Co", qualification: "<p>B.Tech</p>" }),
  );
  assert.match(post, /🏢 Company: Acme & Co/);
  assert.doesNotMatch(post, /<b>|<p>/);
});

test("18. no blank-line artifacts when optional fields are missing", () => {
  const post = buildTelegramJobPost(
    job({ salaryText: null, workMode: "unknown", batchYears: [], qualification: null }),
  );
  assert.doesNotMatch(post, /\n\n\n/);
});

test("19. long content stays within the Telegram message limit", () => {
  const post = buildTelegramJobPost(
    job({
      skills: Array.from({ length: 60 }, (_, index) => `Skill number ${index}`),
      qualification: "x".repeat(300),
    }),
  );
  assert.ok(post.length <= TELEGRAM_MESSAGE_LIMIT);
});

test("example fixture: missing salary/work mode matches the documented shape", () => {
  const post = buildTelegramJobPost(
    job({
      companyName: "Figma",
      roleTitle: "Data Engineer",
      location: "San Francisco / Remote",
      workMode: "unknown",
      employmentType: "full_time",
      experienceMin: 0,
      experienceMax: 1,
      salaryText: null,
      batchYears: [],
      qualification: null,
      skills: ["SQL", "Data Engineering"],
      applyUrl: "https://example.com/job",
      sourceCategory: "big_tech",
    }),
  );
  assert.match(post, /^🚨 Fresher Hiring Alert/);
  assert.doesNotMatch(post, /Salary|Work Mode|Batch/);
  assert.match(post, /⏳ Experience: 0–1 years/);
});
