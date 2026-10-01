import Link from "next/link";
import { Notice } from "@/components/notice";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type GeneratedPostRow = {
  id: string;
  jobPostId: string;
  platform: string;
  status: string;
  textContent: string;
  imageUrl: string | null;
  createdAt: string;
};

type GeneratedPostsState =
  | { status: "unconfigured" }
  | { status: "error"; message: string }
  | { status: "ready"; posts: GeneratedPostRow[] };

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
  return collapsed.length > 140 ? `${collapsed.slice(0, 137)}...` : collapsed;
}

export default async function GeneratedPostsPage() {
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
          Every draft comes from a scored job post that was flagged for posting. Nothing is
          published yet — approval and publishing land in later phases.
        </p>
      </header>

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
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Image</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Preview</th>
                  <th className="px-4 py-3">Job post</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {state.posts.map((post) => (
                  <tr key={post.id} className="bg-slate-950/40">
                    <td className="px-4 py-3">
                      <span className={platformStyles[post.platform] ?? "text-slate-300"}>
                        {post.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {post.imageUrl ? (
                        <div className="space-y-1">
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
                            className={`block max-w-[160px] truncate text-xs ${
                              post.imageUrl.startsWith("http")
                                ? "text-emerald-300 hover:text-emerald-200"
                                : "text-slate-500 hover:text-slate-400"
                            }`}
                          >
                            {post.imageUrl}
                          </a>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusStyles[post.status] ?? "text-slate-300"}>
                        {post.status}
                      </span>
                    </td>
                    <td className="max-w-md px-4 py-3 text-slate-300">
                      {previewText(post.textContent)}
                    </td>
                    <td
                      className="px-4 py-3 font-mono text-xs text-slate-500"
                      title={post.jobPostId}
                    >
                      {post.jobPostId.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3 text-slate-400">{formatDateTime(post.createdAt)}</td>
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
