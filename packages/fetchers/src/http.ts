const USER_AGENT = "FoundryJobsBot/0.1 (+https://foundryjobs.local)";
const DEFAULT_TIMEOUT_MS = 15_000;

export async function fetchJson<T>(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Request to ${url} failed with status ${response.status} ${response.statusText}`,
      );
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new Error(`Response from ${url} was not valid JSON`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
