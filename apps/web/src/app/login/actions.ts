"use server";

import { redirect } from "next/navigation";
import {
  ADMIN_SETUP_ERROR,
  createAdminSession,
  destroyAdminSession,
  isAdminAuthConfigured,
  verifyAdminCredentials,
} from "@/lib/auth";

function sanitizeNextPath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/login")) {
    return null;
  }
  return trimmed;
}

export async function loginAction(formData: FormData): Promise<void> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextPath = sanitizeNextPath(String(formData.get("next") ?? ""));

  if (!isAdminAuthConfigured()) {
    redirect(`/login?error=${encodeURIComponent(ADMIN_SETUP_ERROR)}`);
  }

  if (!verifyAdminCredentials(username, password)) {
    const error = encodeURIComponent("Invalid username or password");
    const nextPart = nextPath ? `&next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/login?error=${error}${nextPart}`);
  }

  await createAdminSession(username);
  redirect(nextPath ?? "/");
}

export async function logoutAction(): Promise<void> {
  await destroyAdminSession();
  redirect("/login");
}
