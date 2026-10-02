import Link from "next/link";
import { Notice } from "@/components/notice";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type RawPostRow = {
  id: string;
  rawTitle: string | null;
  rawUrl: string;
  status: string;
  fetchedAt: string;
  postedAt: string | null;
};

type RawPostsState =
  | { status: "unconfigured" }
  | { status: "error"; message: string }
  | { status: "ready"; posts: RawPostRow[] };

const statusStyles: Record<string, string> = {
  new: "text-sky-300",
  normalized: "text-emerald-300",
  rejected: "text-amber-300",
  error: "text-rose-300",
  duplicate: "text-slate-400",
};

async function loadRawPosts(): Promise<RawPostsState> {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    return { status: "unconfigured" };
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/v1/raw-posts?limit=20`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return { status: "error", message: `The API responded with status ${response.status}.` };
    }
    const payload = (await response.json()) as { data?: RawPostRow[] };
    return { status: "ready", posts: payload.data ?? [] };
  } catch {
    return { status: "error", message: "Could not reach the FoundryJobs API." };
  }
}

export default async function RawPostsPage() {
  const state = await loadRawPosts();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16">
      <header className="space-y-3">
        <Link
          href="/"
          className="inline-block text-xs font-medium uppercase tracking-[0.2em] text-emerald-400 hover:text-emerald-300"
        >
          ← Back to FoundryJobs
        </Link>
        <h1 className="text-4xl font-bold tracking-tight">Raw Posts</h1>
        <p className="max-w-2xl text-slate-300">Fetched posts before AI/rule normalization.</p>
        <p className="text-sm text-slate-500">
          Raw posts are stored exactly as fetched from each source. Normalization extracts
          structured hiring data, scores it, and turns it into job posts.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Recent raw posts
        </h2>

        {state.status === "unconfigured" && (
          <Notice tone="muted">
            API not configured. Set <code className="text-slate-200">API_BASE_URL</code> to the
            FoundryJobs API to load raw posts.
          </Notice>
        )}

        {state.status === "error" && <Notice tone="warning">{state.message}</Notice>}

        {state.status === "ready" && state.posts.length === 0 && (
          <Notice tone="muted">
            No raw posts yet. Add sources and run{" "}
            <code className="text-slate-200">pnpm --filter @foundryjobs/worker fetch:once</code> to
            fetch some.
          </Notice>
        )}

        {state.status === "ready" && state.posts.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Posted</th>
                  <th className="px-4 py-3">Fetched</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {state.posts.map((post) => (
                  <tr key={post.id} className="bg-slate-950/40">
                    <td className="max-w-md px-4 py-3">
                      <a
                        href={post.rawUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-slate-100 hover:text-emerald-300"
                      >
                        {post.rawTitle ?? "Untitled"}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusStyles[post.status] ?? "text-slate-300"}>
                        {post.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{formatDateTime(post.postedAt)}</td>
                    <td className="px-4 py-3 text-slate-400">{formatDateTime(post.fetchedAt)}</td>
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
