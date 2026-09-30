import { APP_NAME, TARGET_AUDIENCE } from "@foundryjobs/shared";

const sections = [
  {
    title: "Sources",
    description: "Trusted hiring sources that feed the FoundryJobs pipeline.",
  },
  {
    title: "Approval Queue",
    description: "Review and approve generated posts before anything is published.",
  },
  {
    title: "Generated Posts",
    description: "Platform-specific drafts for Telegram, X, Instagram, and LinkedIn.",
  },
  {
    title: "Published Posts",
    description: "Track the posts that went live across every platform.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-16">
      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">
          Phase 0 · Bootstrap
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{APP_NAME}</h1>
        <p className="max-w-2xl text-lg text-slate-300">
          Fresh tech hiring alerts for interns, freshers, and 0–3 YOE candidates.
        </p>
        <p className="text-sm text-slate-500">Built for {TARGET_AUDIENCE.join(", ")}.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <article
            key={section.title}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 transition-colors hover:border-emerald-500/60"
          >
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <p className="mt-2 text-sm text-slate-400">{section.description}</p>
            <p className="mt-4 text-xs font-medium uppercase tracking-wider text-slate-500">
              Coming soon
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
