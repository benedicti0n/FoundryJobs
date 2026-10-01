import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

export const LOCAL_IMAGE_URL_PREFIX = "/generated/instagram-cards/";
const DEFAULT_OUTPUT_DIR = "apps/web/public/generated/instagram-cards";

function findRepoRoot(startDir: string): string {
  let current = resolve(startDir);
  for (let depth = 0; depth < 12; depth += 1) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return resolve(startDir);
}

export function resolveLocalCardDir(): string {
  const configured = process.env.INSTAGRAM_CARD_OUTPUT_DIR;
  if (configured && configured.trim().length > 0) {
    return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  }
  return join(findRepoRoot(process.cwd()), DEFAULT_OUTPUT_DIR);
}

export function isLocalCardImageUrl(imageUrl: string | null | undefined): boolean {
  return typeof imageUrl === "string" && imageUrl.startsWith(LOCAL_IMAGE_URL_PREFIX);
}

export function resolveLocalCardFilePath(imageUrl: string): string | null {
  if (!isLocalCardImageUrl(imageUrl)) {
    return null;
  }

  const fileName = imageUrl.slice(LOCAL_IMAGE_URL_PREFIX.length);
  if (fileName.length === 0 || fileName.includes("/") || fileName.includes("..")) {
    return null;
  }

  return join(resolveLocalCardDir(), fileName);
}
