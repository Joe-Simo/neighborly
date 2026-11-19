"use client";

import { keepTitle } from "@/lib/words/titles";
import { useId } from "react";

import { SavedWords } from "@/components/workspace/saved-words";
import { cn } from "@/lib/utils";
import { heldWhenLaid, opened, useSavedLine } from "@/components/workspace/fold";
import "./help-line.css";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@/components/workspace/query";
import { CircleCheck } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { FollowingHeading, LiveLoading, PaperScene } from "@/components/workspace/primitives";
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
  const named = useId();
  return (
    <div className="help-empty" data-first={first ? "" : undefined} role="group" aria-labelledby={named}>
      <PaperScene kind="empty" />
      <div>
        {/* h2 straight under the room's h1, h3 under a section's h2: no level is skipped. */}
        <FollowingHeading id={named}>{title}</FollowingHeading>
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
/** The whole yes, from the sheet to its saved line, in this long: the line is whole and still by its end. */
const WHOLE = 400;
/** The beat between the sealed sheet's own words going (in one cut) and anything moving. */
const WORDS_GONE = 64;
/** How far above what follows the card's shadow ends, at its faintest. */
const SHADOW_CLEAR = 4;
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

/**
 * The sealed sheet's words go where they stand, its seal with them, in one cut, a beat before anything moves: the close, the line and
 * the line's own words then all start on one frame, and no word is ever on the page twice. Its paper and its green
 * corner stay. At once for anyone who asks for less motion.
 */
export async function letSheetWordsGo() {
  const sheet = document.querySelector<HTMLElement>(".help-sheet.help-sealed");
  if (!sheet || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  keepSheetWords(sheet);
  const going = [...sheet.children].map((part) => part.animate([{ opacity: 1 }, { opacity: 0 }], { duration: WORDS_GONE, easing: "step-start", fill: "forwards" }));
  await Promise.allSettled(going.map((move) => move.finished));
}

/** The pace of every word that is carried to the line, and of the sheet's own setting of it giving way. */
const CARRY = "cubic-bezier(0.2, 0.7, 0.2, 1)";
/** How much of the whole yes the two settings of a carried word take to change places. */
const CHANGE = 0.25;
let kept: { copy: HTMLElement; word: HTMLElement }[] = [];
/**
 * The two words the line will carry, the name and the request, do not go with the rest: they stay on the paper,
 * each as a copy laid exactly over itself, until the line's setting of them comes up in their place. So the card
 * is never bare: the sheet's setting gives way as the line's comes, in the same time and at the same pace.
 */
function keepSheetWords(sheet: HTMLElement) {
  dropSheetWords();
  kept = [...sheet.querySelectorAll<HTMLElement>(".help-from strong, #draft-title")].map((word) => {
    const at = word.getBoundingClientRect();
    const look = getComputedStyle(word);
    const copy = document.createElement("span");
    copy.textContent = word.textContent;
    copy.setAttribute("aria-hidden", "true");
    Object.assign(copy.style, {
      position: "fixed", left: `${at.left}px`, top: `${at.top}px`, width: `${at.width}px`, zIndex: "30", margin: "0", pointerEvents: "none",
      font: look.font, letterSpacing: look.letterSpacing, color: look.color, textWrap: look.textWrap, fontVariationSettings: look.fontVariationSettings,
      fontFeatureSettings: look.fontFeatureSettings,
    });
    return { copy, word };
  });
  // The copy is the word from here on, so the word is never drawn twice, one over the other.
  for (const { copy, word } of kept) {
    document.body.append(copy);
    word.style.visibility = "hidden";
  }
}
/** The sheet's kept words give way: at once when nothing takes their place, or in one cut as the line's setting is in place. Words never fade. */
export function dropSheetWords(over = 0) {
  const going = kept;
  kept = [];
  for (const { copy, word } of going) {
    const gone = () => copy.remove();
    if (over) copy.animate([{ opacity: 1 }, { opacity: 0 }], { duration: over, easing: "step-end", fill: "forwards" }).finished.then(gone, gone);
    else {
      // Nothing takes its place: the sheet has its own word back.
      word.style.visibility = "";
      gone();
    }
  }
}

/** A shadow as the browser gives it back (`rgba(…) x y blur spread [inset]`), to be drawn again a frame at a time. */
type Shade = { rgb: string; alpha: number; x: number; y: number; blur: number; spread: number; inset: boolean };
function shadesOf(shadow: string): Shade[] {
  return [...shadow.matchAll(/rgba?\(([^)]*)\)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px(\s+inset)?/g)].map((found) => {
    const [r, g, b, a = "1"] = found[1].split(",").map((part) => part.trim());
    return { rgb: `${r}, ${g}, ${b}`, alpha: parseFloat(a), x: parseFloat(found[2]), y: parseFloat(found[3]), blur: parseFloat(found[4]), spread: parseFloat(found[5]), inset: !!found[6] };
  });
}

function fileAway(line: HTMLElement) {
  const sheet = document.querySelector<HTMLElement>(".help-sheet.help-sealed");
  // Once for a line, however often its effects are run.
  if (line.dataset.filedFrom !== undefined) return;
  if (!sheet || matchMedia("(prefers-reduced-motion: reduce)").matches) return dropSheetWords();
  line.dataset.filedFrom = "";
  // Measured where the line will rest: its own arriving move is put aside for the measure (nothing has been painted yet).
  line.style.animation = "none";
  const place = line.getBoundingClientRect();
  const rest = (part: HTMLElement) => part.getBoundingClientRect();
  const ends = new Map([...line.querySelectorAll<HTMLElement>("[data-filed]")].map((part) => [part, rest(part)]));
  line.style.animation = "";
  // In view, and laid in its place: a line held under the top edge (fold.ts openUp) is not where the sheet was.
  if (heldWhenLaid(line) || place.top < 0 || place.bottom > window.innerHeight) return dropSheetWords();
  // The yes: the sheet becomes its saved line. Its words have gone already (letSheetWordsGo); its paper is carried
  // here as a card. The line opens where the sheet's top was while the sheet closes in its place under it, both from
  // the same frame and at the same pace (fold.ts, 360ms); the card is the two together, so it only shortens, never
  // passes over a row, and lands exactly on the line. Its green corner turns further as it is taken, the line's two
  // words travel up over it from where the sheet's stood, and it takes the line's green as it lands and gives way.
  // The card is the bare paper above the page; the sheet itself is gone at once.
  const from = setOff.sheet ?? sheet.getBoundingClientRect();
  const card = sheet.cloneNode(false) as HTMLElement;
  card.setAttribute("aria-hidden", "true");
  card.removeAttribute("id");
  card.removeAttribute("aria-labelledby");
  // A copy above the page, not a leaf of it: the room's close leaves it alone.
  card.removeAttribute("data-fold-leaves");
  Object.assign(card.style, {
    position: "fixed", left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`,
    margin: "0", zIndex: "29", pointerEvents: "none", overflow: "hidden", boxSizing: "border-box", animation: "none",
  });
  card.classList.add("help-handed");
  // Inside the room's frame, so it keeps the room's own look.
  (sheet.closest(".live-app") ?? document.body).append(card);
  // Gone at once whatever else moves it: the room's close fades the sheet as well, and that must never show it again.
  sheet.style.setProperty("opacity", "0", "important");
  const lineLook = getComputedStyle(line);
  const paper = getComputedStyle(sheet).backgroundColor;
  // Its shadow is the sheet's own. It fades as the card takes the line's green, its colour let go, so it thins away
  // and never switches off; and it tightens under the card as the room closes, so its faintest edge never reaches
  // what follows (the browser paints a blur out to one and a half times its radius).
  const shades = shadesOf(getComputedStyle(sheet).boxShadow);
  const reach = Math.max(0, ...shades.filter((shade) => !shade.inset).map((shade) => shade.y + shade.spread + 1.5 * shade.blur));
  const turning = card.animate(
    [
      { backgroundColor: paper, borderRadius: getComputedStyle(sheet).borderRadius, opacity: 1 },
      { backgroundColor: paper, offset: 0.2 },
      { backgroundColor: lineLook.backgroundColor, borderRadius: lineLook.borderRadius, opacity: 1, offset: 0.55 },
      { backgroundColor: lineLook.backgroundColor, borderRadius: lineLook.borderRadius, opacity: 0 },
    ],
    { duration: WHOLE, fill: "forwards" },
  );
  const done = () => card.remove();
  turning.finished.then(done, done);
  // Each frame the card is read off the room: its top is the line's top, and its foot is the line's foot with what is
  // left of the sheet under it, the sheet's whole height at the start and nothing at the end. It never reaches past
  // the top of what follows the sheet, so it never lies on a row, and its shadow falls only on the paper between.
  let after = sheet.nextElementSibling as HTMLElement | null;
  while (after && (after.offsetHeight === 0 || after.classList.contains("sr-only"))) after = after.nextElementSibling as HTMLElement | null;
  // Should the line first stand a little below the sheet's top (held by its sticky top), that drop is let go as it
  // opens: the card starts exactly on the sheet and still ends exactly on the line.
  let drop: number | undefined;
  const follow = () => {
    if (!card.isConnected || !line.isConnected) return;
    const now = line.getBoundingClientRect();
    const left = 1 - opened(line);
    drop ??= now.top - from.top;
    const top = now.top - drop * left;
    const next = after?.isConnected ? after.getBoundingClientRect().top : Number.POSITIVE_INFINITY;
    const foot = Math.min(now.bottom + (from.height - drop) * left, next);
    card.style.top = `${top}px`;
    card.style.height = `${Math.max(0, Math.min(from.height, foot - top))}px`;
    card.style.clipPath = `inset(-48px -48px ${Number.isFinite(next) ? -Math.max(0, next - foot) : -48}px -48px)`;
    const fade = 1 - Math.min(1, (turning.effect?.getComputedTiming().progress ?? 1) / 0.55);
    const tight = reach > 0 ? Math.max(0, Math.min(1, (next - foot - SHADOW_CLEAR) / reach)) : 1;
    card.style.boxShadow = shades
      .map(({ rgb, alpha, x, y, blur, spread, inset }) => {
        const k = inset ? 1 : tight;
        return `${inset ? "inset " : ""}${x * k}px ${y * k}px ${blur * k}px ${spread * k}px rgba(${rgb}, ${alpha * fade})`;
      })
      .join(", ");
    requestAnimationFrame(follow);
  };
  requestAnimationFrame(follow);
  const corner = `${window.innerWidth < 700 ? 48 : 64}px`;
  card.animate([{ width: "38px", height: "38px", opacity: 1 }, { width: corner, height: corner, opacity: 1, offset: 0.23 }, { width: corner, height: corner, opacity: 0, offset: 0.7 }, { opacity: 0 }], {
    duration: WHOLE, easing: "cubic-bezier(0.3, 0, 0.2, 1)", fill: "forwards", pseudoElement: "::after",
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
    // where the large one stood, and is carried to its line.
    const scale = parseFloat(getComputedStyle(from).fontSize) / parseFloat(look.fontSize);
    const landed = () => {
      to.style.opacity = "";
      copy.remove();
    };
    // Each sets off on the close's first frame, and comes up as the sheet's own setting of it gives way (below).
    copy.animate(
      [{ transform: resized ? `${move} scale(${scale})` : move, opacity: 0 }, { opacity: 1, offset: CHANGE }, { transform: "none", opacity: 1 }],
      { duration: WHOLE - 16, easing: CARRY, fill: "both" },
    ).finished.then(landed, landed);
  };
  dropSheetWords((WHOLE - 16) * CHANGE);
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
  remaining,
}: {
  children: string;
  action?: ReactNode;
  className?: string;
  /** False where the line is only read out, and the person's place on the page is left alone. */
  focus?: boolean;
  /** A draft was just filed by a yes: the line carries whose it is and what it asks, as the sheet showed them. */
  filed?: { name: string; asks: string };
  /** Put back on returning to the room (takeLine): it stands whole, unsaid and out of focus, for the time it has left. */
  remaining?: number;
}) {
  const line = useRef<HTMLDivElement>(null);
  const back = remaining !== undefined;
  // Before the line starts to open: the filed words set off from the sheet (measured while the line is whole).
  useLayoutEffect(() => {
    if (filed && line.current && !back) fileAway(line.current);
    // Once, as the line is laid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Six seconds, or ten when it carries an action (an Undo); then it closes up and stays as a message for screen readers.
  const seen = useSavedLine(line, { action: !!action, of: children, remaining });
  // In the line's first frame, not inside the save's own task: focusing there makes the browser work out the whole
  // page's styles a second time before anything is drawn.
  useEffect(() => {
    if (!focus || back) return;
    const frame = requestAnimationFrame(() => line.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [children, focus, back]);
  const said = filed ? `${filed.name}: ${filed.asks}. ${children}` : children;
  return (
    // Not a status region of its own: the line is read by taking focus, or said in the page's one polite region (fold.ts).
    <div className={seen ? cn("live-success help-done", !back && "paper-settle", filed && "help-filed", className) : "sr-only"} tabIndex={-1} ref={line}>
      {/* What a screen reader hears is the same words from first to last, so the line closing up says nothing again. */}
      <span className="sr-only">{said}</span>
      {seen && <CircleCheck size={22} aria-hidden="true" />}
      {!seen ? null : filed ? (
        <span className="help-filed-words" aria-hidden="true">
          <strong data-filed="name">{keepTitle(filed.name)}</strong>
          <span data-filed="asks">{filed.asks}</span>
          <SavedWords>{children}</SavedWords>
        </span>
      ) : (
        <span className="contents" aria-hidden="true">
          <SavedWords>{children}</SavedWords>
        </span>
      )}
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
