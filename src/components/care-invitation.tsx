"use client";

import { useReducer, useRef } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import "./care-invitation.css";

export type InvitationState = "ready" | "pending" | "accepted" | "declined";
type InvitationAction = "invite" | "accept" | "decline" | "reset";
function invitationReducer(state: InvitationState, action: InvitationAction): InvitationState {
  if (action === "reset") return "ready";
  if (state === "ready" && action === "invite") return "pending";
  if (state === "pending" && action === "accept") return "accepted";
  if (state === "pending" && action === "decline") return "declined";
  return state;
}

const outcomes = {
  ready: { eyebrow: "You’re arranging a meal", title: "There’s a place for you.", copy: "Ask your neighbor to bring bread to the shared meal." },
  pending: { eyebrow: "Now, you’re the neighbor", title: "Can you bring the bread?", copy: "You’re the neighbor now. Choose the answer that works for you." },
  accepted: { eyebrow: "A willing yes", title: "One less thing to carry.", copy: "Your neighbor will bring the bread. The shared plan is updated." },
  declined: { eyebrow: "Room for a no", title: "Still part of the table.", copy: "Your neighbor can’t bring bread this time. The task stays open; their place at the table stays." },
} as const;

/** A disclosed, local illustration of consent. It never calls the live workspace. */
type CareInvitationProps = {
  compact?: boolean;
} & (
  | { state: InvitationState; onOutcome: (state: InvitationState) => void; initialState?: never }
  | { state?: undefined; initialState?: InvitationState; onOutcome?: (state: InvitationState) => void }
);

export function CareInvitation({ compact = false, state: controlledState, initialState = "ready", onOutcome }: CareInvitationProps) {
  const [localState, dispatch] = useReducer(invitationReducer, initialState);
  const state = controlledState ?? localState;
  const heading = useRef<HTMLHeadingElement>(null);
  const outcome = outcomes[state];
  const act = (action: InvitationAction) => {
    if (controlledState === undefined) dispatch(action);
    onOutcome?.(invitationReducer(state, action));
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  };
  return <section className="care-invitation" aria-labelledby={compact ? undefined : "care-invitation-title"} aria-label={compact ? "Try a shared meal invitation" : undefined} data-state={state} data-compact={compact}>
    {!compact && <div className="care-invitation-intro">
      <p className="neighborly-eyebrow">Care, with a little clarity.</p>
      <h2 id="care-invitation-title">A shared plan.<br /><em>A willing yes.</em></h2>
      <p>Give the practical details a home. Leave the choice with the person.</p>
      <p className="care-invitation-disclosure">Interactive example · Nothing is sent</p>
    </div>}
    {compact && <p className="care-invitation-disclosure">Interactive example · Nothing is sent</p>}
    <div className="care-invitation-paper">
      <div className="care-invitation-paper-top"><span>At the shared table</span><span>{state === "ready" ? "Open" : state === "pending" ? "Awaiting a reply" : state === "accepted" ? "Accepted" : "Still open"}</span></div>
      <div className="care-invitation-context"><span>Shared meal</span><span>A time you agree together</span></div>
      <div className="care-invitation-note">
        <p className="care-invitation-note-label">A little help with</p>
        <p className="care-invitation-task">The bread.</p>
        <div className="care-invitation-responsibility"><span>Who’s bringing it?</span><strong>{state === "accepted" ? "Your neighbor" : state === "pending" ? "Waiting for a reply" : "An open invitation"}</strong>{state === "accepted" && <Check size={16} aria-hidden="true" />}</div>
      </div>
      <div className="care-invitation-response">
        {state !== "accepted" && <p className="care-invitation-eyebrow">{outcome.eyebrow}</p>}
        <h3 ref={heading} tabIndex={-1}>{state === "accepted" ? "Your neighbor is bringing it." : outcome.title}</h3>
        {state !== "accepted" && <p>{outcome.copy}</p>}
        <div className="care-invitation-actions">
          {state === "ready" && <Button onClick={() => act("invite")}>Try an invitation <ArrowRight aria-hidden="true" /></Button>}
          {state === "pending" && <><Button onClick={() => act("accept")}>Yes, I’ll bring it <Check aria-hidden="true" /></Button><Button variant="ghost" onClick={() => act("decline")}>Not this time</Button></>}
          {state === "accepted" && <div className="care-invitation-preparation"><span>Ready to take part</span><p>Bring bread to share. Agree the time and any dietary needs with your group.</p></div>}
        </div>
        {state !== "ready" && <Button className="care-invitation-reset" variant="ghost" onClick={() => act("reset")}><RotateCcw size={13} aria-hidden="true" />{state === "pending" ? "Start again" : "Try another answer"}</Button>}
      </div>
      <span role="status" className="sr-only">{state === "pending" ? "Example invitation pending. Your neighbor can accept or decline." : state === "accepted" ? "Example accepted. Your neighbor will bring the bread. Preparation is available." : state === "declined" ? "Example declined. Bringing the bread remains open." : "Example ready. No invitation has been sent."}</span>
    </div>
    {!compact && <div className="care-invitation-foot"><span>From a small gesture to a shared plan.</span><Link href="/app?intent=start">Make room for your people <ArrowUpRight size={16} aria-hidden="true" /></Link></div>}
  </section>;
}
