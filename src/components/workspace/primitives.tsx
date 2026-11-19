"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useWorkspaceIfAny } from "@/components/workspace/context";
import { stateWords, wrongControl } from "@/components/workspace/failure";
import { useEntryLanguage } from "@/components/live-auth-words";
import { words as wordsFor } from "@/lib/words";
import { useLaunchCarried } from "@/components/workspace/room-sheet";

/** "Opening…" in the reader's language: the room's own words inside the workspace, the door's language before it. */
function useOpening() {
  const workspace = useWorkspaceIfAny();
  const [language] = useEntryLanguage();
  return (workspace?.words ?? wordsFor(language)).states.opening;
}

/** A short wait inside a room, a form or a dialog: one quiet line. */
export function LiveLoading({
  label,
}: {
  label?: string;
}) {
  const opening = useOpening();
  return (
    <div className="live-loading" role="status">
      <span className="text-balance">{label ?? opening}</span>
    </div>
  );
}

/**
 * The whole workspace is on its way: plain paper with the mark where the app's launch screen has it, so one
 * follows the other without a seam. One quiet line joins it only after 400ms, so a quick load never flashes it.
 * No bars stand in for the room. The iPhone app's cover watches for `.paper-loading`; keep that class.
 */
/** The app's own launch mark (apple/…/Splash.imageset), the same file at the same place: the true centre of the screen. */
export function LaunchMark() {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a fixed 240px mark that must be there in the first paint, not optimised or lazy
    <img
      className="paper-loading-mark"
      src="/launch/mark-240.png"
      srcSet="/launch/mark-240.png 1x, /launch/mark-480.png 2x, /launch/mark-720.png 3x"
      width={240}
      height={240}
      alt=""
      // Drawn in the frame it is laid: the shell lays a second one where the launch screen's stood, with no bare frame between.
      decoding="sync"
    />
  );
}

export function LiveRoomLoading({
  label,
  children,
}: {
  label?: string;
  children?: ReactNode;
}) {
  const opening = useOpening();
  // One wait, one line: this screen carries on the line of the launch screen it replaces, and the room that follows
  // carries on this one's, in the same place (room-sheet.tsx).
  const line = useRef<HTMLParagraphElement>(null);
  useLaunchCarried(line);
  return (
    <main className="live-main paper-loading">
      <LaunchMark />
      <div className="paper-loading-words">
        <p className="paper-loading-label" role="status" ref={line}>
          <span className="text-balance">{label ?? opening}</span>
        </p>
        {children}
      </div>
    </main>
  );
}

/** The first element inside `room` that takes up room on the page and holds no drawn element before it. */
function firstDrawn(room: Element): Element | null {
  for (const child of room.children) {
    // A heading kept for screen readers alone is one pixel high and draws nothing.
    if (!(child instanceof HTMLElement) || child.offsetHeight <= 1) continue;
    return child.matches(".live-empty") ? child : firstDrawn(child) ?? child;
  }
  return null;
}

/**
 * The small cut-paper scene beside a state's words: two sheets cut by hand with a third laid on them. Nothing here yet
 * is the blank pile; a whole-room state lays the room's own picture card on top. Its folded corner says the state in the
 * colours every room uses: ochre while it waits (no connection), plum when something went wrong, plain otherwise.
 */
export function PaperScene({ kind, children }: { kind: "empty" | "private" | "missing" | "error" | "offline"; children?: ReactNode }) {
  return (
    <span className="paper-scene" data-kind={kind} data-card={children ? "" : undefined} aria-hidden="true">
      <i />
      <i />
      {children ?? <i />}
      <b />
    </span>
  );
}

/** Nothing here yet: a line in the serif, its sentence and the one act, on the room's own measure. The room's picture is in its head, once. */
export function LiveEmpty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  /** The one act that fills this place, named as the act. */
  action?: { label: string; run: () => void };
}) {
  const named = useId();
  return (
    <div
      className="live-empty"
      // Named by its own line, so a screen reader moving by region hears "No neighbors yet", not an unnamed group.
      role="group"
      aria-labelledby={named}
      ref={(element) => {
        // The first thing drawn under the page head, which already ends in a rule: this one draws none of its own.
        const room = element?.closest(".live-room");
        if (element && room && firstDrawn(room) === element) element.dataset.first = "";
      }}
    >
      <PaperScene kind="empty" />
      <div>
        <FollowingHeading id={named}>{title}</FollowingHeading>
        <p>{children}</p>
        {action && (
          <Button type="button" variant="outline" onClick={action.run}>
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * A heading whose level follows the page: h2 straight under the room's h1, h3 under a
 * section's h2, so a block that can sit in either place never skips a level.
 */
export function FollowingHeading({ children, id }: { children: ReactNode; id?: string }) {
  const [level, setLevel] = useState<1 | 2 | 3>(2);
  const place = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const here = place.current;
    if (!here) return;
    const before = [...(here.closest("main") ?? document).querySelectorAll("h1, h2, h3, h4")]
      // Only headings someone can reach count: one in a hidden part of the page is not above this one for anyone.
      .filter((heading) => heading !== here && heading.compareDocumentPosition(here) & Node.DOCUMENT_POSITION_FOLLOWING && !heading.closest("[hidden], [inert], [aria-hidden='true'], [data-room-held] > :not(.live-opening)"))
      .at(-1);
    // A room held by a lost connection shows only its card: the card's line is then the page's own heading.
    setLevel(!before && here.closest(".live-opening[data-lost]") ? 1 : !before || before.tagName === "H1" ? 2 : 3);
  }, []);
  const Heading = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
  return <Heading ref={place} id={id}>{children}</Heading>;
}

/**
 * Says what is wrong with one named field, on that field: the plum line under it, read out, with the first wrong field in
 * focus (LiveField). The line goes once the person changes the answer. Call `form.checkValidity()` after marking.
 */
export function markWrong(form: HTMLFormElement, name: string, said: string) {
  let control = form.elements.namedItem(name);
  // A day and a time (WhenField) answer under one hidden name; the problem is said on its day.
  if (control instanceof HTMLInputElement && control.type === "hidden") control = control.parentElement?.querySelector(".live-date-value") ?? null;
  if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) control.setCustomValidity(said);
}

export function LiveField({
  label,
  children,
  help,
  said: own,
}: {
  label: string;
  children: ReactNode;
  help?: string;
  /** This field's own sentences, for a form outside the workspace's language tables or one that can say more than "Fill this in." */
  said?: { needed?: string; neededChoice?: string; neededCheck?: string };
}) {
  const field = useRef<HTMLLabelElement>(null);
  // Read through a ref, so a caller's fresh object each render never rebinds the listeners.
  const ownWords = useRef(own);
  useEffect(() => {
    ownWords.current = own;
  });
  const noteId = useId();
  const [note, setNote] = useState("");
  // Only the first wrong field of a submit speaks; the others are marked and described, so a screen reader is not talked over.
  const [first, setFirst] = useState(false);
  const workspace = useWorkspaceIfAny();
  // A needed answer left empty, or one the browser will not take: said under the field in our own
  // words, with the first such field in focus. The browser's own bubble never shows.
  useEffect(() => {
    const label = field.current;
    if (!label) return;
    const said = workspace?.words.states ?? stateWords;
    const refuse = (event: Event) => {
      const control = event.target;
      if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement)) return;
      // The date field answers for its own hidden value.
      if (control.classList.contains("live-date-value")) return;
      event.preventDefault();
      // What the form itself had said about this control is put back once the person answers.
      if (control.getAttribute("aria-invalid") !== "true") control.dataset.needed = control.getAttribute("aria-invalid") ?? "";
      control.setAttribute("aria-invalid", "true");
      control.setAttribute("aria-describedby", noteId);
      const lead = control.form?.querySelector(wrongControl) === control;
      setFirst(lead);
      if (lead) control.focus();
      const time = control.classList.contains("live-time") && workspace?.words.dateField.chooseTime;
      const mine = ownWords.current;
      setNote(
        control.validity.customError
          ? control.validationMessage
          : !control.validity.valueMissing
          ? (mine?.neededCheck ?? ("neededCheck" in said ? said.neededCheck : stateWords.neededCheck))
          : control instanceof HTMLSelectElement
            ? (mine?.neededChoice ?? (time ? `${time}.` : "neededChoice" in said ? said.neededChoice : stateWords.neededChoice))
            : (mine?.needed ?? ("needed" in said ? said.needed : stateWords.needed)),
      );
    };
    const settle = () => {
      for (const control of label.querySelectorAll<HTMLElement>(`[aria-describedby="${noteId}"]`)) {
        control.removeAttribute("aria-describedby");
        if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) control.setCustomValidity("");
        const before = control.dataset.needed;
        if (before === undefined) continue;
        if (before) control.setAttribute("aria-invalid", before);
        else control.removeAttribute("aria-invalid");
        delete control.dataset.needed;
      }
      setNote("");
    };
    label.addEventListener("invalid", refuse, true);
    label.addEventListener("input", settle);
    label.addEventListener("change", settle);
    return () => {
      label.removeEventListener("invalid", refuse, true);
      label.removeEventListener("input", settle);
      label.removeEventListener("change", settle);
    };
  }, [noteId, workspace]);
  return (
    <label className="live-field" ref={field}>
      <span>{label}</span>
      {children}
      {note && (
        <small id={noteId} className="live-field-needed" role={first ? "alert" : undefined}>
          {note}
        </small>
      )}
      {help && <small>{help}</small>}
    </label>
  );
}

/**
 * A row's leaf (a day and a time, a month and a date): drawn in its pieces, read as one phrase. In the iOS app's web
 * view (WebKit) `role="text"` makes VoiceOver meet the leaf once, as `said`, instead of each piece on its own ("MON",
 * "10:10", "AM"); elsewhere the pieces are read in order, as before. The leaf keeps its own pieces as its children,
 * so the rows' rules that look at them (help-line.css, `:first-child`) stand as they were.
 */
export function DateLeaf({ said, children }: { said: string; children: ReactNode }) {
  return (
    <div className="live-date-leaf" role="text" aria-label={said}>
      {children}
    </div>
  );
}
