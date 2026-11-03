import type { ReactNode } from "react";

export function Step({ n, id, title, lead, children, aside }: { n: number; id: string; title: string; lead?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="card scroll-mt-24 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3.5">
          <span aria-hidden="true" className="font-display mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-lg font-semibold text-accent-ink">
            {n}
          </span>
          <div>
            <h2 id={`${id}-title`} className="font-display text-2xl font-semibold tracking-tight">
              <span className="sr-only">Step {n}: </span>
              {title}
            </h2>
            {lead ? <p className="mt-1 max-w-2xl text-mute">{lead}</p> : null}
          </div>
        </div>
        {aside}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function StatusChip({ status, children, title }: { status: "ok" | "check" | "missing" | "neutral"; children: ReactNode; title?: string }) {
  const icon = status === "ok" ? "✓" : status === "check" ? "!" : status === "missing" ? "✕" : "•";
  const label = status === "ok" ? "Matches" : status === "check" ? "Check" : status === "missing" ? "Problem" : "Note";
  return (
    <span className={`chip chip-${status}`} title={title}>
      <span aria-hidden="true" className="font-bold">{icon}</span>
      <span className="sr-only">{label}: </span>
      {children}
    </span>
  );
}

export function Notice({ tone = "neutral", children, role }: { tone?: "neutral" | "warn" | "bad" | "ok"; children: ReactNode; role?: "status" | "alert" }) {
  const cls = tone === "warn" ? "bg-warn-soft text-warn border-warn/20" : tone === "bad" ? "bg-bad-soft text-bad border-bad/20" : tone === "ok" ? "bg-ok-soft text-ok border-ok/20" : "bg-accent-soft text-accent-ink border-accent/15";
  return (
    <div role={role} className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}

export const fmt = (n: number) => n.toLocaleString("en-US");
export const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;
