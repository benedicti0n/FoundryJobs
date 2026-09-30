import Link from "next/link";
import type { ReactNode } from "react";
import { SOURCE_TYPES, type SourceDto, type SourceType } from "@foundryjobs/shared";

export const dynamic = "force-dynamic";

const sourceTypeDescriptions: Record<SourceType, string> = {
  ats: "Structured job boards such as Greenhouse, Lever, Ashby, Workable, and Workday.",
  company_careers: "Company career pages that publish fresher and early-career openings.",
  rss: "Feeds from curated job boards and early-career blogs.",
  web_page: "Curated hiring pages that need light parsing.",
  telegram_channel: "Public Telegram channels that post hiring alerts.",
  x_search: "Saved X searches for hiring posts (planned).",
  manual: "Submissions added by hand until automated sources cover them.",
};

type SourcesState =
  | { status: "unconfigured" }
  | { status: "error"; message: string }
  | { status: "ready"; sources: SourceDto[] };

async function loadSources(): Promise<SourcesState> {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    return { status: "unconfigured" };
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/v1/sources`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return { status: "error", message: `The API responded with status ${response.status}.` };
    }
    const payload = (await response.json()) as { data?: SourceDto[] };
    return { status: "ready", sources: payload.data ?? [] };
  } catch {
    return { status: "error", message: "Could not reach the FoundryJobs API." };
  }
}

function Notice({ tone, children }: { tone: "muted" | "warning"; children: ReactNode }) {
  const className =
    tone === "warning"
      ? "rounded-xl border border-amber-900/60 bg-amber-950/30 p-6 text-sm text-amber-200"
      : "rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400";
  return <div className={className}>{children}</div>;
}

export default async function SourcesPage() {
  const state = await loadSources();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16">
      <header className="space-y-3">
        <Link
          href="/"
          className="inline-block text-xs font-medium uppercase tracking-[0.2em] text-emerald-400 hover:text-emerald-300"
        >
          ← Back to FoundryJobs
        </Link>
        <h1 className="text-4xl font-bold tracking-tight">Sources</h1>
        <p className="max-w-2xl text-slate-300">
          Manage places FoundryJobs will fetch hiring posts from.
        </p>
        <p className="text-sm text-slate-500">
          Fetching is not implemented yet — this registry stores where future fetches will run.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Registered sources
        </h2>

        {state.status === "unconfigured" && (
          <Notice tone="muted">
            API not configured. Set <code className="text-slate-200">API_BASE_URL</code> to the
            FoundryJobs API (for example{" "}
            <code className="text-slate-200">http://localhost:4000</code>) to load the source
            registry.
          </Notice>
        )}

        {state.status === "error" && <Notice tone="warning">{state.message}</Notice>}

        {state.status === "ready" && state.sources.length === 0 && (
          <Notice tone="muted">
            No sources registered yet. Create them through the API or run the seed script.
          </Notice>
        )}

        {state.status === "ready" && state.sources.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Trust</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {state.sources.map((source) => (
                  <tr key={source.id} className="bg-slate-950/40">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-100">{source.name}</p>
                      <p className="truncate text-xs text-slate-500">{source.url}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{source.type}</td>
                    <td className="px-4 py-3 text-slate-300">{source.platform ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-300">{source.trustLevel}</td>
                    <td className="px-4 py-3">
                      <span className={source.isActive ? "text-emerald-400" : "text-slate-500"}>
                        {source.isActive ? "Active" : "Paused"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Source categories
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {SOURCE_TYPES.map((type) => (
            <article key={type} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <h3 className="font-mono text-sm font-semibold text-emerald-300">{type}</h3>
              <p className="mt-2 text-sm text-slate-400">{sourceTypeDescriptions[type]}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
