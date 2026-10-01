import { and, asc, eq, inArray, isNotNull, like } from "drizzle-orm";
import {
  isEnvSet,
  isUuid,
  type GeneratedPostPlatform,
  type GeneratedPostStatus,
  type UploadableInstagramCardDto,
} from "@foundryjobs/shared";
import { getDatabase, type Database } from "../client";
import { DatabaseNotConfiguredError } from "../errors";
import { generatedPosts, jobPosts } from "../schema";

const UPLOAD_LIST_DEFAULT_LIMIT = 10;
const UPLOAD_LIST_MAX_LIMIT = 200;
const LOCAL_IMAGE_URL_PREFIX = "/generated/instagram-cards/";
const UPLOAD_DATABASE_ERROR =
  "DATABASE_URL is required for Instagram card upload repository operations";

function requireDatabase(): Database {
  if (!isEnvSet("DATABASE_URL")) {
    throw new DatabaseNotConfiguredError(UPLOAD_DATABASE_ERROR);
  }
  return getDatabase();
}

type UploadableRow = {
  generatedPostId: string;
  jobPostId: string;
  platform: string;
  status: string;
  imageUrl: string | null;
  companyName: string | null;
  roleTitle: string;
};

function toUploadableDto(row: UploadableRow): UploadableInstagramCardDto {
  return {
    generatedPostId: row.generatedPostId,
    jobPostId: row.jobPostId,
    platform: row.platform as GeneratedPostPlatform,
    status: row.status as GeneratedPostStatus,
    localImageUrl: row.imageUrl ?? "",
    companyName: row.companyName,
    roleTitle: row.roleTitle,
  };
}

function buildUploadableSelection(database: Database) {
  return database
    .select({
      generatedPostId: generatedPosts.id,
      jobPostId: generatedPosts.jobPostId,
      platform: generatedPosts.platform,
      status: generatedPosts.status,
      imageUrl: generatedPosts.imageUrl,
      companyName: jobPosts.companyName,
      roleTitle: jobPosts.roleTitle,
    })
    .from(generatedPosts)
    .innerJoin(jobPosts, eq(generatedPosts.jobPostId, jobPosts.id));
}

export async function listInstagramCardsNeedingUpload(
  limit = UPLOAD_LIST_DEFAULT_LIMIT,
): Promise<UploadableInstagramCardDto[]> {
  const database = requireDatabase();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), UPLOAD_LIST_MAX_LIMIT);

  const rows = await buildUploadableSelection(database)
    .where(
      and(
        eq(generatedPosts.platform, "instagram"),
        isNotNull(generatedPosts.imageUrl),
        like(generatedPosts.imageUrl, `${LOCAL_IMAGE_URL_PREFIX}%`),
        inArray(generatedPosts.status, ["draft", "approved"]),
      ),
    )
    .orderBy(asc(generatedPosts.createdAt), asc(generatedPosts.id))
    .limit(safeLimit);

  return rows.map(toUploadableDto);
}

export async function getUploadableInstagramCard(
  generatedPostId: string,
): Promise<UploadableInstagramCardDto | null> {
  const database = requireDatabase();
  if (!isUuid(generatedPostId)) {
    return null;
  }

  const [row] = await buildUploadableSelection(database)
    .where(eq(generatedPosts.id, generatedPostId))
    .limit(1);

  return row ? toUploadableDto(row) : null;
}
