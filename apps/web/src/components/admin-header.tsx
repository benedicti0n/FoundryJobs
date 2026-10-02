import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { getAdminSession } from "@/lib/auth";

export async function AdminHeader() {
  const session = await getAdminSession();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-3">
      <Link href="/" className="text-sm font-semibold text-slate-100 hover:text-emerald-300">
        FoundryJobs Admin
      </Link>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-slate-500">
          Logged in as <span className="text-slate-300">{session?.username ?? "unknown"}</span>
        </span>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-lg border border-slate-700 px-3 py-1.5 font-semibold text-slate-300 transition-colors hover:border-slate-500"
          >
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
