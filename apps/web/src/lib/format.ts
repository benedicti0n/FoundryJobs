export function formatDateTime(value: string | null | undefined, fallback = "—"): string {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
