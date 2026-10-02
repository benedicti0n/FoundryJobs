import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "foundryjobs_admin_session";

export const ADMIN_SETUP_ERROR =
  "Admin auth is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_SESSION_SECRET.";

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const SESSION_VERSION = "v1";

export type AdminSession = {
  username: string;
  iat: number;
};

export function isAdminAuthConfigured(): boolean {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  return Boolean(
    username &&
    username.trim().length > 0 &&
    password &&
    password.length > 0 &&
    secret &&
    secret.length > 0,
  );
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function sign(value: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error(ADMIN_SETUP_ERROR);
  }
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function encodeSession(session: AdminSession): string {
  const body = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${SESSION_VERSION}.${body}.${sign(`${SESSION_VERSION}.${body}`)}`;
}

function decodeSession(value: string): AdminSession | null {
  const parts = value.split(".");
  const version = parts[0];
  const body = parts[1];
  const signature = parts[2];
  if (parts.length !== 3 || version !== SESSION_VERSION || !body || !signature) {
    return null;
  }

  if (!safeEqual(signature, sign(`${version}.${body}`))) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Partial<AdminSession>;
    if (typeof parsed.username !== "string" || typeof parsed.iat !== "number") {
      return null;
    }
    const ageSeconds = Math.floor(Date.now() / 1000) - parsed.iat;
    if (ageSeconds > SESSION_MAX_AGE_SECONDS) {
      return null;
    }
    return { username: parsed.username, iat: parsed.iat };
  } catch {
    return null;
  }
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedUsername || !expectedPassword) {
    return false;
  }
  const usernameOk = safeEqual(username, expectedUsername);
  const passwordOk = safeEqual(password, expectedPassword);
  return usernameOk && passwordOk;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw) {
    return null;
  }
  return decodeSession(raw);
}

export async function createAdminSession(username: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set({
    name: ADMIN_SESSION_COOKIE,
    value: encodeSession({ username, iat: Math.floor(Date.now() / 1000) }),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}
