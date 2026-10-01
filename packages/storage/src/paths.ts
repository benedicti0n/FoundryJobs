export const INSTAGRAM_CARD_KEY_PREFIX = "foundryjobs/instagram-cards";

export function buildInstagramCardObjectKey(generatedPostId: string): string {
  return `${INSTAGRAM_CARD_KEY_PREFIX}/instagram-card-${generatedPostId}.png`;
}

export function joinPublicUrl(baseUrl: string, key: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedKey = key.replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedKey}`;
}
