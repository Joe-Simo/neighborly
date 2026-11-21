"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@/components/workspace/query";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { useWorkspace } from "@/components/workspace/context";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { draftNotes, monthlyAllowance } from "@/lib/request-draft";
import { measured } from "@/lib/jev-set";
import { formatDay } from "@/lib/words";

const noteKeys = Object.keys(draftNotes) as (keyof typeof draftNotes)[];
const quiet = "inline-flex min-h-11 cursor-pointer items-center border-0 bg-transparent p-0 underline underline-offset-4 hover:decoration-current active:decoration-2 active:decoration-current";

/**
 * For a part that opens in place below its link: on a phone it lands under the fold, and the link seems to do
 * nothing. Brings the opened part into view (at once under Reduce Motion) and moves focus to it, so a screen
 * reader says it opened. Put the ref on the opened part, with tabIndex={-1}.
 */
export function useOpenedIntoView<Part extends HTMLElement>(open: boolean) {
  const part = useRef<Part>(null);
  useEffect(() => {
    const opened = part.current;
    if (!open || !opened) return;
    opened.focus({ preventScroll: true });
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A part taller than the screen is read from its top; a shorter one only needs to be all in view.
    opened.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: opened.offsetHeight > window.innerHeight * 0.8 ? "start" : "nearest" });
  }, [open]);
  return part;
}

/**
 * The help line reads in the person's own language, so what stands inside it does too: the assistant's lines
 * come from the person's words, English or Spanish.
 */
function useRoomWords() {
  return useWorkspace().words.assistant;
}
/** Each line the backend wrote about a blank field, as why it is blank and what the person does about it. */
function useDraftNotes(notes: string[]) {
  const text = useRoomWords();
  return notes.map((line) => {
    const key = noteKeys.find((name) => draftNotes[name] === line);
    return key ? text.notes[key] : { why: line, act: "" };
  });
}

/** What the person must do before a draft can be approved, in ink above the buttons. Nothing when the draft is whole. */
export function DraftToDo({ notes }: { notes: string[] }) {
  const acts = [...new Set(useDraftNotes(notes).map((note) => note.act).filter(Boolean))];
  return acts.length ? <p className="!m-0 text-[17px] leading-snug !text-[var(--live-ink)]">{acts.join(" ")}</p> : null;
}

/**
 * The foot of a request the assistant filled in from a call note. One plum sentence says how it was made and why
 * a field is blank; "What the assistant saw" opens the record kept when it was sent (the text, each question and
 * answer, the model) and the limits that never change. With no record kept, only the fixed lines show: nothing is rebuilt. It sits inside the plum `help-assistant` line.
 *
 * The note is fetched only when the sheet is opened. A draft the assistant could not check was made by rules alone, and the sheet says so.
 */
export function AssistantLimits({ callId, verification, notes }: { callId: Id<"calls">; verification: "checked" | "review"; notes: string[] }) {
  const { data } = useWorkspace();
  const text = useRoomWords();
  const [open, setOpen] = useState(false);
  const id = useId();
  const opened = useOpenedIntoView<HTMLSpanElement>(open);
  const opener = useRef<HTMLButtonElement>(null);
  const whys = useDraftNotes(notes).map((note) => note.why);
  const checked = verification === "checked";
  const record = useQuery(api.aiReads.latest, open ? { churchId: data.church.id as Id<"churches">, callId, purpose: "draft" } : "skip");
  return (
    <span className="block min-w-0">
      {/* Once the yes is given, "nothing is saved" is no longer true: the sealed sheet fades it where it stands. */}
      {text.made[verification]} {whys.join(" ")} {!whys.length && <span className="help-unsaved">{text.unsaved}</span>}{" "}
      <button ref={opener} type="button" className={`${quiet} -my-2.5 text-inherit decoration-[#cfc5dc]`} aria-expanded={open} aria-controls={id} data-opens="" onClick={() => setOpen(!open)}>
        {open ? text.hide : text.show}
      </button>
      {open && (
        // Esc folds it away again and hands focus back to what opened it, as every sheet does.
        <span id={id} ref={opened} tabIndex={-1} onKeyDown={(event) => { if (event.key !== "Escape") return; event.stopPropagation(); setOpen(false); opener.current?.focus(); }} className="paper-rise mt-4 grid scroll-my-24 gap-y-3 text-[15px] leading-snug text-[var(--live-ink)] outline-none">
          {[
            {
              label: text.limits.read,
              // What was recorded when it was sent, as it was; a draft never sent says so.
              detail: record === undefined ? <span className="block min-h-[1.4em]" aria-busy="true" /> : record ? <AssistantRecord record={record} /> : checked ? text.limits.readDetail : text.limits.notSent,
            },
            { label: text.limits.does, detail: text.limits.doesDetail },
            { label: text.limits.blank, detail: text.limits.blankDetail },
            { label: text.limits.person, detail: text.limits.personDetail },
          ].map(({ label, detail }) => (
            <span key={label} className="grid gap-x-6 gap-y-1 min-[700px]:grid-cols-[9rem_minmax(0,1fr)]">
              <span className="font-[650]">{label}</span>
              <span>{detail}</span>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

type Recorded = NonNullable<FunctionReturnType<typeof api.aiReads.latest>>;

/**
 * One call to the assistant exactly as the server recorded it: the text as it left, with what was taken out shown by
 * its placeholder, each question as it was put and the answer that came back, and the model that answered.
 * Nothing here is rebuilt: a question stands in the words it was sent in, and an answer as the number Jev returned.
 */
function AssistantRecord({ record }: { record: Recorded }) {
  const { words } = useWorkspace();
  const text = useRoomWords();
  const removed: Record<string, string> = text.removed;
  const sent = record.sentText.replace(/\[(name|phone|email|address|date)\]/g, (_: string, kind: string) => `[${removed[kind]}]`);
  const figure = new Intl.NumberFormat(words.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <>
      <span className="mb-1.5 block border-l-2 border-[#cfc5dc] pl-3 font-serif text-[17px]">{sent}</span>
      {text.limits.readDetail}
      {/* The questions went in English; a reader in another language is told so once. */}
      {words.locale !== "en" && <span className="mt-3 block text-[var(--live-muted)]">{text.limits.sentInEnglish}</span>}
      {/* Question and answer side by side; what the code took as yes first, the rest after, every word kept. */}
      <span className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-5 gap-y-2" role="table" aria-label={text.show}>
        <span role="row" className="contents">
          <span role="columnheader" className="font-[650]">{text.limits.question}</span>
          <span role="columnheader" className="text-right font-[650]">{text.limits.answer}</span>
        </span>
        {[...record.asked].sort((a, b) => Number(b.yes) - Number(a.yes)).map((one) => (
          <span key={one.key} role="row" className="contents">
            <span role="cell" lang="en">{one.question}</span>
            <span role="cell" className="text-right tabular-nums whitespace-nowrap">
              {one.yes && <span className="font-[650]">{text.limits.yes} </span>}
              {one.answer === null ? "—" : figure.format(one.answer)}
              {one.choice && <span lang="en" className="block">{one.choice}</span>}
            </span>
          </span>
        ))}
      </span>
      <span className="mt-3 block">{text.limits.model(record.model)}</span>
    </>
  );
}

/** On a call the assistant put first: "What the assistant saw" opens what it was sent about the call and what it answered. */
export function UrgencyRead({ callId }: { callId: Id<"calls"> }) {
  const { data } = useWorkspace();
  const text = useRoomWords();
  const [open, setOpen] = useState(false);
  const id = useId();
  const opened = useOpenedIntoView<HTMLSpanElement>(open);
  const opener = useRef<HTMLButtonElement>(null);
  const record = useQuery(api.aiReads.latest, open ? { churchId: data.church.id as Id<"churches">, callId, purpose: "urgency" } : "skip");
  return (
    <span className="help-first-read block min-w-0">
      <button ref={opener} type="button" className={`${quiet} -my-2.5 text-inherit decoration-[#cfc5dc]`} aria-expanded={open} aria-controls={id} data-opens="" onClick={() => setOpen(!open)}>
        {open ? text.hide : text.show}
      </button>
      {open && (
        // Esc folds it away again and hands focus back to what opened it, as every sheet does.
        <span id={id} ref={opened} tabIndex={-1} onKeyDown={(event) => { if (event.key !== "Escape") return; event.stopPropagation(); setOpen(false); opener.current?.focus(); }} className="paper-rise mt-4 grid scroll-my-24 gap-y-3 text-[15px] leading-snug text-[var(--live-ink)] outline-none">
          <span className="grid gap-y-1">
            <span className="font-[650]">{text.limits.read}</span>
            <span>{record === undefined ? <span className="block min-h-[1.4em]" aria-busy="true" /> : record ? <AssistantRecord record={record} /> : text.limits.readDetail}</span>
          </span>
        </span>
      )}
    </span>
  );
}

/**
 * "How the assistant works here": one quiet link and the sheet it opens, in the person's own language. What the
 * model is, where it works, what is never sent, who decides, its limits and how it was measured.
 * The figures are the run of 2026-11-15 (see src/lib/jev-set.ts); change the sentence when a new run changes them.
 */
export function AssistantGuide() {
  const { words } = useWorkspace();
  const text = words.assistant.guide;
  const [open, setOpen] = useState(false);
  // Its words load only when the sheet opens, so they weigh nothing in the rooms that carry the link.
  const [referrals, setReferrals] = useState("");
  useEffect(() => {
    if (!open) return;
    void import("@/components/workspace/week-note/referral-words").then((m) => setReferrals(m.referralWords(words.locale)));
  }, [open, words.locale]);
  return (
    <>
      <button type="button" className={`${quiet} text-[15px] !text-[var(--live-muted)] decoration-[#b9c4b0]`} data-opens="" onClick={() => setOpen(true)}>
        {text.link}
      </button>
      {open && (
        <LiveDialog title={text.title} description={text.deck} closeLabel={words.shell.close} onClose={() => setOpen(false)}>
          <dl className="m-0 grid gap-y-5">
            {[
              [text.what, text.whatDetail],
              [text.where, text.whereDetail],
              [text.never, text.neverDetail],
              [text.person, text.personDetail],
              [text.limit, text.limitDetail(monthlyAllowance)],
              [text.measured, text.measuredDetail(formatDay(words.locale, measured.day))],
              ...(referrals ? [referrals.split("|")] : []),
            ].map(([label, detail]) => (
              <div key={label} className="grid gap-x-6 gap-y-1 min-[700px]:grid-cols-[10.5rem_minmax(0,1fr)]">
                <dt className="text-[17px] font-[650] text-[var(--live-ink)]">{label}</dt>
                <dd className="m-0 text-[17px] leading-[1.5] text-[var(--live-ink)]">{detail}</dd>
              </div>
            ))}
          </dl>
          {/* The sheet scrolls: a soft edge at its foot shows there is more, and stands clear of the last line at the end. */}
          <div aria-hidden="true" className="pointer-events-none sticky bottom-[calc(-1*var(--live-dialog-pad))] -mx-[var(--live-dialog-pad)] h-[calc(var(--live-dialog-pad)+2.5rem)] -mb-[var(--live-dialog-pad)] bg-gradient-to-t from-[#f5f3ec] from-40% to-transparent" />
        </LiveDialog>
      )}
    </>
  );
}
