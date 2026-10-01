import { getEnv } from "@foundryjobs/shared";

const TELEGRAM_API_BASE = "https://api.telegram.org";
const REQUEST_TIMEOUT_MS = 20_000;

export type TelegramSendResult = {
  messageId: number;
  chatId: number | string;
  chatTitle: string | null;
  chatUsername: string | null;
  date: number | null;
};

type TelegramApiResponse = {
  ok?: boolean;
  result?: {
    message_id?: number;
    date?: number;
    chat?: {
      id?: number | string;
      title?: string;
      username?: string;
      type?: string;
    };
  };
  description?: string;
  error_code?: number;
};

export function getTelegramConfig(): { botToken: string; chatId: string } {
  const botToken = getEnv("TELEGRAM_BOT_TOKEN");
  const chatId = getEnv("TELEGRAM_CHAT_ID");
  if (!botToken || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required for Telegram publishing");
  }
  return { botToken, chatId };
}

export async function sendTelegramMessage(
  text: string,
  options: { chatId?: string } = {},
): Promise<TelegramSendResult> {
  const { botToken, chatId } = getTelegramConfig();
  const targetChatId = options.chatId ?? chatId;
  const url = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`;
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        chat_id: targetChatId,
        text,
        disable_web_page_preview: false,
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as TelegramApiResponse | null;

    if (!response.ok || !payload?.ok) {
      const description =
        payload?.description ?? `Telegram request failed with status ${response.status}`;
      throw new Error(`Telegram sendMessage failed: ${description}`);
    }

    const result = payload.result;

    return {
      messageId: result?.message_id ?? 0,
      chatId: result?.chat?.id ?? targetChatId,
      chatTitle: result?.chat?.title ?? null,
      chatUsername: result?.chat?.username ?? null,
      date: result?.date ?? null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Telegram sendMessage timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
