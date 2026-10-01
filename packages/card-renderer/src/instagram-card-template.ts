import type { InstagramCardViewModel } from "./format-card-data";

export const INSTAGRAM_CARD_SIZE = 1080;

const ACCENT = "#A3E635";
const ACCENT_INK = "#1A2E05";
const INK = "#0F172A";
const BODY = "#334155";
const MUTED = "#64748B";
const DIVIDER = "#E2E8F0";
const FONT_STACK = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";

const CARD_MARGIN = 48;
const CARD_PADDING = 60;
const LINE_START = CARD_MARGIN + CARD_PADDING;
const LINE_END = INSTAGRAM_CARD_SIZE - CARD_MARGIN - CARD_PADDING;
const CONTENT_WIDTH = LINE_END - LINE_START;

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const lines: string[] = [];
  let current = "";
  let index = 0;

  while (index < words.length) {
    const word = words[index] ?? "";
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length <= maxChars) {
      current = candidate;
      index += 1;
      continue;
    }
    if (current.length > 0) {
      lines.push(current);
      current = "";
      if (lines.length === maxLines) {
        break;
      }
      continue;
    }
    lines.push(word.slice(0, maxChars));
    index += 1;
    if (lines.length === maxLines) {
      break;
    }
  }

  if (index >= words.length) {
    if (current.length > 0 && lines.length < maxLines) {
      lines.push(current);
    }
    return lines;
  }

  if (lines.length > 0) {
    const lastIndex = lines.length - 1;
    const last = lines[lastIndex] ?? "";
    lines[lastIndex] = `${last.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
  }
  return lines;
}

function truncate(value: string, maxChars: number): string {
  return value.length > maxChars ? `${value.slice(0, maxChars - 1).trimEnd()}…` : value;
}

function fitFontSize(title: string): number {
  if (title.length <= 24) {
    return 68;
  }
  if (title.length <= 34) {
    return 56;
  }
  return 46;
}

function badgePill(view: InstagramCardViewModel): string {
  const text = view.badge;
  const width = Math.round(text.length * 14.5) + 56;
  const height = 48;
  const x = LINE_END - width;
  const y = 122;
  const centerX = x + width / 2;
  const baseline = y + height / 2 + 8;
  return [
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="${ACCENT}" />`,
    `<text x="${centerX}" y="${baseline}" text-anchor="middle" font-family="${FONT_STACK}" font-size="24" font-weight="700" fill="${ACCENT_INK}">${escapeXml(text)}</text>`,
  ].join("\n  ");
}

function detailRows(view: InstagramCardViewModel): string {
  const rows: Array<{ label: string; value: string }> = [
    { label: "Experience", value: view.experience },
    { label: "Location", value: view.location },
  ];
  if (view.workMode) {
    rows.push({ label: "Work mode", value: view.workMode });
  }
  if (view.skills) {
    rows.push({ label: "Skills", value: view.skills });
  }

  const parts: string[] = [];
  rows.forEach((row, index) => {
    const labelY = 640 + index * 66;
    const valueY = labelY + 38;
    parts.push(
      `<text x="${LINE_START}" y="${labelY}" font-family="${FONT_STACK}" font-size="20" font-weight="600" letter-spacing="2" fill="${MUTED}">${escapeXml(row.label.toUpperCase())}</text>`,
    );
    parts.push(
      `<text x="${LINE_START}" y="${valueY}" font-family="${FONT_STACK}" font-size="28" font-weight="600" fill="${INK}">${escapeXml(truncate(row.value, 46))}</text>`,
    );
  });
  return parts.join("\n  ");
}

export function buildInstagramCardSvg(view: InstagramCardViewModel): string {
  const titleFontSize = fitFontSize(view.roleTitle);
  const titleMaxChars = Math.floor(CONTENT_WIDTH / (titleFontSize * 0.56));
  const titleLines = wrapText(view.roleTitle, titleMaxChars, 3);
  const titleLineHeight = Math.round(titleFontSize * 1.16);
  const titleTop = 320;

  const titleSvg = titleLines
    .map(
      (line, index) =>
        `<text x="${LINE_START}" y="${titleTop + index * titleLineHeight}" font-family="${FONT_STACK}" font-size="${titleFontSize}" font-weight="800" fill="${INK}">${escapeXml(line)}</text>`,
    )
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${INSTAGRAM_CARD_SIZE}" height="${INSTAGRAM_CARD_SIZE}" viewBox="0 0 ${INSTAGRAM_CARD_SIZE} ${INSTAGRAM_CARD_SIZE}">
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F7FEE7" />
      <stop offset="55%" stop-color="#ECFCCB" />
      <stop offset="100%" stop-color="#E0F2FE" />
    </linearGradient>
    <filter id="softBlur" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="90" />
    </filter>
  </defs>
  <rect width="${INSTAGRAM_CARD_SIZE}" height="${INSTAGRAM_CARD_SIZE}" fill="url(#background)" />
  <circle cx="190" cy="210" r="250" fill="${ACCENT}" opacity="0.45" filter="url(#softBlur)" />
  <circle cx="910" cy="880" r="270" fill="#7DD3FC" opacity="0.4" filter="url(#softBlur)" />
  <circle cx="880" cy="150" r="200" fill="#FDE68A" opacity="0.35" filter="url(#softBlur)" />
  <rect x="${CARD_MARGIN}" y="${CARD_MARGIN}" width="${INSTAGRAM_CARD_SIZE - CARD_MARGIN * 2}" height="${INSTAGRAM_CARD_SIZE - CARD_MARGIN * 2}" rx="56" fill="#FFFFFF" fill-opacity="0.86" stroke="${INK}" stroke-opacity="0.06" stroke-width="2" />
  <rect x="${LINE_START}" y="120" width="64" height="64" rx="18" fill="${ACCENT}" />
  <text x="${LINE_START + 32}" y="164" text-anchor="middle" font-family="${FONT_STACK}" font-size="30" font-weight="800" fill="${ACCENT_INK}">FJ</text>
  <text x="${LINE_START + 84}" y="166" font-family="${FONT_STACK}" font-size="36" font-weight="800" fill="${INK}">${escapeXml(view.brandName)}</text>
  ${badgePill(view)}
  ${titleSvg}
  <text x="${LINE_START}" y="540" font-family="${FONT_STACK}" font-size="36" font-weight="600" fill="${BODY}">${escapeXml(truncate(view.companyName, 50))}</text>
  <line x1="${LINE_START}" y1="584" x2="${LINE_END}" y2="584" stroke="${DIVIDER}" stroke-width="2" />
  ${detailRows(view)}
  <rect x="${LINE_START}" y="892" width="330" height="80" rx="40" fill="${INK}" />
  <text x="${LINE_START + 165}" y="942" text-anchor="middle" font-family="${FONT_STACK}" font-size="28" font-weight="700" fill="${ACCENT}">${escapeXml(view.cta)}</text>
  <text x="${LINE_END}" y="940" text-anchor="end" font-family="${FONT_STACK}" font-size="20" font-weight="500" fill="${MUTED}">${escapeXml(view.footer)}</text>
</svg>`;
}
