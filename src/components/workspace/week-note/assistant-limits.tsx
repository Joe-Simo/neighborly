"use client";

import { useId, useState } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useWorkspace } from "@/components/workspace/context";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { draftNotes, monthlyAllowance } from "@/lib/request-draft";
import { measured } from "@/lib/jev-set";
import { formatDay, words as book } from "@/lib/words";

const noteKeys = Object.keys(draftNotes) as (keyof typeof draftNotes)[];
const quiet = "inline-flex min-h-11 cursor-pointer items-center border-0 bg-transparent p-0 underline underline-offset-4 hover:decoration-current";

/**
 * The help line is a leaders' room and reads in English throughout, so what stands inside it does too.
 * The Spanish and Creole phrases are in the tables for the day the room is translated: use the person's words then.
 */
function useRoomWords() {
  const { data } = useWorkspace();
  return book("en", data.church.wordSet).assistant;
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
 * a field is blank; "What the assistant saw" opens the note exactly as it was sent, with identity taken out, and
 * the limits that never change. It sits inside the plum `help-assistant` line.
 *
 * The note is fetched only when the sheet is opened. A draft the assistant could not check was made by rules alone, and the sheet says so.
 */
export function AssistantLimits({ callId, verification, notes, sealed = false }: { callId: Id<"calls">; verification: "checked" | "review"; notes: string[]; sealed?: boolean }) {
  const { data } = useWorkspace();
  const text = useRoomWords();
  const [open, setOpen] = useState(false);
  const id = useId();
  const whys = useDraftNotes(notes).map((note) => note.why);
  const removed: Record<string, string> = text.removed;
  const checked = verification === "checked";
  const sent = useQuery(api.drafts.noteAsSent, open && checked ? { churchId: data.church.id as Id<"churches">, callId } : "skip");
  const read = sent?.replace(/\[(name|phone|email|address|date)\]/g, (_: string, kind: string) => `[${removed[kind]}]`);
  return (
    <span className="block min-w-0">
      {text.made[verification]} {whys.join(" ")} {!sealed && !whys.length && text.unsaved}{" "}
      <button type="button" className={`${quiet} -my-2.5 text-inherit decoration-[#cfc5dc]`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        {open ? text.hide : text.show}
      </button>
      {open && (
        <span id={id} className="paper-rise mt-4 grid gap-y-3 text-[15px] leading-snug text-[var(--live-ink)]">
          {[
            {
              label: text.limits.read,
              detail: checked ? (
                <>
                  <span className="mb-1.5 block min-h-[1.4em] border-l-2 border-[#cfc5dc] pl-3 font-serif text-[17px]" aria-busy={read === undefined}>{read}</span>
                  {text.limits.readDetail}
                </>
              ) : (
                text.limits.notSent
              ),
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

/**
 * "How the assistant works here": one quiet link and the sheet it opens, in the person's own language. What the
 * model is, where it works, what is never sent, who decides, its limits and how it was measured.
 * The figures are the run of 2026-11-15 (see src/lib/jev-set.ts); change the sentence when a new run changes them.
 */
export function AssistantGuide() {
  const { words } = useWorkspace();
  const text = words.assistant.guide;
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`${quiet} text-[15px] !text-[var(--live-muted)] decoration-[#b9c4b0]`} onClick={() => setOpen(true)}>
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
