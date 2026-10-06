const GENERIC_KEYWORDS = new Set([
  "LINK",
  "FREE",
  "GUIDE",
  "JOBS",
  "JOB",
  "HIRING",
  "APPLY",
  "INFO",
  "NEWS",
  "WORK",
  "CAREER",
  "CAREERS",
]);

const ROLE_STOP_WORDS = new Set([
  "intern",
  "internship",
  "senior",
  "junior",
  "the",
  "and",
  "of",
  "for",
  "a",
  "an",
  "at",
]);

function compact(value: string, maxLength: number): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, maxLength);
}

export type InstagramTriggerKeyword = {
  display: string;
  normalized: string;
};

export function generateInstagramTriggerKeyword(
  companyName: string | null,
  roleTitle: string | null,
  taken: ReadonlySet<string>,
): InstagramTriggerKeyword {
  const takenLower = new Set([...taken].map((keyword) => keyword.toLowerCase()));
  const company = compact(companyName ?? "", 12);
  const roleWords = (roleTitle ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const roleShorthand = roleWords
    .filter((word) => !ROLE_STOP_WORDS.has(word.toLowerCase()))
    .slice(0, 2)
    .join("")
    .slice(0, 6);

  let base =
    company.length > 0 && !GENERIC_KEYWORDS.has(company)
      ? company
      : compact(roleWords[0] ?? "", 10);
  if (base.length === 0 || GENERIC_KEYWORDS.has(base)) {
    base = "FJOB";
  }

  let display = base;
  if (takenLower.has(display.toLowerCase())) {
    const withRole = base + roleShorthand;
    if (roleShorthand.length > 0 && !takenLower.has(withRole.toLowerCase())) {
      display = withRole;
    } else {
      let suffix = 2;
      while (takenLower.has(`${base}${suffix}`.toLowerCase()) && suffix < 100) {
        suffix += 1;
      }
      display = `${base}${suffix}`;
    }
  }

  return { display, normalized: display.toLowerCase() };
}
