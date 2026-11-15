import type { ReactNode } from "react";

export type StageId = 1 | 2 | 3 | 4;

export type StepProps = {
  n: StageId;
  id: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  /** Only the open step takes the stage. The others fold to one line. */
  open: boolean;
  done?: boolean;
  summary?: ReactNode;
  onOpen: () => void;
  /** The way forward, shown under the open step. */
  next?: ReactNode;
};

export function Step({ n, id, title, lead, children, aside, open, done, summary, onOpen, next }: StepProps) {
  const num = `0${n}`;
  if (!open)
    return (
      <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-32 border-t border-rule">
        <button type="button" onClick={onOpen} aria-expanded={false} className="group flex w-full items-baseline gap-4 rounded-none py-5 text-left sm:gap-6 sm:py-6">
          <span aria-hidden="true" className={`label w-7 shrink-0 tabular-nums ${done ? "text-ok" : "text-mute"}`}>
            {done ? "✓" : num}
          </span>
          <span className="min-w-0 flex-1">
            <span id={`${id}-title`} className={`font-display block text-2xl font-medium tracking-tight sm:text-3xl ${done ? "text-ink" : "text-mute"} group-hover:text-accent-ink`}>
              <span className="sr-only">Step {n}: </span>
              {title}
            </span>
            {summary ? <span className="mt-1 block text-sm text-mute">{summary}</span> : null}
          </span>
          <span className="label shrink-0 text-accent-ink opacity-70 group-hover:opacity-100">{done ? "Edit" : "Open"}</span>
        </button>
      </section>
    );
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="rise scroll-mt-32 border-t-2 border-ink pt-6 pb-12 sm:pt-8 sm:pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p aria-hidden="true" className="label text-accent tabular-nums">
            {num} / 04
          </p>
          <h2 id={`${id}-title`} className="stage-title mt-3">
            <span className="sr-only">Step {n}: </span>
            {title}
          </h2>
          {lead ? <p className="mt-4 max-w-2xl text-lg leading-relaxed text-mute">{lead}</p> : null}
        </div>
        {aside}
      </div>
      <div className="mt-8">{children}</div>
      {next ? <div className="mt-10 flex flex-wrap items-center gap-4">{next}</div> : null}
    </section>
  );
}

/** What the workspace decides about a step: whether it is on stage, and how it folds. */
export type Staging = Pick<StepProps, "open" | "done" | "summary" | "onOpen" | "next">;

const STAGES: { n: StageId; label: string }[] = [
  { n: 1, label: "Neighbors" },
  { n: 2, label: "Announcement" },
  { n: 3, label: "Review" },
  { n: 4, label: "Publish" },
];

/** Where you are, always in reach. */
export function Rail({ stage, done, onGo }: { stage: StageId; done: Record<StageId, boolean>; onGo: (n: StageId) => void }) {
  return (
    <nav aria-label="Steps" className="no-print sticky top-[57px] z-20 -mx-4 border-b border-line bg-paper/90 px-4 backdrop-blur sm:-mx-6 sm:px-6">
      <ol className="flex gap-1 overflow-x-auto py-2 text-sm font-medium sm:gap-2">
        {STAGES.map((s) => {
          const current = s.n === stage;
          return (
            <li key={s.n} className="shrink-0">
              <button
                type="button"
                onClick={() => onGo(s.n)}
                aria-current={current ? "step" : undefined}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 transition-colors ${current ? "bg-ink text-white" : "text-mute hover:bg-accent-soft hover:text-accent-ink"}`}
              >
                <span aria-hidden="true" className={`font-display tabular-nums ${current ? "text-gold-bright" : done[s.n] ? "text-ok" : ""}`}>
                  {done[s.n] && !current ? "✓" : s.n}
                </span>
                {s.label}
                {done[s.n] ? <span className="sr-only"> (done)</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
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
