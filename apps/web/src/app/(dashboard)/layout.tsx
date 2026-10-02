import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/admin-header";
import { Notice } from "@/components/notice";
import { ADMIN_SETUP_ERROR, getAdminSession, isAdminAuthConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  if (!isAdminAuthConfigured()) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">FoundryJobs setup required</h1>
        <Notice tone="warning">{ADMIN_SETUP_ERROR}</Notice>
      </main>
    );
  }

  const session = await getAdminSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-5xl px-6 pt-10">
      <AdminHeader />
      {children}
    </div>
  );
}
