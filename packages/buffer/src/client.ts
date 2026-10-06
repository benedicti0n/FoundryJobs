import { getEnv } from "@foundryjobs/shared";
import type { BufferPlatform } from "@foundryjobs/shared";
import { BUFFER_CONFIG_ERROR, getBufferProfileId } from "./profile-config";

const BUFFER_GRAPHQL_URL = "https://api.buffer.com";
const REQUEST_TIMEOUT_MS = 30_000;

export type BufferUpdateOutcome = {
  externalPostId: string | null;
  publishedUrl: string | null;
  status: string | null;
};

const CREATE_POST_MUTATION = `
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    __typename
    ... on PostActionSuccess {
      post {
        id
        status
        channelService
        externalLink
      }
    }
    ... on NotFoundError { message }
    ... on UnauthorizedError { message }
    ... on UnexpectedError { message }
    ... on RestProxyError { message }
    ... on LimitReachedError { message }
    ... on InvalidInputError { message }
  }
}
`;

type CreatePostPayload = {
  __typename?: string;
  message?: string | null;
  post?: {
    id?: string;
    status?: string;
    channelService?: string;
    externalLink?: string | null;
  } | null;
};

type BufferGraphQlResponse = {
  data?: { createPost?: CreatePostPayload | null } | null;
  errors?: Array<{ message?: string }>;
};

const ERROR_MESSAGE_LIMIT = 260;

function truncateMiddle(message: string, limit = ERROR_MESSAGE_LIMIT): string {
  if (message.length <= limit) {
    return message;
  }
  const tailLength = Math.floor(limit / 2);
  const headLength = limit - tailLength - 1;
  return `${message.slice(0, headLength)}…${message.slice(message.length - tailLength)}`;
}

function sanitizeMessage(message: string): string {
  const redacted = message
    .replace(/access_token=[^&\s]*/gi, "access_token=[redacted]")
    .replace(/([?&][A-Za-z0-9_%-]+=[^&\s]*)/g, "");
  return truncateMiddle(redacted);
}

export async function createBufferUpdate(
  platform: BufferPlatform,
  text: string,
  imageUrl?: string,
): Promise<BufferUpdateOutcome> {
  const accessToken = getEnv("BUFFER_ACCESS_TOKEN");
  const channelId = getBufferProfileId(platform);
  if (!accessToken) {
    throw new Error(BUFFER_CONFIG_ERROR);
  }

  const input: Record<string, unknown> = {
    channelId,
    text,
    mode: "shareNow",
    schedulingType: "automatic",
    needsApproval: false,
    assets: imageUrl ? [{ image: { url: imageUrl } }] : [],
    ...(platform === "instagram"
      ? { metadata: { instagram: { type: "post", shouldShareToFeed: true } } }
      : {}),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(BUFFER_GRAPHQL_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: CREATE_POST_MUTATION,
        variables: { input },
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as BufferGraphQlResponse | null;

    if (!response.ok) {
      throw new Error(`Buffer request failed with status ${response.status}`);
    }

    if (payload?.errors && payload.errors.length > 0) {
      const detail = payload.errors.map((entry) => entry.message ?? "unknown error").join("; ");
      throw new Error(`Buffer publish failed: ${sanitizeMessage(detail)}`);
    }

    const result = payload?.data?.createPost;
    if (!result) {
      throw new Error("Buffer publish failed: empty response from Buffer GraphQL API");
    }

    if (result.__typename !== "PostActionSuccess" || !result.post) {
      const detail = result.message ?? result.__typename ?? "unknown error";
      throw new Error(`Buffer publish failed: ${sanitizeMessage(detail)}`);
    }

    return {
      externalPostId: result.post.id ?? null,
      publishedUrl: result.post.externalLink ?? null,
      status: result.post.status ?? null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Buffer request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
