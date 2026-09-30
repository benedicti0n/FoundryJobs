export function isEnvSet(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.trim().length > 0;
}

export function getEnv(name: string, fallback?: string): string | undefined {
  const value = process.env[name];
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  return fallback;
}

export function requireEnv(name: string): string {
  const value = getEnv(name);
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getPort(fallback = 4000): number {
  const raw = getEnv("PORT");
  if (raw === undefined) {
    return fallback;
  }

  const port = Number.parseInt(raw, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return fallback;
  }

  return port;
}
