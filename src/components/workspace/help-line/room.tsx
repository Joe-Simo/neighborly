"use client";

import { SavedWords } from "@/components/workspace/saved-words";
import { cn } from "@/lib/utils";
import { useSavedLine } from "@/components/workspace/fold";
import "./help-line.css";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
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

/** The room's own relief picture, laid as a small card beside an empty state. */
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

/**
 * The yes files the draft away: as the sealed sheet closes, its own name and its own request travel up into
 * the saved line, so the thing that was on the sheet is seen to be kept. Each travels as a copy laid over the
 * page (the line is still opening, and clips what is inside it); the line's own words take over when they land.
 * Transforms and opacity only. Nothing moves for anyone who asks for less motion, or if the line is out of view.
 */
let setOff: { name?: DOMRect; asks?: DOMRect; sheet?: DOMRect } = {};
/**
 * Call just before the saved line is laid: where the sealed sheet's name and request stand now. The line opens
 * from nothing, so the page is as it is at this moment when the words set off.
 */
export function readSealedSheet() {
  const sheet = document.querySelector(".help-sheet.help-sealed");
  setOff = {
    sheet: sheet?.getBoundingClientRect(),
    name: sheet?.querySelector(".help-from strong")?.getBoundingClientRect(),
    asks: sheet?.querySelector("#draft-title")?.getBoundingClientRect(),
  };
  return sheet?.querySelector("#draft-title")?.textContent ?? "";
}

function fileAway(line: HTMLElement) {
  const sheet = document.querySelector(".help-sheet.help-sealed");
  if (!sheet || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // Once for a line, however often its effects are run.
  if (line.dataset.filedFrom !== undefined) return;
  line.dataset.filedFrom = "";
  // Measured where the line will rest: its own arriving move is put aside for the measure (nothing has been painted yet).
  line.style.animation = "none";
  const place = line.getBoundingClientRect();
  const rest = (part: HTMLElement) => part.getBoundingClientRect();
  const ends = new Map([...line.querySelectorAll<HTMLElement>("[data-filed]")].map((part) => [part, rest(part)]));
  line.style.animation = "";
  if (place.top < 0 || place.bottom > window.innerHeight) return;
  // The whole sheet, corner and all, is gone within 140ms, so its words are never seen twice and its green corner
  // is never left hanging alone; the room it took closes under the line as the words rise.
  // The yes: the sheet becomes its saved line. Its top edge stays where it is and it shortens upward to the line's
  // height, at the very pace the room closes up beneath it (fold.ts closeUp, 360ms), so its foot is always the list's
  // top and it never passes over a row. Its green corner turns further as it is taken; its words fade to the line's
  // own two, which travel on their own; it takes the line's green as it lands, and gives way to the line.
  // A copy does this above the page; the sheet itself is gone at once.
  const from = setOff.sheet ?? sheet.getBoundingClientRect();
  const card = sheet.cloneNode(true) as HTMLElement;
  card.setAttribute("aria-hidden", "true");
  card.removeAttribute("id");
  card.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  Object.assign(card.style, {
    position: "fixed", left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`,
    margin: "0", zIndex: "29", pointerEvents: "none", overflow: "hidden", boxSizing: "border-box", animation: "none",
  });
  card.classList.add("help-handed");
  // Its words keep the sheet's measure and size until they fade: outside the room's column they would set anew.
  const originals = [...sheet.querySelectorAll<HTMLElement>("*")];
  card.querySelectorAll<HTMLElement>("*").forEach((part, index) => {
    const source = originals[index];
    if (!source) return;
    const look = getComputedStyle(source);
    Object.assign(part.style, { width: `${source.getBoundingClientRect().width}px`, fontSize: look.fontSize, lineHeight: look.lineHeight, boxSizing: "border-box" });
  });
  // Inside the room's frame, so it keeps the room's own setting of its words.
  (sheet.closest(".live-app") ?? document.body).append(card);
  sheet.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: "forwards" });
  [...card.children].forEach((part) => (part as HTMLElement).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 100, easing: "ease-out", fill: "forwards" }));
  const lineLook = getComputedStyle(line);
  const paper = getComputedStyle(sheet).backgroundColor;
  const done = () => card.remove();
  const close = "cubic-bezier(0.2, 0.7, 0.2, 1)";
  card.animate([{ height: `${from.height}px` }, { height: `${place.height}px` }], { duration: 360, easing: close, fill: "forwards" });
  card.animate(
    [
      { backgroundColor: paper, borderRadius: getComputedStyle(sheet).borderRadius, boxShadow: getComputedStyle(sheet).boxShadow, opacity: 1 },
      { backgroundColor: paper, offset: 0.35 },
      { backgroundColor: lineLook.backgroundColor, borderRadius: lineLook.borderRadius, boxShadow: "0 0 0 #0000", opacity: 1, offset: 0.7 },
      { backgroundColor: lineLook.backgroundColor, borderRadius: lineLook.borderRadius, boxShadow: "0 0 0 #0000", opacity: 0 },
    ],
    { duration: 520, fill: "forwards" },
  ).finished.then(done, done);
  const corner = `${window.innerWidth < 700 ? 48 : 64}px`;
  card.animate([{ width: "38px", height: "38px", opacity: 1 }, { width: corner, height: corner, opacity: 1, offset: 0.23 }, { width: corner, height: corner, opacity: 0, offset: 0.7 }, { opacity: 0 }], {
    duration: 520, easing: "cubic-bezier(0.3, 0, 0.2, 1)", fill: "forwards", pseudoElement: "::after",
  });
  const travel = (from: HTMLElement | null, to: HTMLElement | null, start: DOMRect | undefined, resized: boolean) => {
    if (!from || !to || !start) return;
    const end = ends.get(to) ?? to.getBoundingClientRect();
    const look = getComputedStyle(to);
    const copy = document.createElement("span");
    copy.textContent = to.textContent;
    copy.setAttribute("aria-hidden", "true");
    Object.assign(copy.style, {
      position: "fixed", left: `${end.left}px`, top: `${end.top}px`, zIndex: "30", margin: "0", pointerEvents: "none", whiteSpace: "nowrap",
      font: look.font, letterSpacing: look.letterSpacing, color: look.color, transformOrigin: "0 0",
    });
    document.body.append(copy);
    to.style.opacity = "0";
    const move = `translate(${start.left - end.left}px, ${start.top - end.top}px)`;
    // The name keeps its shape, sized by its letters. The request is never stretched: its small setting comes up
    // where the large one stood as that fades, and is carried to its line.
    const scale = parseFloat(getComputedStyle(from).fontSize) / parseFloat(look.fontSize);
    const landed = () => {
      to.style.opacity = "";
      copy.remove();
    };
    // Each sets off as the sheet's own setting of it fades, so the two are a cross-fade and never a double.
    copy.animate(
      resized
        ? [{ transform: `${move} scale(${scale})`, opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: "none", opacity: 1 }]
        : [{ transform: move, opacity: 0 }, { opacity: 0, offset: 0.15 }, { opacity: 1, offset: 0.5 }, { transform: "none", opacity: 1 }],
      { duration: 460, delay: 60, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)", fill: "both" },
    ).finished.then(landed, landed);
  };
  travel(sheet.querySelector<HTMLElement>(".help-from strong"), line.querySelector<HTMLElement>("[data-filed=name]"), setOff.name, true);
  travel(sheet.querySelector<HTMLElement>("#draft-title"), line.querySelector<HTMLElement>("[data-filed=asks]"), setOff.asks, false);
}

/** The green line that says what changed, and the one way on from it. It takes focus so a screen reader hears it. */
export function HelpDone({
  children,
  action,
  className,
  focus = true,
  filed,
}: {
  children: string;
  action?: ReactNode;
  className?: string;
  /** False where the line is only read out, and the person's place on the page is left alone. */
  focus?: boolean;
  /** A draft was just filed by a yes: the line carries whose it is and what it asks, as the sheet showed them. */
  filed?: { name: string; asks: string };
}) {
  const line = useRef<HTMLDivElement>(null);
  // Before the line starts to open: the filed words set off from the sheet (measured while the line is whole).
  useLayoutEffect(() => {
    if (filed && line.current) fileAway(line.current);
    // Once, as the line is laid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Six seconds, or twelve when it carries an action; then it closes up and stays as a message for screen readers.
  const seen = useSavedLine(line, { action: !!action, of: children });
  useEffect(() => {
    if (focus) line.current?.focus({ preventScroll: true });
  }, [children, focus]);
  const said = filed ? `${filed.name}: ${filed.asks}. ${children}` : children;
  return (
    <div className={seen ? cn("live-success help-done paper-settle", filed && "help-filed", className) : "sr-only"} role="status" tabIndex={-1} ref={line}>
      {seen && <CircleCheck size={22} aria-hidden="true" />}
      {!seen ? said : filed ? (
        <span className="help-filed-words">
          <strong data-filed="name">{filed.name}</strong>
          <span data-filed="asks">{filed.asks}</span>
          <SavedWords>{children}</SavedWords>
        </span>
      ) : <SavedWords>{children}</SavedWords>}
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
