import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  decodeSession,
  encodeSession,
  type AdminSession,
} from "./admin-session";

export * from "./admin-session";

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

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
