import Link from "next/link";
import { Notice } from "@/components/notice";
import { formatDateTime } from "@/lib/format";
import { publishBufferAction, publishTelegramAction } from "./actions";

export const dynamic = "force-dynamic";

type GeneratedPostRow = {
  id: string;
  jobPostId: string;
  platform: string;
  status: string;
  textContent: string;
  imageUrl: string | null;
  companyName: string | null;
  roleTitle: string;
  location: string | null;
  createdAt: string;
  updatedAt: string;
};

type GeneratedPostsState =
  | { status: "unconfigured" }
  | { status: "error"; message: string }
  | { status: "ready"; posts: GeneratedPostRow[] };

type PublishControl =
  | { kind: "telegram" }
  | { kind: "buffer"; label: string }
  | { kind: "warning"; message: string }
  | null;

const platformStyles: Record<string, string> = {
  telegram: "text-sky-300",
  x: "text-slate-200",
  instagram: "text-pink-300",
  linkedin: "text-blue-300",
};

const statusStyles: Record<string, string> = {
  draft: "text-slate-300",
  approved: "text-emerald-300",
  rejected: "text-amber-300",
  published: "text-emerald-400",
  failed: "text-rose-300",
};

async function loadGeneratedPosts(): Promise<GeneratedPostsState> {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    return { status: "unconfigured" };
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/v1/generated-posts?limit=20`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return { status: "error", message: `The API responded with status ${response.status}.` };
    }
    const payload = (await response.json()) as { data?: GeneratedPostRow[] };
    return { status: "ready", posts: payload.data ?? [] };
  } catch {
    return { status: "error", message: "Could not reach the FoundryJobs API." };
  }
}

function previewText(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > 200 ? `${collapsed.slice(0, 197)}...` : collapsed;
}

function publishControl(post: GeneratedPostRow): PublishControl {
  if (post.status !== "approved") {
    return null;
  }

  switch (post.platform) {
    case "telegram":
      return { kind: "telegram" };
    case "x":
      return { kind: "buffer", label: "Publish to X via Buffer" };
    case "linkedin":
      return { kind: "buffer", label: "Publish to LinkedIn via Buffer" };
    case "instagram":
      if (post.imageUrl && /^https?:\/\//i.test(post.imageUrl)) {
        return { kind: "buffer", label: "Publish to Instagram via Buffer" };
      }
      if (post.imageUrl?.startsWith("/generated")) {
        return { kind: "warning", message: "Upload to R2 before publishing." };
      }
      return { kind: "warning", message: "Instagram publishing requires a public image URL." };
    default:
      return null;
  }
}

export default async function GeneratedPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const params = await searchParams;
  const state = await loadGeneratedPosts();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16">
      <header className="space-y-3">
        <Link
          href="/"
          className="inline-block text-xs font-medium uppercase tracking-[0.2em] text-emerald-400 hover:text-emerald-300"
        >
          ← Back to FoundryJobs
        </Link>
        <h1 className="text-4xl font-bold tracking-tight">Generated Posts</h1>
        <p className="max-w-2xl text-slate-300">
          Platform-ready drafts for Telegram, X, Instagram, and LinkedIn.
        </p>
        <p className="text-sm text-slate-500">
          Approved drafts can be published manually from here: Telegram goes through the direct bot,
          X, Instagram, and LinkedIn go through Buffer. Nothing is published automatically.
        </p>
      </header>

      {params.message ? <Notice tone="success">{params.message}</Notice> : null}
      {params.error ? <Notice tone="warning">{params.error}</Notice> : null}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Recent drafts
        </h2>

        {state.status === "unconfigured" && (
          <Notice tone="muted">
            API not configured. Set <code className="text-slate-200">API_BASE_URL</code> to the
            FoundryJobs API to load generated posts.
          </Notice>
        )}

        {state.status === "error" && <Notice tone="warning">{state.message}</Notice>}

        {state.status === "ready" && state.posts.length === 0 && (
          <Notice tone="muted">
            No generated posts yet. Run{" "}
            <code className="text-slate-200">
              pnpm --filter @foundryjobs/worker generate-posts:once
            </code>{" "}
            to create drafts from scored job posts.
          </Notice>
        )}

        {state.status === "ready" && state.posts.length > 0 && (
          <div className="space-y-3">
            {state.posts.map((post) => {
              const control = publishControl(post);
              return (
                <article
                  key={post.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
                >
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span
                      className={`font-medium uppercase tracking-wider ${platformStyles[post.platform] ?? "text-slate-300"}`}
                    >
                      {post.platform}
                    </span>
                    <span className={statusStyles[post.status] ?? "text-slate-300"}>
                      {post.status}
                    </span>
                    <span className="text-slate-600">created {formatDateTime(post.createdAt)}</span>
                    <span className="text-slate-600">updated {formatDateTime(post.updatedAt)}</span>
                  </div>

                  <h3 className="mt-3 text-base font-semibold text-slate-100">
                    {post.companyName ?? "Company not specified"} — {post.roleTitle}
                  </h3>
                  {post.location ? (
                    <p className="mt-1 text-xs text-slate-500">{post.location}</p>
                  ) : null}
                  <p className="mt-3 text-sm text-slate-400">{previewText(post.textContent)}</p>

                  {post.imageUrl ? (
                    <div className="mt-3 flex items-center gap-3">
                      <a href={post.imageUrl} target="_blank" rel="noreferrer">
                        <img
                          src={post.imageUrl}
                          alt={`Card preview for ${post.platform} draft`}
                          className="h-14 w-14 rounded-lg border border-slate-800 object-cover"
                        />
                      </a>
                      <a
                        href={post.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={post.imageUrl}
                        className={`block max-w-[240px] truncate text-xs ${
                          post.imageUrl.startsWith("http")
                            ? "text-emerald-300 hover:text-emerald-200"
                            : "text-slate-500 hover:text-slate-400"
                        }`}
                      >
                        {post.imageUrl}
                      </a>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {post.status === "draft" ? (
                      <Link
                        href="/approval-queue"
                        className="text-xs text-emerald-300 hover:text-emerald-200"
                      >
                        Review in Approval Queue
                      </Link>
                    ) : null}

                    {post.status === "published" ? (
                      <Link
                        href="/publish-events"
                        className="text-xs text-emerald-300 hover:text-emerald-200"
                      >
                        Published — view publish events
                      </Link>
                    ) : null}

                    {control?.kind === "telegram" ? (
                      <form action={publishTelegramAction}>
                        <input type="hidden" name="generatedPostId" value={post.id} />
                        <button
                          type="submit"
                          className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-sky-950 transition-colors hover:bg-sky-400"
                        >
                          Publish to Telegram
                        </button>
                      </form>
                    ) : null}

                    {control?.kind === "buffer" ? (
                      <form action={publishBufferAction}>
                        <input type="hidden" name="generatedPostId" value={post.id} />
                        <button
                          type="submit"
                          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 transition-colors hover:bg-emerald-400"
                        >
                          {control.label}
                        </button>
                      </form>
                    ) : null}

                    {control?.kind === "warning" ? (
                      <p className="text-xs text-amber-300">{control.message}</p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
