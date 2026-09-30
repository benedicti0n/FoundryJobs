import Link from "next/link";
import { APP_NAME, TARGET_AUDIENCE } from "@foundryjobs/shared";

type Section = {
  title: string;
  description: string;
  badge: string;
  href?: string;
};

const sections: Section[] = [
  {
    title: "Sources",
    description: "Trusted hiring sources that feed the FoundryJobs pipeline.",
    href: "/sources",
    badge: "Open",
  },
  {
    title: "Approval Queue",
    description: "Review and approve generated posts before anything is published.",
    badge: "Coming soon",
  },
  {
    title: "Generated Posts",
    description: "Platform-specific drafts for Telegram, X, Instagram, and LinkedIn.",
    badge: "Coming soon",
  },
  {
    title: "Published Posts",
    description: "Track the posts that went live across every platform.",
    badge: "Coming soon",
  },
];

const cardClassName =
  "block rounded-xl border border-slate-800 bg-slate-900/60 p-6 transition-colors hover:border-emerald-500/60";

function CardBody({
  title,
  description,
  badge,
}: {
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
      <p className="mt-4 text-xs font-medium uppercase tracking-wider text-slate-500">{badge}</p>
    </>
  );
}

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-16">
      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">
          Phase 3 · Fetching Foundation
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{APP_NAME}</h1>
        <p className="max-w-2xl text-lg text-slate-300">
          Fresh tech hiring alerts for interns, freshers, and 0–3 YOE candidates.
        </p>
        <p className="text-sm text-slate-500">Built for {TARGET_AUDIENCE.join(", ")}.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) =>
          section.href ? (
            <Link key={section.title} href={section.href} className={cardClassName}>
              <CardBody
                title={section.title}
                description={section.description}
                badge={section.badge}
              />
            </Link>
          ) : (
            <article key={section.title} className={cardClassName}>
              <CardBody
                title={section.title}
                description={section.description}
                badge={section.badge}
              />
            </article>
          ),
        )}
      </section>
    </main>
  );
}
