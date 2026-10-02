import Link from "next/link";
import { Notice } from "@/components/notice";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type PublishEventRow = {
  id: string;
  jobPostId: string;
  generatedPostId: string | null;
  platform: string;
  externalPostId: string | null;
  publishedUrl: string | null;
  status: string;
  errorMessage: string | null;
  publishedAt: string | null;
  createdAt: string;
};

type PublishEventsState =
  | { status: "unconfigured" }
  | { status: "error"; message: string }
  | { status: "ready"; events: PublishEventRow[] };

const platformStyles: Record<string, string> = {
  telegram: "text-sky-300",
  x: "text-slate-200",
  instagram: "text-pink-300",
  linkedin: "text-blue-300",
};

const statusStyles: Record<string, string> = {
  success: "text-emerald-300",
  failed: "text-rose-300",
  pending: "text-amber-300",
};

async function loadPublishEvents(): Promise<PublishEventsState> {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    return { status: "unconfigured" };
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/v1/publish-events?limit=20`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return { status: "error", message: `The API responded with status ${response.status}.` };
    }
    const payload = (await response.json()) as { data?: PublishEventRow[] };
    return { status: "ready", events: payload.data ?? [] };
  } catch {
    return { status: "error", message: "Could not reach the FoundryJobs API." };
  }
}

function previewText(text: string | null): string {
  if (!text) {
    return "—";
  }
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > 120 ? `${collapsed.slice(0, 117)}...` : collapsed;
}

export default async function PublishEventsPage() {
  const state = await loadPublishEvents();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16">
      <header className="space-y-3">
        <Link
          href="/"
          className="inline-block text-xs font-medium uppercase tracking-[0.2em] text-emerald-400 hover:text-emerald-300"
        >
          ← Back to FoundryJobs
        </Link>
        <h1 className="text-4xl font-bold tracking-tight">Publish Events</h1>
        <p className="max-w-2xl text-slate-300">
          Delivery attempts and results for platform publishing.
        </p>
        <p className="text-sm text-slate-500">
          Approved Telegram drafts are published through the direct Telegram bot, while X,
          Instagram, and LinkedIn drafts go through Buffer. Every attempt is recorded here, whether
          it succeeds or fails.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/generated-posts"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition-colors hover:border-emerald-500/60"
        >
          <h2 className="text-sm font-semibold text-slate-100">Generated Posts</h2>
          <p className="mt-1 text-xs text-slate-500">Approve and publish drafts from here</p>
        </Link>
        <Link
          href="/approval-queue"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition-colors hover:border-emerald-500/60"
        >
          <h2 className="text-sm font-semibold text-slate-100">Approval Queue</h2>
          <p className="mt-1 text-xs text-slate-500">Review drafts before publishing</p>
        </Link>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Recent attempts
        </h2>

        {state.status === "unconfigured" && (
          <Notice tone="muted">
            API not configured. Set <code className="text-slate-200">API_BASE_URL</code> to the
            FoundryJobs API to load publish events.
          </Notice>
        )}

        {state.status === "error" && <Notice tone="warning">{state.message}</Notice>}

        {state.status === "ready" && state.events.length === 0 && (
          <Notice tone="muted">
            No publish events yet. Approve a draft on the{" "}
            <Link href="/approval-queue" className="text-emerald-300 hover:text-emerald-200">
              Approval Queue
            </Link>{" "}
            page, then publish it from{" "}
            <Link href="/generated-posts" className="text-emerald-300 hover:text-emerald-200">
              Generated Posts
            </Link>{" "}
            or with the worker commands.
          </Notice>
        )}

        {state.status === "ready" && state.events.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Generated post</th>
                  <th className="px-4 py-3">External id</th>
                  <th className="px-4 py-3">Error</th>
                  <th className="px-4 py-3">Published / created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {state.events.map((event) => (
                  <tr key={event.id} className="bg-slate-950/40">
                    <td className="px-4 py-3">
                      <span className={platformStyles[event.platform] ?? "text-slate-300"}>
                        {event.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusStyles[event.status] ?? "text-slate-300"}>
                        {event.status}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 font-mono text-xs text-slate-500"
                      title={event.generatedPostId ?? undefined}
                    >
                      {event.generatedPostId ? `${event.generatedPostId.slice(0, 8)}…` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {event.publishedUrl ? (
                        <a
                          href={event.publishedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-300 hover:text-emerald-200"
                        >
                          {event.externalPostId ?? event.publishedUrl}
                        </a>
                      ) : (
                        (event.externalPostId ?? "—")
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-slate-400">
                      {previewText(event.errorMessage)}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {formatDateTime(event.publishedAt ?? event.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
