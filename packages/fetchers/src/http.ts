const USER_AGENT = "FoundryJobsBot/0.1 (+https://foundryjobs.local)";
const DEFAULT_TIMEOUT_MS = 15_000;

async function request(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        "user-agent": USER_AGENT,
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Request to ${url} failed with status ${response.status} ${response.statusText}`,
      );
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchJson<T>(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const response = await request(url, { headers: { accept: "application/json" } }, timeoutMs);

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`Response from ${url} was not valid JSON`);
  }
}

export async function postJson<T>(
  url: string,
  body: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const response = await request(
    url,
    {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`Response from ${url} was not valid JSON`);
  }
}

export async function fetchText(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  const response = await request(
    url,
    { headers: { accept: "application/rss+xml, application/atom+xml, text/xml, */*" } },
    timeoutMs,
  );
  return response.text();
}
