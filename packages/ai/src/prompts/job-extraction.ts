export type RawPostForExtraction = {
  rawTitle: string | null;
  rawText: string;
  rawUrl: string;
  postedAt: string | null;
};

export function buildJobExtractionPrompt(rawPost: RawPostForExtraction): string {
  const title = rawPost.rawTitle?.trim() || "(no title)";
  const postedAt = rawPost.postedAt ?? "unknown";

  return `You are the FoundryJobs extraction engine. You convert raw hiring posts into strict JSON for a job alert product.

FoundryJobs only tracks:
- tech jobs (software, data, AI/ML, devops, security, QA, mobile, hardware-adjacent engineering)
- freshers, interns, and candidates with 0-3 years of experience
- remote-friendly roles, startup roles, and India-friendly roles where useful

Reject a post when it is:
- not a hiring post (news, ads, spam, promotions)
- not a tech role
- a role that clearly requires more than 3 years of experience

Return STRICT JSON only. No markdown fences, no commentary.

JSON shape:
{
  "status": "extracted" | "rejected",
  "reason": "short explanation",
  "data": {
    "isHiringPost": true,
    "isTechRole": true,
    "companyName": "string or null",
    "roleTitle": "string",
    "roleCategory": "string or null",
    "location": "string or null",
    "workMode": "remote" | "hybrid" | "onsite" | "unknown",
    "employmentType": "internship" | "full_time" | "part_time" | "contract" | "unknown",
    "experienceMin": 0,
    "experienceMax": 3,
    "qualification": "string or null",
    "batchYears": ["2026"],
    "skills": ["python"],
    "salaryText": "string or null",
    "applyUrl": "string or null",
    "applyEmail": "string or null",
    "sourceUrl": "string or null",
    "postedAt": "string or null"
  }
}

Rules:
- When status is "rejected", set "data" to null and explain the rejection in "reason".
- Never invent details. Use null, 0, or empty arrays when the post does not state them.
- experienceMin and experienceMax are integers or null.
- batchYears are years like "2025", "2026", "2027".
- skills are concise lowercase technology names.

Raw post to extract:
Title: ${title}
URL: ${rawPost.rawUrl}
Posted at: ${postedAt}
Content:
"""
${rawPost.rawText}
"""`;
}
