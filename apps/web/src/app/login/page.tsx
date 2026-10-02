import Link from "next/link";
import { redirect } from "next/navigation";
import { Notice } from "@/components/notice";
import { ADMIN_SETUP_ERROR, getAdminSession, isAdminAuthConfigured } from "@/lib/auth";
import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const configured = isAdminAuthConfigured();

  if (configured) {
    const session = await getAdminSession();
    if (session) {
      redirect("/");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">FoundryJobs Admin</h1>
        <p className="text-sm text-slate-400">
          Sign in to manage sources, drafts, approvals, and publishing.
        </p>
      </header>

      {!configured ? <Notice tone="warning">{ADMIN_SETUP_ERROR}</Notice> : null}
      {params.error ? <Notice tone="warning">{params.error}</Notice> : null}

      <form
        action={loginAction}
        className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6"
      >
        <input type="hidden" name="next" value={params.next ?? ""} />
        <label className="block text-sm">
          <span className="mb-1 block text-slate-400">Username</span>
          <input
            name="username"
            required
            autoComplete="username"
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-100"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-400">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-100"
          />
        </label>
        <button
          type="submit"
          disabled={!configured}
          className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Sign in
        </button>
      </form>

      <p className="text-center text-xs text-slate-600">
        <Link href="/" className="text-slate-400 hover:text-slate-300">
          Back to FoundryJobs
        </Link>
      </p>
    </main>
  );
}
