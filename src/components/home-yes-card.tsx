"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SampleLink } from "@/components/sample-link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DraftSheet } from "@/components/workspace/help-line/draft-sheet";
import { formatDate, words } from "@/lib/words";
import { sampleYear, YES_GIVEN } from "@/lib/sample-year";
import "@/components/workspace/help.css";
import "@/components/workspace/paper.css";
import "@/components/workspace/help-line/help-line.css";
import "./home-yes-card.css";

const DAY = 86_400_000;
const PAPER_EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";
/** The corner turns green and the tick settles; then the sheet folds down into the list. */
const GREEN = 300;
const format = (time: number, options?: Intl.DateTimeFormatOptions) => formatDate("en", time, { month: "short", day: "numeric", ...options });

// The same made-up call the sample conference holds, so what is seen here is what waits behind the door.
// Nothing here is fetched or sent: no backend, no assistant, only this sheet and the visitor's press.
const drafted = {
  call: { neighborId: null, neighborName: null, callerName: "Rosa Fontaine", note: "Behind on November rent, $450. The landlord is Mill Road Rentals." },
  draft: { kind: "rent", amountRequested: 45000, payeeKind: "landlord", payeeName: "Mill Road Rentals", quote: "" },
} as const;
const others = [
  { name: "Darnell Joseph", asks: "Utility bill, $95 to County Water Authority", days: 2 },
  { name: "Esperanza Montoya", asks: "Rent, $600 to Orchard Street Apartments", days: 4 },
] as const;

/**
 * The workspace's draft sheet, laid on the home page. One press: the corner turns green, and the sheet's own
 * words fold down into the first line of the list of requests, on the same paper, which never changes size.
 * The public pages' travelling card lands on `.home-yes-sheet .help-sheet`; its top left corner is kept bare.
 */
export function HomeYesCard() {
  const text = words().assistant;
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
  // Before the list is first painted, each of its words is put where the sheet's own word for it stands,
  // at that word's size, and from there it travels to its line. Transforms and opacity only.
  useLayoutEffect(() => {
    const root = stage.current;
    if (step !== "filed" || !root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const find = (selector: string) => root.querySelector<HTMLElement>(selector);
    const moves: Animation[] = [];
    // The sheet's small words are gone within 100ms; only then does anything set off.
    const travel = (from: HTMLElement | null, to: HTMLElement | null, resized: boolean) => {
      if (!from || !to) return;
      const start = from.getBoundingClientRect();
      const end = to.getBoundingClientRect();
      const move = `translate(${start.left - end.left}px, ${start.top - end.top}px)`;
      // The name keeps its shape, sized by its letters. The request is never stretched: its small setting
      // comes up in the place of the large one as that fades, and is carried to its line.
      const scale = parseFloat(getComputedStyle(from).fontSize) / parseFloat(getComputedStyle(to).fontSize);
      moves.push(to.animate(
        resized ? [{ transform: `${move} scale(${scale})` }, { transform: "none" }] : [{ transform: move, opacity: 0 }, { opacity: 0, offset: 0.2 }, { opacity: 1, offset: 0.55 }, { transform: "none", opacity: 1 }],
        { duration: 420, delay: 100, easing: PAPER_EASE, fill: "backwards" },
      ));
    };
    travel(find(".help-from strong"), find("[data-new] strong"), true);
    travel(find("#draft-title"), find("[data-new] span"), false);
    const arrive = (part: HTMLElement | null, delay: number, rise = 0, duration = 260) => {
      if (part) moves.push(part.animate([{ opacity: 0, transform: `translateY(${rise}px)` }, { opacity: 1, transform: "none" }], { duration, delay, easing: PAPER_EASE, fill: "backwards" }));
    };
    // The list begins to form about 120ms before the draft has finished leaving, so the paper is never seen bare.
    arrive(find(".home-yes-filed .help-sheet-label"), 30);
    arrive(find("[data-new] small"), 360, 0, 160);
    // The tick is set down at the head of the line as the words reach it. Carried straight from the foot of the sheet it would cross them.
    const tick = find("[data-new] i");
    if (tick) moves.push(tick.animate([{ opacity: 0, transform: "scale(1.5)" }, { opacity: 1, transform: "none" }], { duration: 220, delay: 300, easing: PAPER_EASE, fill: "backwards" }));
    root.querySelectorAll<HTMLElement>(".home-yes-filed li:not([data-new])").forEach((row, order) => arrive(row, 90 + order * 40, 12));
    arrive(find(".home-yes-year"), 440, 0, 160);
    arrive(find(".home-yes-after"), 520, 8, 80);
    return () => moves.forEach(move => move.cancel());
  }, [step]);
  useEffect(() => {
    // The press leaves with the button, so the keyboard is handed to what came of it; the page itself never moves.
    if (step === "filed") way.current?.focus({ preventScroll: true });
    // The year in the book above counts this request too. It is said on the page only; nothing is sent or kept.
    if (step === "filed" && document.documentElement.dataset.yesGiven !== "true") {
      document.documentElement.dataset.yesGiven = "true";
      window.dispatchEvent(new Event(YES_GIVEN));
    }
    if (step !== "waiting" || !again.current) return;
    // The sheet's button can take the keyboard only once the browser has drawn the sheet as let back in: the frame after next.
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => stage.current?.querySelector<HTMLElement>(".help-actions button")?.focus({ preventScroll: true })); });
    return () => cancelAnimationFrame(frame);
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
    <div className="home-yes-filed" inert={step !== "filed"} role="group" aria-labelledby="home-yes-filed">
      <p className="help-sheet-label" id="home-yes-filed">Requests waiting for a decision</p>
      <ol>
        <li data-new>
          <i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4.5 12.5l5 5L19.5 7" /></svg></i>
          <strong>{drafted.call.callerName}</strong>
          <span>Rent, $450 to Mill Road Rentals</span>
          <small role="status">{step === "filed" && "Saved just now. It waits for the conference to decide."}</small>
        </li>
        {others.map(one => <li key={one.name}>
          <strong>{one.name}</strong>
          <span>{one.asks}</span>
          <small>Received {format(takenAt - one.days * DAY, { weekday: "long", month: "long" })}</small>
        </li>)}
      </ol>
      <p className="home-yes-year">{(sampleYear.requests + 1).toLocaleString("en-US")} requests for help in the sample’s year. <em>One more than a minute ago.</em></p>
      <p className="home-yes-after">
        <span>That is the whole idea.</span>
        <Button asChild variant="link" className="home-yes-in"><SampleLink ref={way}>Look around a sample conference<ArrowUpRight aria-hidden="true" /></SampleLink></Button>
        <Button variant="link" className="home-yes-again" onClick={() => { again.current = true; setStep("waiting"); }}>See it again</Button>
      </p>
    </div>
  </div>;
}
