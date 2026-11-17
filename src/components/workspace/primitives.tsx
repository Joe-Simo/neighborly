"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useWorkspaceIfAny } from "@/components/workspace/context";
import { stateWords, wrongControl } from "@/components/workspace/failure";
import { useEntryLanguage } from "@/components/live-auth-words";
import { words as wordsFor } from "@/lib/words";
import { cameThroughTheDoor } from "@/components/workspace/door";
import { useLaunchCarried, useRoomShown } from "@/components/workspace/room-sheet";

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
  return (
    <div
      className="live-empty"
      ref={(element) => {
        // The first thing drawn under the page head, which already ends in a rule: this one draws none of its own.
        const room = element?.closest(".live-room");
        if (element && room && firstDrawn(room) === element) element.dataset.first = "";
      }}
    >
      <div>
        <FollowingHeading>{title}</FollowingHeading>
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
export function FollowingHeading({ children }: { children: ReactNode }) {
  const [level, setLevel] = useState<2 | 3>(2);
  const place = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const here = place.current;
    if (!here) return;
    const before = [...(here.closest("main") ?? document).querySelectorAll("h1, h2, h3, h4")]
      .filter((heading) => heading !== here && heading.compareDocumentPosition(here) & Node.DOCUMENT_POSITION_FOLLOWING)
      .at(-1);
    setLevel(!before || before.tagName === "H1" ? 2 : 3);
  }, []);
  const Heading = level === 2 ? "h2" : "h3";
  return <Heading ref={place}>{children}</Heading>;
}

/**
 * A figure that rolls to its value in 400ms whenever the value changes, and on arrival from nothing, once its room
 * is shown (`delay` later, the first time). It holds the width of its value throughout, so nothing beside it moves
 * while it rolls. `format` writes the number as the room shows it (money, a count). Still for anyone who asks for
 * less motion.
 */
export function CountUp({
  value,
  format = (amount) => String(Math.round(amount)),
  className,
  delay = 0,
}: {
  value: number;
  format?: (amount: number) => string;
  className?: string;
  delay?: number;
}) {
  // It rolls once, the first time its room is shown. A figure that changes after that changes at once, in the commit
  // that brought it, with no values in between.
  // Under the door's paper the figure is already at its value, so the sheet lifts off a finished room.
  const [roll, setRoll] = useState<"waiting" | { to: number; at: number } | null>(() =>
    cameThroughTheDoor() || typeof window === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches ? null : "waiting",
  );
  // It starts where the roll starts. Starting at the value showed the figure whole for a frame, then dropped it
  // to nothing and rolled it back up, which read as the figure stepping back.
  const shown = roll === "waiting" ? 0 : roll && roll.to === value ? roll.at : value;
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  });
  const done = useRef(roll === null);
  // A roll drawn while the room is still unseen would be over before anyone saw it.
  const seen = useRoomShown();
  useEffect(() => {
    if (!seen || done.current) return;
    const to = latest.current;
    const began = performance.now() + delay;
    let frame = requestAnimationFrame(function step(now) {
      const part = Math.min(1, Math.max(0, now - began) / 400);
      // It lands on the value itself, not on a sum that may miss it by a hair. Once landed, nothing starts it again.
      if (part === 1) done.current = true;
      setRoll(part < 1 ? { to, at: to * (1 - (1 - part) ** 3) } : null);
      if (part < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [seen, delay]);
  return (
    // While it rolls it says so, and the room is not at rest until it has landed (room-sheet.tsx).
    <span className={className ? `count-up ${className}` : "count-up"} data-moving={shown === value ? undefined : ""}>
      {/* A screen reader gets the figure itself, once; the rolling digits are for the eye. */}
      <span className="sr-only">{format(value)}</span>
      {/* The value, unseen, holds the figure's width; the rolling digits lie over it from its left edge, so the
          figure's box and the text's start never move. */}
      <span className="count-up-room" aria-hidden="true">{format(value)}</span>
      <span className="count-up-roll" aria-hidden="true">{format(shown)}</span>
    </span>
  );
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
      if (control.form?.querySelector(wrongControl) === control) control.focus();
      const time = control.classList.contains("live-time") && workspace?.words.dateField.chooseTime;
      const mine = ownWords.current;
      setNote(
        !control.validity.valueMissing
          ? (mine?.neededCheck ?? ("neededCheck" in said ? said.neededCheck : stateWords.neededCheck))
          : control instanceof HTMLSelectElement
            ? (mine?.neededChoice ?? (time ? `${time}.` : "neededChoice" in said ? said.neededChoice : stateWords.neededChoice))
            : (mine?.needed ?? ("needed" in said ? said.needed : stateWords.needed)),
      );
    };
    const settle = () => {
      for (const control of label.querySelectorAll<HTMLElement>(`[aria-describedby="${noteId}"]`)) {
        control.removeAttribute("aria-describedby");
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
        <small id={noteId} className="live-field-needed" role="alert">
          {note}
        </small>
      )}
      {help && <small>{help}</small>}
    </label>
  );
}
