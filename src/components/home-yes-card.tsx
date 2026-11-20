"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SampleLink } from "@/components/sample-link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DraftSheet } from "@/components/workspace/help-line/draft-sheet";
import { formatDate, words } from "@/lib/words";
import { YES_GIVEN } from "@/lib/sample-year";
import { finals as rosaFinals } from "./home-year-slip";
import "@/components/workspace/help.css";
import "@/components/workspace/paper.css";
import "@/components/workspace/help-line/help-line.css";
import "./home-yes-card.css";

const DAY = 86_400_000;
const PAPER_EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";
/** The corner turns green and the tick settles; then the sheet folds back off the list. */
const GREEN = 300;
/** The fold (home-yes-card.css): the list's words are set down only once the draft is past them. */
const FOLD = 380;
/** The fold's easing (home-yes-card.css), and the share of its time by which it has turned a share `turned` of its quarter turn. */
const FOLD_EASE = [0.45, 0.05, 0.55, 0.95] as const;
const bezier = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
const timeFor = (turned: number) => {
  let low = 0, high = 1;
  for (let step = 0; step < 24; step++) { const mid = (low + high) / 2; if (bezier(mid, FOLD_EASE[1], FOLD_EASE[3]) < turned) low = mid; else high = mid; }
  return bezier((low + high) / 2, FOLD_EASE[0], FOLD_EASE[2]);
};
const format = (time: number, options?: Intl.DateTimeFormatOptions) => formatDate("en", time, { month: "short", day: "numeric", ...options });

// The same made-up call the sample conference holds, so what is seen here is what waits behind the door.
// Nothing here is fetched or sent: no backend, no assistant, only this sheet and the visitor's press.
const drafted = {
  call: { neighborId: null, neighborName: null, callerName: "Rosa Fontaine", note: "Behind on November rent, $450. The landlord is Mill\u00a0Road\u00a0Rentals." },
  draft: { kind: "rent", amountRequested: 45000, payeeKind: "landlord", payeeName: "Mill Road Rentals", quote: "" },
} as const;
// Two of the sample's own requests waiting for a decision this week (convex/sampleData.ts): Yolanda Price's water bill,
// written by hand, and Herminia Raymond's groceries, one of the recent calls the year draws.
const others = [
  { name: "Yolanda Price", asks: "Utility bill, $95 to County Water Authority", days: 1 },
  { name: "Herminia Raymond", asks: "Food, $105 to Corner Family Market", days: 4 },
] as const;

/**
 * The workspace's draft sheet, laid on the home page. One press: the corner turns green, and the sheet folds back and away from its
 * top edge as the slip above did, its words turned with it at full ink, leaving the list of requests on the paper beneath, which never changes size.
 * The public pages' travelling card lands on `.home-yes-sheet .help-sheet`; its top left corner is kept bare.
 */
export function HomeYesCard() {
  const text = words().assistant;
  const saved = "Saved just now. It waits for the conference to decide.";
  const [step, setStep] = useState<"waiting" | "sealed" | "filed">("waiting");
  // Yesterday, mid-morning, as in the sample.
  const [takenAt] = useState(() => new Date(Date.now() - DAY).setHours(10, 20, 0, 0));
  const stage = useRef<HTMLDivElement>(null);
  const way = useRef<HTMLAnchorElement>(null);
  const again = useRef(false);
  useEffect(() => {
    if (step !== "sealed") return;
    const green = setTimeout(() => setStep("filed"), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : GREEN);
    return () => clearTimeout(green);
  }, [step]);
  // The tick is set down as the sheet above it folds away: scale only, never faded.
  useLayoutEffect(() => {
    const tick = stage.current?.querySelector<HTMLElement>("[data-new] i");
    if (step !== "filed" || !tick || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const set = tick.animate([{ transform: "scale(0)" }, { transform: "scale(1.2)", offset: 0.7 }, { transform: "none" }], { duration: 260, delay: FOLD, easing: PAPER_EASE, fill: "backwards" });
    return () => set.cancel();
  }, [step]);
  // The list's lines are set down one by one, at full ink, the moment the folding draft has lifted clear of each: the draft folds back about its top
  // edge, so its foot stands at cos(angle) of its height, and a line is bare once the foot has risen above the line's top. No frame is bare paper.
  useLayoutEffect(() => {
    const list = stage.current?.querySelector<HTMLElement>(".home-yes-filed"), draft = stage.current?.querySelector<HTMLElement>(".home-yes-sheet .help-sheet");
    if (step !== "filed" || !list || !draft || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tall = draft.offsetHeight;
    const lines = [...list.children].flatMap(child => child.tagName === "OL" ? [...child.children] : [child]) as HTMLElement[];
    const held = lines.map(line => {
      const top = line.getBoundingClientRect().top - list.getBoundingClientRect().top;
      const at = FOLD * timeFor(Math.acos(Math.max(0, Math.min(1, top / tall))) / (Math.PI / 2));
      return line.animate([{ visibility: "hidden" }, { visibility: "hidden" }], { duration: Math.ceil(at) + 16 });
    });
    return () => held.forEach(hold => hold.cancel());
  }, [step]);
  useEffect(() => {
    // The press leaves with the button, so the keyboard is handed to what came of it; the page itself never moves.
    let handed: ReturnType<typeof setTimeout> | undefined;
    if (step === "filed") handed = setTimeout(() => way.current?.focus({ preventScroll: true }), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : FOLD + 40);
    // The year in the book above counts this request too. It is said on the page only; nothing is sent or kept.
    if (step === "filed" && document.documentElement.dataset.yesGiven !== "true") {
      document.documentElement.dataset.yesGiven = "true";
      window.dispatchEvent(new Event(YES_GIVEN));
    }
    if (step !== "waiting" || !again.current) return () => clearTimeout(handed);
    // The sheet's button can take the keyboard only once the browser has drawn the sheet as let back in: the frame after next.
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => stage.current?.querySelector<HTMLElement>(".help-actions button")?.focus({ preventScroll: true })); });
    return () => { clearTimeout(handed); cancelAnimationFrame(frame); };
  }, [step]);
  return <div className="home-yes-stage" data-step={step} ref={stage}>
    <div className="home-yes-sheet" inert={step === "filed"}>
      <DraftSheet
        drafted={{ ...drafted, call: { ...drafted.call, takenAt } }}
        sealed={step !== "waiting"}
        format={format}
        pending={false}
        limits={<span className="block min-w-0">{text.made.checked} <span className="help-unsaved">{text.unsaved}</span></span>}
        onApprove={() => setStep("sealed")}
      />
    </div>
    {/* Spoken once, from its own region outside the list, which is set down only as the fold passes. */}
    <span role="status" className="sr-only">{step === "filed" && `${drafted.call.callerName}: ${saved}`}</span>
    <div className={`home-yes-filed paper-corner${step === "filed" ? " paper-fold" : ""}`} inert={step !== "filed"} role="group" aria-labelledby="home-yes-filed">
      <p className="help-sheet-label" id="home-yes-filed">Requests waiting for a decision</p>
      <ol>
        <li data-new>
          <i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4.5 12.5l5 5L19.5 7" /></svg></i>
          <strong>{drafted.call.callerName}</strong>
          <span>Rent, $450 to Mill Road Rentals</span>
          {/* The line always holds its place, so the paper never changes height. */}
          <small aria-hidden="true">{saved}</small>
        </li>
        {others.map(one => <li key={one.name}>
          <strong>{one.name}</strong>
          <span>{one.asks}</span>
          <small>Received {format(takenAt - one.days * DAY, { weekday: "long", month: "long" })}</small>
        </li>)}
      </ol>
      <p className="home-yes-year">{rosaFinals.calls} calls, {rosaFinals.visits} home visits and {rosaFinals.paid} paid in the sample’s year. <em>Her help completes it.</em></p>
      <p className="home-yes-after">
        <span>That is the whole idea.</span>
        <Button asChild variant="link" className="home-yes-in"><SampleLink ref={way}>Look around a sample conference<ArrowUpRight aria-hidden="true" /></SampleLink></Button>
        <Button variant="link" className="home-yes-again" onClick={() => { again.current = true; setStep("waiting"); }}>See it again</Button>
      </p>
    </div>
  </div>;
}
