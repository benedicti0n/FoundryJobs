export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export function getApiBaseUrl(): string | null {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl || baseUrl.trim().length === 0) {
    return null;
  }
  return baseUrl.replace(/\/+$/, "");
}

type ApiErrorPayload = {
  error?: {
    message?: string;
  };
};

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new ApiError("API_BASE_URL is not configured");
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { cache: "no-store", ...init });
  } catch {
    throw new ApiError("Could not reach the FoundryJobs API");
  }

  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message ?? `The API responded with status ${response.status}`,
    );
  }
  return payload;
}

export type ApprovalDecision = "approved" | "rejected" | "needs_edit";

export type ApprovalRequestInput = {
  decision: ApprovalDecision;
  decidedBy?: string;
  notes?: string;
  textContent?: string;
};

export async function updateGeneratedPostText(
  generatedPostId: string,
  textContent: string,
): Promise<void> {
  await request(`/v1/generated-posts/${generatedPostId}/text`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ textContent }),
  });
}

export async function submitApproval(
  generatedPostId: string,
  input: ApprovalRequestInput,
): Promise<void> {
  await request(`/v1/generated-posts/${generatedPostId}/approval`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type PublishChannel = "telegram" | "buffer";

export type PublishResultData = {
  status: "published" | "skipped" | "failed";
  externalPostId?: string | null;
  publishedUrl?: string | null;
  errorMessage?: string | null;
};

export async function publishGeneratedPost(
  generatedPostId: string,
  channel: PublishChannel,
): Promise<PublishResultData> {
  const payload = (await request(`/v1/generated-posts/${generatedPostId}/publish/${channel}`, {
    method: "POST",
  })) as { data?: PublishResultData } | null;

  if (!payload?.data) {
    throw new ApiError("The API returned an unexpected publish response");
  }
  return payload.data;
}
