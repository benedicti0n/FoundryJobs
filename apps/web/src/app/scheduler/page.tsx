import Link from "next/link";
import { SCHEDULED_JOB_DEFINITIONS } from "@foundryjobs/shared";

export default function SchedulerPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16">
      <header className="space-y-3">
        <Link
          href="/"
          className="inline-block text-xs font-medium uppercase tracking-[0.2em] text-emerald-400 hover:text-emerald-300"
        >
          ← Back to FoundryJobs
        </Link>
        <h1 className="text-4xl font-bold tracking-tight">Scheduler</h1>
        <p className="max-w-2xl text-slate-300">
          The worker can run the non-publishing pipeline on a recurring schedule.
        </p>
        <p className="text-sm text-slate-500">
          The scheduler only fetches, normalizes, generates drafts, renders Instagram cards, and
          uploads them to R2 when configured. Publishing stays manual and is never scheduled.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Scheduled jobs
        </h2>
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">Default interval</th>
                <th className="px-4 py-3">Interval env var</th>
                <th className="px-4 py-3">Limit env var</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {SCHEDULED_JOB_DEFINITIONS.map((job) => (
                <tr key={job.name} className="bg-slate-950/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-100">{job.label}</p>
                    <p className="font-mono text-xs text-slate-500">{job.name}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    every {job.defaultIntervalMinutes} minutes
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">
                    {job.intervalEnvVar}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">
                    {job.limitEnvVar ?? "—"}
                    {job.defaultLimit !== null ? ` (${job.defaultLimit})` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Running the scheduler
        </h2>
        <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-300">
          {`SCHEDULER_ENABLED=true pnpm --filter @foundryjobs/worker scheduler`}
        </pre>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-400">
          <li>
            <code className="text-slate-300">SCHEDULER_ENABLED</code> defaults to false; the command
            exits with a disabled message unless it is true.
          </li>
          <li>
            <code className="text-slate-300">SCHEDULER_RUN_ON_START</code> defaults to false; set it
            to true to run every job once immediately.
          </li>
          <li>
            The upload job is skipped with a clear message when the R2 variables are not configured.
          </li>
          <li>Run exactly one scheduler instance per environment to avoid duplicate runs.</li>
        </ul>
        <p className="text-sm text-slate-500">
          Live scheduler state lives in the worker logs and is not exposed in this dashboard. The
          API reports the configured jobs at{" "}
          <code className="text-slate-300">GET /v1/scheduler/status</code>.
        </p>
      </section>
    </main>
  );
}
