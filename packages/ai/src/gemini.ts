import { getEnv, requireEnv } from "@foundryjobs/shared";

const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUEST_TIMEOUT_MS = 30_000;

export type GeminiStructuredResponse = {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
};

type GeminiApiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string };
};

export function getGeminiModel(): string {
  return getEnv("GEMINI_MODEL") ?? DEFAULT_GEMINI_MODEL;
}

export async function generateStructuredJson(prompt: string): Promise<GeminiStructuredResponse> {
  const apiKey = requireEnv("GEMINI_API_KEY");
  const model = getGeminiModel();
  const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`;
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - startedAt;
    const payload = (await response.json().catch(() => null)) as GeminiApiResponse | null;

    if (!response.ok) {
      const detail = payload?.error?.message ? `: ${payload.error.message}` : "";
      throw new Error(`Gemini request failed with status ${response.status}${detail}`);
    }

    const text =
      payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";

    if (text.trim().length === 0) {
      throw new Error("Gemini returned an empty response");
    }

    return {
      text,
      model,
      inputTokens: payload?.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: payload?.usageMetadata?.candidatesTokenCount ?? 0,
      latencyMs,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Gemini request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
