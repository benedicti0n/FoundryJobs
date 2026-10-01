import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import sharp from "sharp";
import {
  getRenderableInstagramPost,
  updateGeneratedPostImageUrl,
  type RenderableInstagramPost,
} from "@foundryjobs/db";
import type { InstagramCardRenderResult, RenderableInstagramPostDto } from "@foundryjobs/shared";
import { formatCardData } from "./format-card-data";
import { buildInstagramCardSvg } from "./instagram-card-template";

export const INSTAGRAM_CARD_ROUTE_PREFIX = "/generated/instagram-cards";
const DEFAULT_OUTPUT_DIR = "apps/web/public/generated/instagram-cards";

export type RenderInstagramCardOptions = {
  regenerate?: boolean;
};

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

export function resolveInstagramCardOutputDir(): string {
  const configured = process.env.INSTAGRAM_CARD_OUTPUT_DIR;
  if (configured && configured.trim().length > 0) {
    return isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  }
  return join(findRepoRoot(process.cwd()), DEFAULT_OUTPUT_DIR);
}

export function instagramCardFileName(generatedPostId: string): string {
  return `instagram-card-${generatedPostId}.png`;
}

export async function renderInstagramCardFromData(
  post: RenderableInstagramPostDto,
): Promise<string> {
  const view = formatCardData(post);
  const svg = buildInstagramCardSvg(view);
  const outputDir = resolveInstagramCardOutputDir();
  await mkdir(outputDir, { recursive: true });

  const fileName = instagramCardFileName(post.generatedPostId);
  const png = await sharp(Buffer.from(svg, "utf8")).png().toBuffer();
  await writeFile(join(outputDir, fileName), png);

  return `${INSTAGRAM_CARD_ROUTE_PREFIX}/${fileName}`;
}

export async function renderInstagramCard(
  generatedPostId: string,
  options: RenderInstagramCardOptions = {},
): Promise<InstagramCardRenderResult> {
  try {
    const post: RenderableInstagramPost | null = await getRenderableInstagramPost(generatedPostId);
    if (!post) {
      return {
        generatedPostId,
        jobPostId: null,
        status: "error",
        errorMessage: "Generated post not found",
      };
    }

    if (post.platform !== "instagram") {
      return {
        generatedPostId: post.generatedPostId,
        jobPostId: post.jobPostId,
        status: "skipped",
        imageUrl: post.imageUrl,
        errorMessage: `Platform ${post.platform} is not supported by the Instagram card renderer`,
      };
    }

    if (post.generatedPostStatus !== "draft" && post.generatedPostStatus !== "approved") {
      return {
        generatedPostId: post.generatedPostId,
        jobPostId: post.jobPostId,
        status: "skipped",
        imageUrl: post.imageUrl,
        errorMessage: `Generated post status is ${post.generatedPostStatus}; only draft or approved posts are rendered`,
      };
    }

    if (post.imageUrl && !options.regenerate) {
      return {
        generatedPostId: post.generatedPostId,
        jobPostId: post.jobPostId,
        status: "skipped",
        imageUrl: post.imageUrl,
        errorMessage: "Image already exists for this generated post",
      };
    }

    const imageUrl = await renderInstagramCardFromData(post);
    const updated = await updateGeneratedPostImageUrl(post.generatedPostId, imageUrl);
    if (!updated) {
      return {
        generatedPostId: post.generatedPostId,
        jobPostId: post.jobPostId,
        status: "error",
        errorMessage: "Failed to update the generated post image",
      };
    }

    return {
      generatedPostId: post.generatedPostId,
      jobPostId: post.jobPostId,
      status: "rendered",
      imageUrl,
    };
  } catch (error) {
    return {
      generatedPostId,
      jobPostId: null,
      status: "error",
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}
