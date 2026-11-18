"use client";

import { Component, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useConvexConnectionState } from "convex/react";
import { Button } from "@/components/ui/button";
import { useWorkspaceIfAny } from "@/components/workspace/context";
import { stateWords } from "@/components/workspace/failure";
import { openUp } from "@/components/workspace/fold";
import { headings } from "@/components/workspace/navigation";
import { FollowingHeading, PaperScene } from "@/components/workspace/primitives";
import { ReliefPicture } from "@/components/workspace/relief";

/**
 * One family for every state that is not the room working as usual: nothing here yet,
 * not yours to open, not found, did not open, no connection. Each is the room's own
 * small paper card of the room's picture, one line in the serif, one plain sentence and at most one action.
 */
/** The family's words in the person's language inside the shell, in English outside it. Never throws. */
function useStateWords() {
  return useWorkspaceIfAny()?.words.states ?? stateWords;
}
function useAreaArt() {
  const workspace = useWorkspaceIfAny();
  return workspace ? headings[workspace.area].art : null;
}

export type LiveStateKind = "empty" | "private" | "missing" | "error" | "offline";

export function LiveState({
  kind,
  title,
  children,
  action,
}: {
  kind: LiveStateKind;
  title: string;
  children: ReactNode;
  /** The one thing to do about it: a Button, or a link drawn as one. */
  action?: ReactNode;
}) {
  // Outside the shell there is no room, so no picture card: the words stand alone.
  const named = useId();
  const art = useAreaArt();
  return (
    <div
      className="live-empty live-state"
      data-kind={kind}
      data-lead={art ? "" : undefined}
      role={kind === "error" || kind === "offline" ? "alert" : "group"}
      aria-labelledby={named}
    >
      {art && (
        <PaperScene kind={kind}>
          <ReliefPicture name={art.picture} focus={art.focus} vignette className="paper-vignette" />
        </PaperScene>
      )}
      <div>
        <FollowingHeading id={named}>{title}</FollowingHeading>
        <p>{children}</p>
        {action}
      </div>
    </div>
  );
}

/**
 * A save that did not go through, said inside the form it belongs to. The sentence says
 * what happened, the second line that the form's content is kept, and the one action
 * sends the form again. Put it inside the form, above its buttons.
 */
export function LiveFailure({
  message,
  kept,
  retry = false,
}: {
  message: string;
  /** The line about what was kept; pass "" where nothing was typed. */
  kept?: string;
  /** Adds "Try again", which submits the form the notice sits in. */
  retry?: boolean;
}) {
  const words = useStateWords();
  const second = kept ?? words.kept;
  // On arrival, and when the sentence changes, the notice takes focus and comes into view, clear of a form's pinned buttons.
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => {
    notice.current?.focus({ preventScroll: true });
    notice.current?.scrollIntoView({ block: "nearest" });
  }, [message]);
  return (
    <div
      className="live-error live-failure"
      role="alert"
      tabIndex={-1}
      ref={notice}
    >
      <div>
        <p>{message}</p>
        {second && <p className="live-error-recovery">{second}</p>}
      </div>
      {retry && (
        <Button type="submit" variant="outline">
          {words.tryAgain}
        </Button>
      )}
    </div>
  );
}

/** True once the connection has been down for two seconds, so a blink never shows. */
export function useConnectionLost() {
  const { isWebSocketConnected, hasEverConnected } = useConvexConnectionState();
  const down = hasEverConnected && !isWebSocketConnected;
  const [lost, setLost] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLost(down), down ? 2000 : 0);
    return () => clearTimeout(timer);
  }, [down]);
  return lost;
}

/**
 * While a form is being sent and the connection is down: one line that says the entry
 * is kept and will go by itself. Convex holds the save and sends it on return.
 */
const laidInRoom = (line: HTMLElement | null) => {
  if (line) openUp(line, { stays: true });
};

export function LiveWaiting({
  when,
  keep,
}: {
  when: boolean;
  /**
   * For a line laid in a room's own page, not a dialog: it opens its own room as it comes (fold.ts), and once laid its
   * place is kept, its words unseen, for as long as this holds, so what lies below does not move when the wait ends.
   */
  keep?: boolean;
}) {
  const words = useStateWords();
  const lost = useConnectionLost();
  const saying = when && lost;
  const [laid, setLaid] = useState(false);
  // Laid by a lost connection; from then its place lasts as long as the save, and through `keep`.
  if (laid !== (saying || (laid && (when || keep)))) setLaid(!laid);
  if (!laid) return null;
  return (
    <p className="live-waiting" ref={keep === undefined ? undefined : laidInRoom} role={saying ? "status" : undefined} aria-hidden={saying ? undefined : true} style={saying ? undefined : { visibility: "hidden" }}>
      {words.waiting}
    </p>
  );
}

/**
 * The strip above a room while the connection is down, in ochre: the room is waiting, nothing is wrong.
 * It opens its own room when it comes (fold.ts), so the room under it is moved aside and never jumps,
 * and it is said politely, as a status. It is only laid once the connection has been down two seconds
 * (useConnectionLost), so a blink never shows it. When the connection returns it is taken out in one cut.
 */
export function LiveConnection() {
  const words = useStateWords();
  if (!useConnectionLost()) return null;
  return (
    <div className="live-connection paper-rise" role="status" aria-live="polite" ref={laidAbove}>
      <strong>{words.offlineTitle}</strong> {words.offlineDeck}
    </div>
  );
}

const laidAbove = (strip: HTMLDivElement | null) => {
  if (strip) openUp(strip, { stays: true });
};

function RoomFault({ onRetry }: { onRetry: () => void }) {
  const words = useStateWords();
  return (
    <LiveState
      kind="error"
      title={words.errorTitle}
      action={
        <Button variant="outline" onClick={onRetry}>
          {words.tryAgain}
        </Button>
      }
    >
      {words.errorDeck}
    </LiveState>
  );
}

/**
 * Keeps a fault inside one room: the frame and the menu stay, and the room says so in
 * the family's words with one way to try again. Give it the area as `key` so moving to
 * another room clears it.
 */
export class RoomBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <RoomFault onRetry={() => this.setState({ failed: false })} />;
  }
}
