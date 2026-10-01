import Link from "next/link";
import { Notice } from "@/components/notice";
import { formatDateTime } from "@/lib/format";
import { approvalQueueAction } from "./actions";

export const dynamic = "force-dynamic";

type ApprovalQueueRow = {
  generatedPostId: string;
  jobPostId: string;
  platform: string;
  textContent: string;
  imageUrl: string | null;
  generatedPostStatus: string;
  companyName: string | null;
  roleTitle: string;
  location: string | null;
  totalScore: number | null;
  createdAt: string;
  updatedAt: string;
};

type ApprovalQueueState =
  | { status: "unconfigured" }
  | { status: "error"; message: string }
  | { status: "ready"; items: ApprovalQueueRow[] };

const platformStyles: Record<string, string> = {
  telegram: "text-sky-300",
  x: "text-slate-200",
  instagram: "text-pink-300",
  linkedin: "text-blue-300",
};

const quickLinks = [
  { href: "/generated-posts", label: "Generated Posts", description: "All platform drafts" },
  { href: "/job-posts", label: "Job Posts", description: "Normalized and scored jobs" },
  { href: "/sources", label: "Sources", description: "Where posts are fetched from" },
];

async function loadApprovalQueue(): Promise<ApprovalQueueState> {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    return { status: "unconfigured" };
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/v1/approval-queue`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return { status: "error", message: `The API responded with status ${response.status}.` };
    }
    const payload = (await response.json()) as { data?: ApprovalQueueRow[] };
    return { status: "ready", items: payload.data ?? [] };
  } catch {
    return { status: "error", message: "Could not reach the FoundryJobs API." };
  }
}

function previewText(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > 200 ? `${collapsed.slice(0, 197)}...` : collapsed;
}

export default async function ApprovalQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const params = await searchParams;
  const state = await loadApprovalQueue();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16">
      <header className="space-y-3">
        <Link
          href="/"
          className="inline-block text-xs font-medium uppercase tracking-[0.2em] text-emerald-400 hover:text-emerald-300"
        >
          ← Back to FoundryJobs
        </Link>
        <h1 className="text-4xl font-bold tracking-tight">Approval Queue</h1>
        <p className="max-w-2xl text-slate-300">Review generated drafts before publishing.</p>
        <p className="text-sm text-slate-500">
          Edit the text, then approve, reject, or mark the draft as needing more work. Decisions are
          recorded with <code className="text-slate-300">decidedBy: dashboard</code>. Nothing is
          published from this page.
        </p>
      </header>

      {params.message ? <Notice tone="success">{params.message}</Notice> : null}
      {params.error ? <Notice tone="warning">{params.error}</Notice> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition-colors hover:border-emerald-500/60"
          >
            <h2 className="text-sm font-semibold text-slate-100">{link.label}</h2>
            <p className="mt-1 text-xs text-slate-500">{link.description}</p>
          </Link>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Waiting for review
        </h2>

        {state.status === "unconfigured" && (
          <Notice tone="muted">
            API not configured. Set <code className="text-slate-200">API_BASE_URL</code> to the
            FoundryJobs API to load the approval queue.
          </Notice>
        )}

        {state.status === "error" && <Notice tone="warning">{state.message}</Notice>}

        {state.status === "ready" && state.items.length === 0 && (
          <Notice tone="muted">
            Nothing waiting for review. Drafts appear here after{" "}
            <code className="text-slate-200">
              pnpm --filter @foundryjobs/worker generate-posts:once
            </code>{" "}
            creates them.
          </Notice>
        )}

        {state.status === "ready" && state.items.length > 0 && (
          <div className="space-y-3">
            {state.items.map((item) => (
              <article
                key={item.generatedPostId}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
              >
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span
                    className={`font-medium uppercase tracking-wider ${platformStyles[item.platform] ?? "text-slate-300"}`}
                  >
                    {item.platform}
                  </span>
                  <span className="text-slate-500">{item.generatedPostStatus}</span>
                  <span className="text-slate-500">
                    score: {item.totalScore !== null ? `${item.totalScore}/100` : "—"}
                  </span>
                  <span className="text-slate-600">created {formatDateTime(item.createdAt)}</span>
                  <span className="text-slate-600">updated {formatDateTime(item.updatedAt)}</span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-slate-100">
                  {item.companyName ?? "Company not specified"} — {item.roleTitle}
                </h3>
                {item.location ? (
                  <p className="mt-1 text-xs text-slate-500">{item.location}</p>
                ) : null}
                {item.imageUrl ? (
                  <a
                    href={item.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-xs text-emerald-300 hover:text-emerald-200"
                  >
                    View attached image
                  </a>
                ) : null}
                <p className="mt-3 text-xs text-slate-600">
                  Preview: {previewText(item.textContent)}
                </p>

                <form action={approvalQueueAction} className="mt-4 space-y-3">
                  <input type="hidden" name="generatedPostId" value={item.generatedPostId} />
                  <textarea
                    name="textContent"
                    defaultValue={item.textContent}
                    rows={6}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      name="intent"
                      value="approve"
                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
                    >
                      Approve
                    </button>
                    <button
                      type="submit"
                      name="intent"
                      value="reject"
                      className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-rose-950 transition-colors hover:bg-rose-400"
                    >
                      Reject
                    </button>
                    <button
                      type="submit"
                      name="intent"
                      value="needs_edit"
                      className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-300"
                    >
                      Needs edit
                    </button>
                    <button
                      type="submit"
                      name="intent"
                      value="save"
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-500"
                    >
                      Save text
                    </button>
                  </div>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
