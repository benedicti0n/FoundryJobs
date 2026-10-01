import type { ReactNode } from "react";

export function Notice({
  tone,
  children,
}: {
  tone: "muted" | "warning" | "success";
  children: ReactNode;
}) {
  const className =
    tone === "warning"
      ? "rounded-xl border border-amber-900/60 bg-amber-950/30 p-6 text-sm text-amber-200"
      : tone === "success"
        ? "rounded-xl border border-emerald-900/60 bg-emerald-950/30 p-6 text-sm text-emerald-200"
        : "rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400";
  return <div className={className}>{children}</div>;
}
