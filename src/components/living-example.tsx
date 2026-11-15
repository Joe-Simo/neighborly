"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, Check, BookOpen, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDate, getPhase, sampleDates, people, type ExampleState, type ExampleAction } from "@/lib/neighborly";
import type { ReliefView } from "@/components/relief-stage";
import "./living-example.css";

export type LivingMode = "rest" | "sunday" | "people" | "guide";
type Props = { mode: LivingMode; onModeChange: (mode: LivingMode) => void; state: ExampleState; dispatch: (action: ExampleAction) => void; onFocus: (view: ReliefView) => void; onWorkspace: (element: HTMLElement) => void };

export function LivingExample({ state, dispatch, onFocus, onWorkspace, mode, onModeChange }: Props) {
  const guide = mode === "guide";
  const peopleMode = mode === "people";
  const setGuide = (value: boolean) => onModeChange(value ? "guide" : "sunday");
  const heading = useRef<HTMLHeadingElement>(null);
  const receipt = useRef<HTMLHeadingElement>(null);
  const previousMode = useRef(mode);
  useEffect(() => {
    if (previousMode.current === mode) return;
    previousMode.current = mode;
    const frame = requestAnimationFrame(() =>
      (mode === "rest" ? receipt.current : heading.current)?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [mode]);
  const phase = getPhase(state);
  const commitment = state.commitments[state.selectedDate];
  const owner = commitment.assignee;
  const actor = state.view === "coordinator" ? "Ellis" : people[state.view].name;
  const otherDates = sampleDates.filter((date) => date !== state.selectedDate && state.commitments[date].assignee === "grace");
  const act = (action: ExampleAction, view?: ReliefView) => {
    dispatch(action);
    onModeChange(action.type === "respond" && action.response === "accepted" ? "rest" : "sunday");
    if (view) onFocus(view);
    requestAnimationFrame(() => (action.type === "respond" && action.response === "accepted" ? receipt.current : heading.current)?.focus({ preventScroll: true }));
  };
  const titles = {
    committed: "A place on the team.", unassigned: "Room for a willing yes.", open: "The date changes. Belonging stays.", pending: "The next move is Noor’s.", declined: "No is a complete answer.", accepted: "A clear yes. A shared Sunday.",
  };
  if (mode === "rest") return <section className="living-paper living-paper-rest" id="example" aria-labelledby="rest-sunday">
    <p className="living-eyebrow">{phase === "accepted" ? "A willing yes" : phase === "pending" ? "An invitation is waiting" : "Welcome team"}</p>
    <h2 id="rest-sunday" ref={receipt} tabIndex={-1}>Sunday {formatDate(state.selectedDate)}</h2>
    <p>{phase === "accepted" ? "Noor will welcome people this Sunday. Grace still belongs." : phase === "pending" ? "The choice is Noor’s. The place stays open." : phase === "declined" ? "Noor said no. Everyone still belongs." : phase === "open" ? "One date changed. The team stays together." : phase === "unassigned" ? "An open place. Room for a willing yes." : "Grace is welcoming people this Sunday."}</p>
    <Button variant="ghost" onClick={() => { onModeChange("sunday"); onFocus(phase === "accepted" ? "exchange" : "person"); }}>{phase === "accepted" ? "See the handoff" : phase === "pending" ? "See Noor’s choice" : "Explore this Sunday"} <ArrowRight /></Button>
    {phase === "accepted" && <Button variant="ghost" className="rest-guide" onClick={() => { onModeChange("guide"); onFocus("preparation"); }}>Open the guide <BookOpen /></Button>}
  </section>;
  return <section className="living-paper living-paper-expanded" id="example" aria-labelledby="living-heading" data-phase={phase}>
    <div className="living-paper-top"><span>Welcome team</span><Button variant="ghost" onClick={() => { onModeChange("rest"); onFocus("group"); requestAnimationFrame(() => receipt.current?.focus({ preventScroll: true })); }}>Back to the painting <span aria-hidden="true">↗</span></Button></div>
    <div className="living-dates" role="group" aria-label="Choose an example Sunday">
      {sampleDates.map((date) => <Button key={date} variant="ghost" aria-pressed={date === state.selectedDate} onClick={() => act({ type: "select-date", date }, "group")}><span>{formatDate(date, { month: "short" })}</span><strong>{formatDate(date, { day: "numeric" })}</strong><i aria-hidden="true" data-filled={Boolean(state.commitments[date].assignee)} /></Button>)}
    </div>
    <div className="living-context"><span>Sunday {formatDate(state.selectedDate)}</span><span>09:30–11:00</span></div>
    <div className="living-actors"><span>Through the eyes of</span><ToggleGroup type="single" value={state.view} aria-label="Example view" onValueChange={(value) => { if (value === "grace" || value === "coordinator" || value === "noor") act({ type: "set-view", view: value }, value === "grace" ? "person" : "exchange"); }}><ToggleGroupItem value="grace">Grace</ToggleGroupItem><ToggleGroupItem value="coordinator">Ellis</ToggleGroupItem><ToggleGroupItem value="noor">Noor</ToggleGroupItem></ToggleGroup></div>
    <div className="living-scene" key={`${phase}-${Boolean(state.changePreview)}-${guide}`}>
      <p className="living-eyebrow">{state.changePreview ? "One change, yours to confirm" : peopleMode ? "The welcome team" : guide ? owner ? "Ready to welcome" : "A place to help" : phase === "pending" ? "An invitation, never an assignment" : phase === "accepted" ? "Accepted responsibility" : "People stay. Plans change."}</p>
      <h2 id="living-heading" tabIndex={-1} ref={heading}>{state.changePreview ? "Just this Sunday." : peopleMode ? "People who make Sunday happen." : guide ? owner ? "A little preparation. A warmer welcome." : "First, a willing yes." : titles[phase]}</h2>
      {state.changePreview ? <><p>{actor} will release {formatDate(state.selectedDate)}. Team membership and every other date stay as they are.</p><div className="living-actions"><Button onClick={() => act({ type: "confirm-change" }, "exchange")}>Confirm this change <ArrowRight /></Button><Button variant="ghost" onClick={() => act({ type: "cancel-change" }, "person")}>Keep my commitment</Button></div></> : peopleMode ? <><p>Different lives, one shared welcome. Explore the Sunday through each person’s eyes.</p><div className="living-people">{([{ view: "grace", name: "Grace", detail: "Welcomes people every other Sunday" }, { view: "noor", name: "Noor", detail: "Offers help when she can" }, { view: "coordinator", name: "Ellis", detail: "Helps the team prepare" }] as const).map(person => <Button key={person.view} variant="ghost" onClick={() => act({ type: "set-view", view: person.view }, person.view === "grace" ? "person" : "exchange")}><span><strong>{person.name}</strong><small>{person.detail}</small></span><ArrowRight aria-hidden="true" /></Button>)}</div></> : guide && !owner ? <><p>No one has accepted this Sunday yet. The welcome guide will be ready for the person who chooses to help.</p><Button variant="outline" onClick={() => { setGuide(false); onFocus("exchange"); }}>Back to this Sunday <ArrowRight /></Button></> : guide && owner ? <><p>{people[owner].name}’s guide · St. Andrew’s Church</p><ol className="living-guide"><li><span>09:20</span>Arrive at the main entrance. Check in with Ellis.</li><li><span>Prepare</span>Put out the welcome signs and service sheets.</li><li><span>Welcome</span>Greet arriving people and help them find a seat.</li></ol><p className="living-small">Preparation is available. The responsibility is not marked complete.</p><div className="living-actions"><Button variant="outline" onClick={() => { setGuide(false); onFocus("person"); }}>Back to this Sunday</Button><Button variant="ghost" onClick={(event) => onWorkspace(event.currentTarget)}>Explore the sample team <ArrowRight /></Button></div></> : <>
        {phase === "committed" && <><p>Grace welcomes people every other Sunday. When her plans change, one commitment can change with them.</p>{state.view === "grace" ? <Button onClick={() => act({ type: "preview-change" }, "person")}>I can’t make this Sunday <ArrowRight /></Button> : <Button onClick={() => act({ type: "set-view", view: "grace" }, "person")}>See Grace’s choice <ArrowRight /></Button>}<Button className="living-text-action" variant="ghost" onClick={() => { setGuide(true); onFocus("preparation"); }}><BookOpen /> See the welcome guide</Button></>}
        {phase === "unassigned" && <><p>No one has accepted this date. An open place can wait for a willing person.</p><Button variant="outline" onClick={() => act({ type: "select-date", date: sampleDates.find((date) => state.commitments[date].assignee === "grace") ?? sampleDates[2] }, "person")}>Find Grace’s next commitment <ArrowRight /></Button></>}
        {phase === "open" && <><p>{commitment.releasedByNoor ? "Noor released this date and remains on the team. This small example has no other eligible candidate." : "Grace has released this date. Asking someone else is a separate choice."}</p>{!commitment.releasedByNoor && (state.view === "coordinator" ? <><div className="living-candidate"><strong>Noor</strong><span>Approved for Welcome · Available<br />Opted into cover requests</span></div><Button onClick={() => act({ type: "send-request" }, "exchange")}>Simulate a request to Noor <ArrowRight /></Button></> : <Button onClick={() => act({ type: "set-view", view: "coordinator" }, "exchange")}>Help Ellis find cover <ArrowRight /></Button>)}</>}
        {phase === "pending" && <><p>Noor has an invitation for this Sunday. The place remains open until she chooses. No message has been sent.</p>{state.view === "noor" ? <div className="living-actions"><Button onClick={() => act({ type: "respond", response: "accepted" }, "exchange")}>Yes, I can help <Check /></Button><Button variant="outline" onClick={() => act({ type: "respond", response: "declined" }, "group")}>Not this Sunday</Button></div> : <Button onClick={() => act({ type: "set-view", view: "noor" }, "exchange")}>See Noor’s choice <ArrowRight /></Button>}</>}
        {phase === "declined" && <><p>Noor can’t take this one. The date stays open and the guide stays with Ellis. Everyone still belongs.</p><p className="living-small">There is no second eligible candidate in this example.</p><Button variant="outline" onClick={() => act({ type: "reset" }, "group")}>Explore another answer <RotateCcw /></Button></>}
        {phase === "accepted" && <><p>Noor chose one Sunday. Grace’s place on the team stays. Now the welcome guide follows Noor’s responsibility.</p><Button onClick={() => { setGuide(true); onFocus("preparation"); }}>Open Noor’s preparation <BookOpen /></Button><Button className="living-text-action" variant="ghost" onClick={() => { dispatch({ type: "set-view", view: "noor" }); act({ type: "preview-change" }, "person"); }}>Plans changed again?</Button></>}
      </>}
    </div>
    <div className="living-belonging"><span className="living-check"><Check /></span><div><strong>Still part of the Welcome team</strong><p>Grace · Noor · Ellis</p>{otherDates.length > 0 && <p>Grace’s other dates: {otherDates.map((date) => formatDate(date, { day: "numeric", month: "short" })).join(" · ")}</p>}</div></div>
    <p className="living-small living-disclosure">Interactive example · Synthetic people · No messages sent</p>
  </section>;
}
