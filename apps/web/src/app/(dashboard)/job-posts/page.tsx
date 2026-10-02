import Link from "next/link";
import { Notice } from "@/components/notice";

export const dynamic = "force-dynamic";

type JobPostRow = {
  id: string;
  roleTitle: string;
  companyName: string | null;
  location: string | null;
  workMode: string;
  employmentType: string;
  status: string;
  skills: string[];
  latestScore?: { totalScore: number; shouldPost: boolean } | null;
};

type JobPostsState =
  | { status: "unconfigured" }
  | { status: "error"; message: string }
  | { status: "ready"; posts: JobPostRow[] };

async function loadJobPosts(): Promise<JobPostsState> {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    return { status: "unconfigured" };
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/v1/job-posts?limit=20`, {
      cache: "no-store",
    });
    if (!response.ok) {
      return { status: "error", message: `The API responded with status ${response.status}.` };
    }
    const payload = (await response.json()) as { data?: JobPostRow[] };
    return { status: "ready", posts: payload.data ?? [] };
  } catch {
    return { status: "error", message: "Could not reach the FoundryJobs API." };
  }
}

export default async function JobPostsPage() {
  const state = await loadJobPosts();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16">
      <header className="space-y-3">
        <Link
          href="/"
          className="inline-block text-xs font-medium uppercase tracking-[0.2em] text-emerald-400 hover:text-emerald-300"
        >
          ← Back to FoundryJobs
        </Link>
        <h1 className="text-4xl font-bold tracking-tight">Job Posts</h1>
        <p className="max-w-2xl text-slate-300">
          Normalized hiring posts after extraction and scoring.
        </p>
        <p className="text-sm text-slate-500">
          Each job post comes from a raw post, was extracted by Gemini or the rule-based fallback,
          and carries a deterministic score that decides whether it should be posted.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Recent job posts
        </h2>

        {state.status === "unconfigured" && (
          <Notice tone="muted">
            API not configured. Set <code className="text-slate-200">API_BASE_URL</code> to the
            FoundryJobs API to load job posts.
          </Notice>
        )}

        {state.status === "error" && <Notice tone="warning">{state.message}</Notice>}

        {state.status === "ready" && state.posts.length === 0 && (
          <Notice tone="muted">
            No job posts yet. Run{" "}
            <code className="text-slate-200">pnpm --filter @foundryjobs/worker normalize:once</code>{" "}
            to normalize fetched raw posts.
          </Notice>
        )}

        {state.status === "ready" && state.posts.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Post?</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {state.posts.map((post) => (
                  <tr key={post.id} className="bg-slate-950/40">
                    <td className="max-w-xs px-4 py-3">
                      <p className="font-medium text-slate-100">{post.roleTitle}</p>
                      {post.location ? (
                        <p className="text-xs text-slate-500">{post.location}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{post.companyName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-300">{post.workMode}</td>
                    <td className="px-4 py-3 text-slate-300">{post.employmentType}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {post.latestScore ? `${post.latestScore.totalScore}/100` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {post.latestScore ? (
                        <span
                          className={
                            post.latestScore.shouldPost ? "text-emerald-400" : "text-slate-500"
                          }
                        >
                          {post.latestScore.shouldPost ? "Yes" : "No"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{post.status}</td>
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
