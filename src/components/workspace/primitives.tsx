"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace, useWorkspaceIfAny } from "@/components/workspace/context";
import { stateWords, wrongControl } from "@/components/workspace/failure";
import { headings } from "@/components/workspace/navigation";
import { ReliefPicture } from "@/components/workspace/relief";

/** A short wait inside a room, a form or a dialog: one quiet line. */
export function LiveLoading({
  label = "Opening your workspace…",
}: {
  label?: string;
}) {
  return (
    <div className="live-loading" role="status">
      <LoaderCircle size={20} aria-hidden="true" />
      <span className="text-balance">{label}</span>
    </div>
  );
}

/**
 * The whole workspace is on its way: the frame and a room's shape in paper, breathing.
 * The line with the spinner joins only after two seconds, so a quick load never flashes it.
 */
export function LiveRoomLoading({
  label = "Opening your workspace…",
  children,
}: {
  label?: string;
  children?: ReactNode;
}) {
  return (
    <>
      <header className="live-header">
        <span className="live-wordmark">kind helps</span>
      </header>
      <div className="paper-loading-frame">
        <div className="live-nav" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6].map((line) => <b key={line} />)}
        </div>
        <main className="live-main paper-loading">
          <div aria-hidden="true">
            <div className="paper-loading-head"><b /><b /><b /></div>
            <div className="paper-loading-rows">
              {[0, 1, 2].map((row) => (
                <div key={row}><i /><span><b /><b /></span></div>
              ))}
            </div>
          </div>
          <p className="paper-loading-label" role="status">
            <LoaderCircle size={20} aria-hidden="true" />
            <span className="text-balance">{label}</span>
          </p>
          {children}
        </main>
      </div>
    </>
  );
}

/** Nothing here yet: a line in the serif, what to do about it, and a small piece of the room's own picture. */
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
  const { area } = useWorkspace();
  const { picture, focus } = headings[area].art;
  return (
    <div
      className="live-empty"
      // Only the first empty state of a room carries the picture; a second one beside it is words alone.
      ref={(element) => {
        if (element && element.closest(".live-room")?.querySelector(".live-empty") === element) element.dataset.lead = "";
      }}
    >
      <ReliefPicture name={picture} focus={focus} vignette className="paper-vignette" />
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
 * A figure that rolls to its value in 400ms whenever the value changes, and on arrival from nothing.
 * `format` writes the number as the room shows it (money, a count). Still for anyone who asks for less motion.
 */
export function CountUp({
  value,
  format = (amount) => String(Math.round(amount)),
  className,
}: {
  value: number;
  format?: (amount: number) => string;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (start === value || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(frame);
    }
    const began = performance.now();
    let frame = requestAnimationFrame(function roll(now) {
      const part = Math.min(1, (now - began) / 400);
      setShown(start + (value - start) * (1 - (1 - part) ** 3));
      if (part < 1) frame = requestAnimationFrame(roll);
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return (
    <span className={className ? `count-up ${className}` : "count-up"}>
      {/* A screen reader gets the figure itself, once; the rolling digits are for the eye. */}
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden="true">{format(shown)}</span>
    </span>
  );
}

export function LiveField({
  label,
  children,
  help,
}: {
  label: string;
  children: ReactNode;
  help?: string;
}) {
  const field = useRef<HTMLLabelElement>(null);
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
      setNote(
        !control.validity.valueMissing
          ? ("neededCheck" in said ? said.neededCheck : stateWords.neededCheck)
          : time
            ? `${time}.`
            : control instanceof HTMLSelectElement
              ? ("neededChoice" in said ? said.neededChoice : stateWords.neededChoice)
              : ("needed" in said ? said.needed : stateWords.needed),
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
