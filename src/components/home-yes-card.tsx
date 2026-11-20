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
/** A press held this long is a hand on the slip: from then the fold follows the hold, and letting go before the end lays it back. */
const HOLD_AFTER = 180;
/** A held fold's whole way, slower than the played one, so the hand can feel it go. */
const HELD_FOLD = 900;
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
  /** The yes was given by holding the fold to its end: the fold is already over, so nothing plays it again. */
  const held = useRef(false);
  useEffect(() => {
    if (step !== "sealed") return;
    const green = setTimeout(() => setStep("filed"), matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : GREEN);
    return () => clearTimeout(green);
  }, [step]);
  // The tick is set down as the sheet above it folds away: scale only, never faded.
  useLayoutEffect(() => {
    const tick = stage.current?.querySelector<HTMLElement>("[data-new] i");
    if (step !== "filed" || !tick || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const after = held.current ? 0 : FOLD;
    const set = tick.animate([{ transform: "scale(0)" }, { transform: "scale(1.2)", offset: 0.7 }, { transform: "none" }], { duration: 260, delay: after, easing: PAPER_EASE, fill: "backwards" });
    return () => set.cancel();
  }, [step]);
  // The list's lines are set down one by one, at full ink, the moment the folding draft has lifted clear of each: the draft folds back about its top
  // edge, so its foot stands at cos(angle) of its height, and a line is bare once the foot has risen above the line's top. No frame is bare paper.
  useLayoutEffect(() => {
    const list = stage.current?.querySelector<HTMLElement>(".home-yes-filed"), draft = stage.current?.querySelector<HTMLElement>(".home-yes-sheet .help-sheet");
    if (step !== "filed" || !list || !draft || held.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tall = draft.offsetHeight;
    const lines = [...list.children].flatMap(child => child.tagName === "OL" ? [...child.children] : [child]) as HTMLElement[];
    const hidden = lines.map(line => {
      const top = line.getBoundingClientRect().top - list.getBoundingClientRect().top;
      const at = FOLD * timeFor(Math.acos(Math.max(0, Math.min(1, top / tall))) / (Math.PI / 2));
      return line.animate([{ visibility: "hidden" }, { visibility: "hidden" }], { duration: Math.ceil(at) + 16 });
    });
    return () => hidden.forEach(hold => hold.cancel());
  }, [step]);
  useEffect(() => {
    // The press leaves with the button, so the keyboard is handed to what came of it; the page itself never moves.
    let handed: ReturnType<typeof setTimeout> | undefined;
    if (step === "filed") handed = setTimeout(() => way.current?.focus({ preventScroll: true }), matchMedia("(prefers-reduced-motion: reduce)").matches || held.current ? 0 : FOLD + 40);
    // The year in the book above counts this request too. It is said on the page only; nothing is sent or kept.
    if (step === "filed" && document.documentElement.dataset.yesGiven !== "true") {
      document.documentElement.dataset.yesGiven = "true";
      window.dispatchEvent(new Event(YES_GIVEN));
    }
    if (step === "waiting") { held.current = false; delete stage.current?.dataset.held; }
    if (step !== "waiting" || !again.current) return () => clearTimeout(handed);
    // The sheet's button can take the keyboard only once the browser has drawn the sheet as let back in: the frame after next.
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => stage.current?.querySelector<HTMLElement>(".help-actions button")?.focus({ preventScroll: true })); });
    return () => { clearTimeout(handed); cancelAnimationFrame(frame); };
  }, [step]);
  // Move 4: the hand may fold the slip itself. A press held on the yes (pointer, Space or Enter) folds the draft as long as it is held, the
  // list's lines set down beneath it as the draft passes them, by the same rule as the played fold. Let go on the button, at any point, and
  // the fold goes on to its end and the yes is given; only letting go off the button, or Esc, lays it back with nothing given. A tap, a
  // click or a key's press still gives the yes and plays the fold.
  // Nothing is said about the hold and the button's words never change. With less motion asked for there is no hold, only the press.
  useEffect(() => {
    const root = stage.current;
    if (step !== "waiting" || !root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let wait = 0, frame = 0, start = 0, progress = 0, fold: Animation | null = null, called = false, by: "pointer" | "key" | null = null, place: DOMRect | null = null;
    let lines: { line: HTMLElement; top: number; shown: boolean }[] = [];
    const approve = () => root.querySelector<HTMLButtonElement>(".home-yes-sheet .help-actions [data-slot=button]:first-child");
    const draft = () => root.querySelector<HTMLElement>(".home-yes-sheet .help-sheet");
    const list = () => root.querySelector<HTMLElement>(".home-yes-filed");
    // The fold at a share of its quarter turn: the draft turned, and each line bare once the draft's foot has risen above it.
    const lay = (share: number) => {
      progress = share;
      if (fold) fold.currentTime = share * HELD_FOLD;
      const tall = draft()?.offsetHeight ?? 1, foot = Math.cos((share * Math.PI) / 2) * tall;
      for (const one of lines) {
        const shown = foot < one.top;
        if (shown !== one.shown) { one.shown = shown; one.line.style.visibility = shown ? "visible" : "hidden"; }
      }
    };
    const begin = () => {
      const sheet = draft(), under = list();
      if (!sheet || !under) return;
      root.dataset.held = "";
      const at = under.getBoundingClientRect().top;
      lines = [...under.children].flatMap(child => child.tagName === "OL" ? [...child.children] : [child]).map(line => {
        (line as HTMLElement).style.visibility = "hidden";
        return { line: line as HTMLElement, top: line.getBoundingClientRect().top - at, shown: false };
      });
      fold = sheet.animate([{ transform: "none" }, { transform: "rotateX(-90deg)" }], { duration: HELD_FOLD, fill: "forwards" });
      fold.pause();
      start = performance.now();
      const follow = (now: number) => {
        const share = Math.min(1, (now - start) / HELD_FOLD);
        lay(share);
        if (share < 1) { frame = requestAnimationFrame(follow); return; }
        give();
      };
      frame = requestAnimationFrame(follow);
    };
    // The fold is over: the yes is given, and it is not played again.
    const give = () => {
      held.current = true;
      swallow();
      setStep("filed");
    };
    // Let go on the button part way: the fold goes on from where it stands to its end, at the played fold's pace, and the yes is given.
    const finish = () => {
      const from = progress, began = performance.now(), takes = Math.max(60, FOLD * (1 - from));
      const run = (now: number) => {
        const t = Math.min(1, (now - began) / takes);
        lay(from + (1 - from) * (1 - (1 - t) * (1 - t)));
        if (t < 1) { frame = requestAnimationFrame(run); return; }
        give();
      };
      frame = requestAnimationFrame(run);
    };
    // Called off (dragged off the button, or Esc): the draft lays back down at the played fold's pace, and the list is put away again under it.
    const back = () => {
      const from = progress, began = performance.now(), takes = Math.max(120, FOLD * from);
      const fall = (now: number) => {
        const t = Math.min(1, (now - began) / takes);
        lay(from * (1 - t) * (1 - t));
        if (t < 1) { frame = requestAnimationFrame(fall); return; }
        settle();
      };
      frame = requestAnimationFrame(fall);
    };
    const settle = () => {
      fold?.cancel();
      fold = null;
      for (const one of lines) one.line.style.removeProperty("visibility");
      lines = [];
      progress = 0;
      delete root.dataset.held;
    };
    // A press that held the fold, or was called off, says nothing more on its release: its click is taken before the button hears it.
    const swallow = () => {
      const button = approve();
      if (!button) return;
      const take = (event: Event) => { event.stopPropagation(); event.preventDefault(); };
      button.addEventListener("click", take, { capture: true, once: true });
      setTimeout(() => button.removeEventListener("click", take, { capture: true }), 0);
    };
    // Only two things call a held yes off: the pointer let go away from the button, or Esc. A slow tap, a tremor and a key's release never do.
    const press = (event: Event) => {
      const button = approve();
      if (!button || !(event.target instanceof Node) || !button.contains(event.target) || by) return;
      if (event instanceof PointerEvent && (!event.isPrimary || event.button !== 0)) return;
      if (event instanceof KeyboardEvent) {
        if ((event.key !== " " && event.key !== "Enter") || event.repeat) return;
        // Enter would answer on its way down: here it answers on its release, as Space does, so it can be held too.
        if (event.key === "Enter") event.preventDefault();
      }
      by = event instanceof PointerEvent ? "pointer" : "key";
      // Where the button lay when it was pressed: the fold carries the button away from under a still hand, so "off the button" is
      // read against this place, never against what lies under the hand by the time it lets go.
      place = button.getBoundingClientRect();
      called = false;
      wait = window.setTimeout(() => { wait = 0; begin(); }, HOLD_AFTER);
    };
    const callOff = () => {
      clearTimeout(wait);
      wait = 0;
      called = true;
      if (!fold) return;
      cancelAnimationFrame(frame);
      back();
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && by && !called) { event.preventDefault(); callOff(); return; }
      press(event);
    };
    const release = (event: Event) => {
      if (!by) return;
      if (event instanceof KeyboardEvent && (by !== "key" || (event.key !== " " && event.key !== "Enter"))) return;
      if (event instanceof PointerEvent && by !== "pointer") return;
      const enter = event instanceof KeyboardEvent && event.key === "Enter";
      by = null;
      const button = approve();
      const off = event instanceof PointerEvent && (event.type === "pointercancel" || !place || event.clientX < place.left || event.clientX > place.right || event.clientY < place.top || event.clientY > place.bottom);
      if (off && !called) callOff();
      if (called) { swallow(); return; }
      if (wait) {
        // A press, however slow, that never began to fold: the button answers it as it always has (Enter's answer was held back above).
        clearTimeout(wait);
        wait = 0;
        if (enter) button?.click();
        return;
      }
      if (!fold || held.current) return;
      cancelAnimationFrame(frame);
      swallow();
      finish();
    };
    // A held finger brings no menu up over the yes.
    const noMenu = (event: Event) => { if (by === "pointer") event.preventDefault(); };
    root.addEventListener("pointerdown", press);
    root.addEventListener("keydown", keyDown);
    root.addEventListener("contextmenu", noMenu);
    addEventListener("pointerup", release);
    addEventListener("pointercancel", release);
    addEventListener("keyup", release);
    return () => {
      clearTimeout(wait);
      cancelAnimationFrame(frame);
      root.removeEventListener("pointerdown", press);
      root.removeEventListener("keydown", keyDown);
      root.removeEventListener("contextmenu", noMenu);
      removeEventListener("pointerup", release);
      removeEventListener("pointercancel", release);
      removeEventListener("keyup", release);
      if (!held.current) settle();
      else fold?.cancel();
    };
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
