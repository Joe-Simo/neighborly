"use client";

import "./help-line.css";
import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { CircleCheck } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { headings } from "@/components/workspace/navigation";
import { ReliefPicture } from "@/components/workspace/relief";
import { LiveState } from "@/components/workspace/states";

/** Paper-colored blocks in the shape of the rows, while the records arrive. */
export function HelpLoading({ label }: { label: string }) {
  return (
    <div className="help-skeleton" role="status" aria-label={label}>
      {[0, 1, 2].map((row) => (
        <div key={row}>
          <i />
          <span>
            <b />
            <b />
          </span>
        </div>
      ))}
    </div>
  );
}

/** The room's own relief picture, small and round, beside an empty state. */
function Vignette() {
  const { area } = useWorkspace();
  const { picture, focus } = headings[area].art;
  return (
    <ReliefPicture
      name={picture}
      focus={focus}
      vignette
      className="paper-vignette"
    />
  );
}

export function HelpEmpty({
  title,
  children,
  action,
  first,
}: {
  /** True when this is the first thing under the page head, which already draws a rule. */
  first?: boolean;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="help-empty" data-first={first ? "" : undefined}>
      <Vignette />
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
        {action}
      </div>
    </div>
  );
}

/** The door: what a member sees instead of a neighbor screen. */
export function KeptPrivate() {
  const { words } = useWorkspace();
  return (
    <LiveState
      kind="private"
      title={words.states.privateTitle}
      action={
        <Button variant="outline" asChild>
          <Link href="/app/mine">{words.states.privateAction}</Link>
        </Button>
      }
    >
      {words.states.privateDeck}
    </LiveState>
  );
}

/** The green line that says what changed, and the one way on from it. It takes focus so a screen reader hears it. */
export function HelpDone({
  children,
  action,
}: {
  children: string;
  action?: ReactNode;
}) {
  const line = useRef<HTMLDivElement>(null);
  useEffect(() => line.current?.focus(), [children]);
  return (
    <div className="live-success help-done" role="status" tabIndex={-1} ref={line}>
      <CircleCheck size={22} aria-hidden="true" />
      <span>{children}</span>
      {action}
    </div>
  );
}

/** Every neighbor screen opens through here: members see the door, never an error. */
export function HelpRoom({
  children,
}: {
  /** No longer read: until the room knows who is asking, the wait is said in the person's own language. */
  loading?: string;
  children: ReactNode;
}) {
  const { data, words } = useWorkspace();
  const allowed = useQuery(api.access.canOpenNeighborRecords, {
    churchId: data.church.id,
  });
  if (allowed === undefined)
    return <HelpLoading label={words.states.opening} />;
  return allowed ? children : <KeptPrivate />;
}
