"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DraftSheet } from "@/components/workspace/help-line/draft-sheet";
import { FOLD_HOLD } from "@/components/workspace/fold";
import { formatDate, words } from "@/lib/words";
import "@/components/workspace/help.css";
import "@/components/workspace/paper.css";
import "@/components/workspace/help-line/help-line.css";
import "./home-yes-card.css";

const DAY = 86_400_000;
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

/** The workspace's draft sheet, laid on the home page: one press, the corner turns green, and the sheet files itself. */
export function HomeYesCard() {
  const text = words().assistant;
  const [step, setStep] = useState<"waiting" | "sealed" | "filed">("waiting");
  // Yesterday, mid-morning, as in the sample. Set once, after the page is alive, so the server and the browser never disagree.
  const [takenAt] = useState(() => new Date(Date.now() - DAY).setHours(10, 20, 0, 0));
  const filed = useRef<HTMLDivElement>(null);
  const again = useRef(false);
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (step !== "sealed") return;
    // The green corner holds as long as it does in every room, then the sheet goes to its place in the list.
    const hold = setTimeout(() => setStep("filed"), FOLD_HOLD);
    return () => clearTimeout(hold);
  }, [step]);
  useEffect(() => {
    // The press leaves with the button, so the keyboard is handed to what came of it; the page itself never moves.
    if (step === "filed") filed.current?.focus({ preventScroll: true });
    if (step === "waiting" && again.current) stage.current?.querySelector<HTMLElement>(".help-actions button")?.focus({ preventScroll: true });
  }, [step]);
  return <div className="home-yes-stage" data-step={step} ref={stage}>
    <div className="home-yes-sheet" inert={step === "filed"}>
      <DraftSheet
        key={step === "waiting" ? "waiting" : "said"}
        drafted={{ ...drafted, call: { ...drafted.call, takenAt } }}
        sealed={step !== "waiting"}
        format={format}
        pending={false}
        limits={<span className="block min-w-0">{text.made.checked} {step === "waiting" && text.unsaved}</span>}
        onApprove={() => setStep("sealed")}
      />
    </div>
    <div className="home-yes-filed" ref={filed} tabIndex={-1} inert={step !== "filed"} role="group" aria-label="Requests waiting for a decision">
      <p className="help-sheet-label">Requests waiting for a decision</p>
      <ol>
        <li data-new>
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
      <p className="home-yes-after">
        <span>That is the whole idea.</span>
        <Button asChild variant="link" className="home-yes-in"><Link href="/app?intent=sample">Look around a sample conference<ArrowUpRight aria-hidden="true" /></Link></Button>
        <Button variant="link" className="home-yes-again" onClick={() => { again.current = true; setStep("waiting"); }}>See it again</Button>
      </p>
    </div>
  </div>;
}
