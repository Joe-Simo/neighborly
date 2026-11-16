"use client";

import { SavedWords } from "@/components/workspace/saved-words";
import { cn } from "@/lib/utils";
import { useSavedLine } from "@/components/workspace/fold";
import "./help-line.css";
import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@/components/workspace/query";
import { CircleCheck } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { headings } from "@/components/workspace/navigation";
import { LiveLoading } from "@/components/workspace/primitives";
import { ReliefPicture } from "@/components/workspace/relief";
import { LiveState } from "@/components/workspace/states";

/**
 * While a room's rows arrive: the one quiet "Opening…" line of the whole product, and only after 400ms,
 * so a quick arrival shows nothing. No grey rows: grey is not paper. `label` says what is awaited, for whoever reads the page's source; it is not shown.
 */
export function HelpLoading({ label }: { label?: string }) {
  return (
    <div className="help-opening" data-awaits={label}>
      <LiveLoading />
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
  className,
  focus = true,
}: {
  children: string;
  action?: ReactNode;
  className?: string;
  /** False where the line is only read out, and the person's place on the page is left alone. */
  focus?: boolean;
}) {
  const line = useRef<HTMLDivElement>(null);
  // Six seconds, or twelve when it carries an action; then it closes up and stays as a message for screen readers.
  const seen = useSavedLine(line, { action: !!action, of: children });
  useEffect(() => {
    if (focus) line.current?.focus({ preventScroll: true });
  }, [children, focus]);
  return (
    <div className={seen ? cn("live-success help-done paper-settle", className) : "sr-only"} role="status" tabIndex={-1} ref={line}>
      {seen && <CircleCheck size={22} aria-hidden="true" />}
      {seen ? <SavedWords>{children}</SavedWords> : children}
      {seen && action}
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
  const { data } = useWorkspace();
  const allowed = useQuery(api.access.canOpenNeighborRecords, {
    churchId: data.church.id,
  });
  if (allowed === undefined)
    return <HelpLoading />;
  return allowed ? children : <KeptPrivate />;
}
