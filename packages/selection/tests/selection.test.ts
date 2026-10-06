import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCandidatePool,
  capCandidates,
  dedupeCandidates,
  evaluateEligibility,
  normalizeExperience,
  rankCandidate,
  runSelection,
  selectMedia,
  selectTelegram,
  withSelectionConfig,
} from "../src/index";
import type { CandidateJob, RankedCandidate } from "../src/types";

const NOW = new Date("2026-10-06T00:00:00.000Z");

let jobCounter = 0;

function job(overrides: Partial<CandidateJob> = {}): CandidateJob {
  jobCounter += 1;
  return {
    jobPostId: `job-${String(jobCounter).padStart(4, "0")}`,
    companyName: "Acme",
    roleTitle: "Software Engineer",
    roleCategory: "Engineering",
    location: "Bengaluru, India",
    workMode: "onsite",
    employmentType: "full_time",
    experienceMin: 0,
    experienceMax: 1,
    qualification: null,
    batchYears: ["2026"],
    skills: ["typescript", "react", "node"],
    salaryText: "₹40,000/month",
    applyUrl: `https://boards.greenhouse.io/acme/jobs/${jobCounter}`,
    postedAt: "2026-10-05T00:00:00.000Z",
    createdAt: "2026-10-05T00:00:00.000Z",
    sourceId: "source-acme",
    sourceName: "Acme (Greenhouse)",
    sourcePlatform: "greenhouse",
    sourceCategory: "startup",
    sourceRegion: "global",
    sourcePriority: "normal",
    sourceTrustLevel: 80,
    legacyScore: {
      totalScore: 80,
      techRelevanceScore: 15,
      freshnessScore: 20,
      spamRisk: "low",
      shouldPost: true,
    },
    recentlyPublished: false,
    ...overrides,
  };
}

function ranked(input: Partial<CandidateJob> = {}): RankedCandidate {
  const candidate = job(input);
  return rankCandidate(candidate, evaluateEligibility(candidate), NOW);
}

// ELIGIBILITY

test("1. internship accepted", () => {
  const evaluation = evaluateEligibility(
    job({ employmentType: "internship", roleTitle: "Data Intern" }),
  );
  assert.equal(evaluation.status, "eligible");
});

test("2. fresher accepted", () => {
  const evaluation = evaluateEligibility(
    job({
      employmentType: "full_time",
      roleTitle: "Graduate Software Engineer (Fresher)",
      experienceMin: 0,
      experienceMax: 0,
    }),
  );
  assert.equal(evaluation.status, "eligible");
  assert.ok(evaluation.reasons.some((reason) => reason.code === "fresher_signal"));
});

test("3. 0-1 YOE accepted", () => {
  const evaluation = evaluateEligibility(
    job({ experienceMin: 0, experienceMax: 1, roleTitle: "Junior Engineer" }),
  );
  assert.equal(evaluation.status, "eligible");
});

test("4. 1-3 YOE accepted", () => {
  const evaluation = evaluateEligibility(
    job({ experienceMin: 1, experienceMax: 3, roleTitle: "Software Engineer" }),
  );
  assert.equal(evaluation.status, "eligible");
  assert.ok(evaluation.reasons.some((reason) => reason.code === "within_yoe_range"));
});

test("5. 5+ YOE rejected", () => {
  const evaluation = evaluateEligibility(
    job({ experienceMin: 5, experienceMax: null, roleTitle: "Software Engineer" }),
  );
  assert.equal(evaluation.status, "reject");
  assert.ok(evaluation.reasons.some((reason) => reason.code === "experience_min_5plus"));
});

test("6. senior/staff/principal titles rejected", () => {
  for (const title of ["Senior Software Engineer", "Staff Engineer", "Principal Data Scientist"]) {
    const evaluation = evaluateEligibility(
      job({ roleTitle: title, experienceMin: null, experienceMax: null }),
    );
    assert.equal(evaluation.status, "reject", `${title} should reject`);
  }
});

test("7. missing experience does not auto-reject", () => {
  const evaluation = evaluateEligibility(job({ experienceMin: null, experienceMax: null }));
  assert.equal(evaluation.status, "eligible");
  assert.ok(evaluation.reasons.some((reason) => reason.code === "experience_unknown"));
});

test("8. 4+ years is borderline, not eligible", () => {
  const evaluation = evaluateEligibility(
    job({ experienceMin: 4, experienceMax: 6, roleTitle: "Software Engineer" }),
  );
  assert.equal(evaluation.status, "borderline");
});

test("9. 2025/2026/2027 grad signals accepted", () => {
  const evaluation = evaluateEligibility(
    job({ batchYears: ["2027"], employmentType: "full_time", roleTitle: "Associate Engineer" }),
  );
  assert.ok(evaluation.reasons.some((reason) => reason.code === "grad_year_match"));
});

test("10. unknown grad year does not reject", () => {
  const evaluation = evaluateEligibility(
    job({ batchYears: [], employmentType: "full_time", roleTitle: "Software Engineer" }),
  );
  assert.equal(evaluation.status, "eligible");
});

// EXPERIENCE NORMALIZATION

test("experience levels map from ranges", () => {
  assert.equal(
    normalizeExperience(
      job({
        experienceMin: 0,
        experienceMax: 1,
        employmentType: "full_time",
        roleTitle: "Engineer",
      }),
    ).level,
    "entry",
  );
  assert.equal(
    normalizeExperience(
      job({
        experienceMin: 1,
        experienceMax: 3,
        employmentType: "full_time",
        roleTitle: "Engineer",
      }),
    ).level,
    "early_career",
  );
  assert.equal(
    normalizeExperience(
      job({
        experienceMin: 0,
        experienceMax: 0,
        employmentType: "full_time",
        roleTitle: "Engineer",
      }),
    ).level,
    "fresher",
  );
  assert.equal(
    normalizeExperience(
      job({
        experienceMin: 5,
        experienceMax: null,
        employmentType: "full_time",
        roleTitle: "Engineer",
      }),
    ).level,
    "senior",
  );
  assert.equal(
    normalizeExperience(
      job({
        experienceMin: null,
        experienceMax: null,
        employmentType: "full_time",
        roleTitle: "Engineer",
      }),
    ).level,
    "unknown",
  );
  assert.equal(
    normalizeExperience(job({ employmentType: "internship", roleTitle: "Engineer" })).level,
    "internship",
  );
});

// RANKING

test("11. better audience fit outranks prestige", () => {
  const fresherStartup = ranked({
    companyName: "Tiny Startup",
    roleTitle: "Graduate Software Engineer",
    experienceMin: 0,
    experienceMax: 1,
    sourceCategory: "startup",
    sourceTrustLevel: 70,
    batchYears: ["2026"],
  });
  const seniorBigTech = ranked({
    companyName: "Big Tech",
    roleTitle: "Software Engineer",
    experienceMin: 3,
    experienceMax: 5,
    sourceCategory: "big_tech",
    sourceTrustLevel: 95,
    batchYears: [],
  });
  assert.ok(fresherStartup.qualityScore > seniorBigTech.qualityScore);
});

test("12. freshness affects rank", () => {
  const fresh = ranked({ postedAt: "2026-10-05T20:00:00.000Z" });
  const stale = ranked({ postedAt: "2026-09-01T00:00:00.000Z" });
  assert.ok(fresh.qualityScore > stale.qualityScore);
});

test("13. India relevance boosts rank", () => {
  const india = ranked({ location: "Hyderabad, India", sourceRegion: "india" });
  const global = ranked({ location: "Berlin, Germany", sourceRegion: "global" });
  assert.ok(india.qualityScore > global.qualityScore);
});

test("14. remote relevance boosts rank", () => {
  const remote = ranked({ workMode: "remote", location: "Remote", sourceRegion: "remote" });
  const onsite = ranked({ workMode: "onsite", location: "Tokyo, Japan", sourceRegion: "global" });
  assert.ok(remote.qualityScore > onsite.qualityScore);
});

test("15. category bonus stays bounded", () => {
  const bigTechWeak = ranked({
    companyName: "Brand",
    roleTitle: "Software Engineer",
    experienceMin: 3,
    experienceMax: 4,
    sourceCategory: "big_tech",
    sourceTrustLevel: 90,
  });
  const startupStrong = ranked({
    companyName: "Fresher Co",
    roleTitle: "Graduate Engineer Trainee",
    experienceMin: 0,
    experienceMax: 1,
    sourceCategory: "startup",
    sourceTrustLevel: 70,
  });
  assert.ok(startupStrong.qualityScore > bigTechWeak.qualityScore);
});

test("16. incomplete data lowers score", () => {
  const complete = ranked({});
  const incomplete = ranked({ skills: [], salaryText: null, batchYears: [], applyUrl: null });
  assert.ok(complete.qualityScore > incomplete.qualityScore);
});

test("17. media-worthiness scoring favors strong early-career roles", () => {
  const mediaWorthy = ranked({
    companyName: "Figma",
    roleTitle: "Data Engineer Intern",
    sourceCategory: "big_tech",
    sourcePriority: "high",
  });
  const weak = ranked({
    companyName: "Unknown Co",
    roleTitle: "Generalist",
    sourceCategory: "general",
    sourcePriority: "low",
    skills: [],
    salaryText: null,
    batchYears: [],
  });
  assert.ok(mediaWorthy.mediaScore > weak.mediaScore);
});

// ANTI-DOMINANCE

test("18. company candidate cap keeps only top 5 per company", () => {
  const config = withSelectionConfig({ maxCandidatesPerCompany: 3 });
  const candidates = [
    ranked({ companyName: "Flood Co", jobPostId: "a1" }),
    ranked({ companyName: "Flood Co", jobPostId: "a2" }),
    ranked({ companyName: "Flood Co", jobPostId: "a3" }),
    ranked({ companyName: "Flood Co", jobPostId: "a4" }),
    ranked({ companyName: "Flood Co", jobPostId: "a5" }),
  ];
  const kept = capCandidates(candidates, config);
  assert.equal(kept.length, 3);
});

test("19. source candidate cap keeps only top 10 per source", () => {
  const config = withSelectionConfig({ maxCandidatesPerSource: 2, maxCandidatesPerCompany: 10 });
  const candidates = [
    ranked({ sourceId: "src-1", jobPostId: "s1" }),
    ranked({ sourceId: "src-1", jobPostId: "s2" }),
    ranked({ sourceId: "src-1", jobPostId: "s3" }),
  ];
  const kept = capCandidates(candidates, config);
  assert.equal(kept.length, 2);
});

test("20. telegram selection allows at most 2 per company", () => {
  const pool = buildCandidatePool(
    Array.from({ length: 6 }, (_, index) =>
      job({ companyName: "Flood Co", jobPostId: `f${index}`, sourceId: "src-flood" }),
    ),
    withSelectionConfig(),
    NOW,
  );
  const telegram = selectTelegram(pool, withSelectionConfig());
  const floodCount = telegram.filter((item) => item.company === "Flood Co").length;
  assert.ok(floodCount <= 2);
});

test("21. media picks never repeat a company", () => {
  const pool = buildCandidatePool(
    [
      job({ companyName: "Same Co", jobPostId: "m1", sourceCategory: "big_tech" }),
      job({ companyName: "Same Co", jobPostId: "m2", sourceCategory: "big_tech" }),
      job({ companyName: "Other Co", jobPostId: "m3" }),
    ],
    withSelectionConfig(),
    NOW,
  );
  const media = selectMedia(pool, withSelectionConfig());
  const companies = media.map((item) => item.company);
  assert.equal(new Set(companies).size, companies.length);
});

test("22. a huge source cannot flood the top results", () => {
  const floodJobs = Array.from({ length: 40 }, (_, index) =>
    job({
      companyName: `Bosch-like ${index % 3}`,
      jobPostId: `flood-${index}`,
      sourceId: "source-bosch",
      sourceCategory: "mass_hiring",
      roleTitle: `Graduate Engineer Trainee ${index}`,
      experienceMin: 0,
      experienceMax: 1,
    }),
  );
  const pool = buildCandidatePool(floodJobs, withSelectionConfig(), NOW);
  const sourceCounts = new Map<string, number>();
  for (const candidate of pool) {
    const key = candidate.job.sourceId ?? "?";
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
  }
  assert.ok((sourceCounts.get("source-bosch") ?? 0) <= 10);
});

// DIVERSITY

test("23. telegram selection follows category slots", () => {
  const jobs = [
    ...Array.from({ length: 4 }, (_, i) =>
      job({
        companyName: `Mass ${i}`,
        jobPostId: `mass-${i}`,
        sourceId: `mass-src-${i}`,
        sourceCategory: "mass_hiring",
        roleTitle: `Graduate Engineer Trainee ${i}`,
        experienceMin: 0,
        experienceMax: 1,
      }),
    ),
    ...Array.from({ length: 3 }, (_, i) =>
      job({
        companyName: `Tech ${i}`,
        jobPostId: `tech-${i}`,
        sourceId: `tech-src-${i}`,
        sourceCategory: "big_tech",
      }),
    ),
    ...Array.from({ length: 3 }, (_, i) =>
      job({
        companyName: `Start ${i}`,
        jobPostId: `start-${i}`,
        sourceId: `start-src-${i}`,
        sourceCategory: "startup",
      }),
    ),
    ...Array.from({ length: 3 }, (_, i) =>
      job({
        companyName: `Remote ${i}`,
        jobPostId: `rem-${i}`,
        sourceId: `rem-src-${i}`,
        sourceCategory: "remote",
        workMode: "remote",
        location: "Remote",
        sourceRegion: "remote",
      }),
    ),
  ];
  const result = runSelection(jobs, {}, NOW);
  const categories = result.telegram.map((item) => item.category);
  assert.ok(categories.filter((category) => category === "mass_hiring").length >= 2);
  assert.ok(categories.includes("big_tech"));
  assert.ok(categories.includes("startup") || categories.includes("yc"));
  assert.ok(categories.includes("remote"));
  assert.ok(result.telegram.length <= 10);
});

test("24. missing categories are backfilled with highest remaining", () => {
  const jobs = Array.from({ length: 12 }, (_, index) =>
    job({
      companyName: `Only Startup ${index}`,
      jobPostId: `os-${index}`,
      sourceId: `os-src-${index}`,
      sourceCategory: "startup",
    }),
  );
  const result = runSelection(jobs, {}, NOW);
  assert.equal(result.telegram.length, 10);
  assert.ok(result.telegram.some((item) => item.selectionReason.startsWith("backfill")));
});

test("25. low-quality jobs are not forced into quota slots", () => {
  const jobs = [
    job({
      companyName: "Weak Mass",
      jobPostId: "wm-1",
      sourceId: "wm-src",
      sourceCategory: "mass_hiring",
      experienceMin: 6,
      experienceMax: null,
    }),
    ...Array.from({ length: 6 }, (_, index) =>
      job({
        companyName: `Startup ${index}`,
        jobPostId: `st-${index}`,
        sourceId: `st-src-${index}`,
      }),
    ),
  ];
  const result = runSelection(jobs, {}, NOW);
  assert.ok(!result.telegram.some((item) => item.jobPostId === "wm-1"));
});

test("26. wildcard slot is used when available", () => {
  const jobs = [
    ...Array.from({ length: 3 }, (_, i) =>
      job({
        companyName: `Mass ${i}`,
        jobPostId: `w-mass-${i}`,
        sourceId: `wm-src-${i}`,
        sourceCategory: "mass_hiring",
        roleTitle: `Trainee ${i}`,
        experienceMin: 0,
        experienceMax: 1,
      }),
    ),
    job({ companyName: "Wild", jobPostId: "w-wild", sourceId: "w-src", sourceCategory: "general" }),
  ];
  const result = runSelection(jobs, {}, NOW);
  assert.ok(
    result.telegram.some(
      (item) => item.selectionReason.includes("wildcard") || item.jobPostId === "w-wild",
    ),
  );
});

// DEDUPING

test("27. direct ATS source beats aggregator for the same job", () => {
  const direct = ranked({
    jobPostId: "direct-1",
    sourcePlatform: "greenhouse",
    applyUrl: "https://jobs.example.com/role-1",
    sourceTrustLevel: 80,
  });
  const aggregator = ranked({
    jobPostId: "agg-1",
    sourcePlatform: "rss",
    applyUrl: "https://jobs.example.com/role-1?utm_source=rss",
    sourceTrustLevel: 60,
  });
  const deduped = dedupeCandidates([aggregator, direct]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0]?.job.jobPostId, "direct-1");
});

test("28. duplicate application urls are rejected", () => {
  const a = ranked({ jobPostId: "dup-a", applyUrl: "https://x.example.com/jobs/1" });
  const b = ranked({ jobPostId: "dup-b", applyUrl: "https://x.example.com/jobs/1#apply" });
  assert.equal(dedupeCandidates([a, b]).length, 1);
});

test("29. same company and title near-duplicates collapse", () => {
  const a = ranked({
    jobPostId: "near-a",
    companyName: "Acme",
    roleTitle: "Software Engineer",
    applyUrl: null,
  });
  const b = ranked({
    jobPostId: "near-b",
    companyName: "ACME",
    roleTitle: "software engineer",
    applyUrl: null,
  });
  assert.equal(dedupeCandidates([a, b]).length, 1);
});

test("30. recently published jobs are excluded from selection", () => {
  const published = job({ jobPostId: "pub-1", recentlyPublished: true });
  const fresh = job({ jobPostId: "fresh-1", companyName: "Other" });
  const pool = buildCandidatePool([published, fresh], withSelectionConfig(), NOW);
  assert.ok(!pool.some((candidate) => candidate.job.jobPostId === "pub-1"));
});

// MEDIA

test("31. media selection returns at most 2 jobs", () => {
  const jobs = Array.from({ length: 6 }, (_, index) =>
    job({
      companyName: `Media ${index}`,
      jobPostId: `media-${index}`,
      sourceId: `media-src-${index}`,
    }),
  );
  const result = runSelection(jobs, {}, NOW);
  assert.ok(result.media.length <= 2);
  assert.equal(result.media[0]?.rank, 1);
});

test("32. zero and one candidate pools are handled cleanly", () => {
  assert.deepEqual(runSelection([], {}, NOW).media, []);
  assert.equal(runSelection([job()], {}, NOW).media.length, 1);
});

test("33. mass-hiring broad fresher role can beat a famous senior role", () => {
  const broadMass = ranked({
    companyName: "Bosch",
    roleTitle: "Graduate Engineer Trainee",
    sourceCategory: "mass_hiring",
    experienceMin: 0,
    experienceMax: 1,
    batchYears: ["2026"],
  });
  const famousSenior = ranked({
    companyName: "Famous Big Tech",
    roleTitle: "Senior Software Engineer",
    sourceCategory: "big_tech",
    sourceTrustLevel: 95,
    experienceMin: 7,
    experienceMax: null,
  });
  assert.equal(famousSenior.eligibility.status, "reject");
  assert.ok(broadMass.qualityScore > famousSenior.qualityScore);
});

test("34. strong YC/startup role can beat weak big-tech role", () => {
  const ycRole = ranked({
    companyName: "Supabase",
    roleTitle: "Graduate Software Engineer",
    sourceCategory: "yc",
    experienceMin: 0,
    experienceMax: 1,
    batchYears: ["2026"],
  });
  const weakBigTech = ranked({
    companyName: "Weak Big Tech",
    roleTitle: "Software Engineer",
    sourceCategory: "big_tech",
    experienceMin: 3,
    experienceMax: 4,
    batchYears: [],
    salaryText: null,
  });
  assert.ok(ycRole.qualityScore > weakBigTech.qualityScore);
});

// REPLAY

test("35. selection is deterministic for the same pool", () => {
  const jobs = Array.from({ length: 20 }, (_, index) =>
    job({
      companyName: `Co ${index % 5}`,
      jobPostId: `det-${index}`,
      sourceId: `src-${index % 7}`,
      sourceCategory: index % 2 === 0 ? "startup" : "mass_hiring",
    }),
  );
  const first = runSelection(jobs, {}, NOW);
  const second = runSelection([...jobs].reverse(), {}, NOW);
  assert.deepEqual(
    first.telegram.map((item) => item.jobPostId),
    second.telegram.map((item) => item.jobPostId),
  );
  assert.deepEqual(
    first.media.map((item) => item.jobPostId),
    second.media.map((item) => item.jobPostId),
  );
});

test("36. no random ordering drift across repeated runs", () => {
  const jobs = Array.from({ length: 10 }, (_, index) =>
    job({ jobPostId: `drift-${index}`, companyName: `Drift ${index}` }),
  );
  const runs = Array.from({ length: 5 }, () => runSelection(jobs, {}, NOW));
  for (const run of runs.slice(1)) {
    assert.deepEqual(
      run.telegram.map((item) => item.jobPostId),
      runs[0]?.telegram.map((item) => item.jobPostId),
    );
  }
});

// PRODUCTION VALIDATION REGRESSIONS (first production funnel run)

test("37. non-English posting titles are penalized below equivalent English roles", () => {
  const german = ranked({
    companyName: "Bosch Group",
    roleTitle: "Praktikum im Bereich agentische KI für die automatisierte Codegenerierung",
    sourceCategory: "mass_hiring",
    employmentType: "internship",
  });
  const english = ranked({
    companyName: "Bosch Group",
    roleTitle: "Internship Agentic AI for Automated Code Generation",
    sourceCategory: "mass_hiring",
    employmentType: "internship",
  });
  assert.ok(english.qualityScore > german.qualityScore);
  assert.ok(english.mediaScore > german.mediaScore);
  assert.ok(german.scoreBreakdown.some((entry) => entry.dimension === "language_penalty"));
});

test("38. category slots prefer distinct companies before repeating one", () => {
  const jobs = [
    job({
      companyName: "Bosch Group",
      jobPostId: "b1",
      sourceId: "src-bosch",
      sourceCategory: "mass_hiring",
      roleTitle: "Graduate Engineer Trainee A",
      experienceMin: 0,
      experienceMax: 1,
    }),
    job({
      companyName: "Bosch Group",
      jobPostId: "b2",
      sourceId: "src-bosch",
      sourceCategory: "mass_hiring",
      roleTitle: "Graduate Engineer Trainee B",
      experienceMin: 0,
      experienceMax: 1,
    }),
    job({
      companyName: "Intel",
      jobPostId: "i1",
      sourceId: "src-intel",
      sourceCategory: "mass_hiring",
      roleTitle: "Graduate Software Engineer",
      experienceMin: 0,
      experienceMax: 1,
    }),
    job({
      companyName: "Endava",
      jobPostId: "e1",
      sourceId: "src-endava",
      sourceCategory: "mass_hiring",
      roleTitle: "Junior Software Engineer",
      experienceMin: 0,
      experienceMax: 1,
    }),
  ];
  const result = runSelection(jobs, {}, NOW);
  const massPicks = result.telegram.filter((item) => item.selectionReason === "slot:mass_hiring");
  const companies = massPicks.map((item) => item.company);
  assert.equal(
    new Set(companies).size,
    companies.length,
    "first slot pass must use distinct companies",
  );
  assert.ok(massPicks.length >= 2);
});

test("39. high-school internships do not outrank university-grad internships", () => {
  const highSchool = ranked({
    companyName: "Stripe",
    roleTitle: "High School Internship, Software Engineering",
    employmentType: "internship",
    batchYears: [],
  });
  const university = ranked({
    companyName: "Pinterest",
    roleTitle: "University Grad Software Engineer 2027",
    employmentType: "full_time",
    experienceMin: 0,
    experienceMax: 1,
    batchYears: ["2027"],
  });
  assert.ok(university.qualityScore > highSchool.qualityScore);
});
