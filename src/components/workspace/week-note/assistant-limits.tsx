"use client";

import { useId, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useWorkspace } from "@/components/workspace/context";
import { draftNotes } from "@/lib/request-draft";

const noteKeys = Object.keys(draftNotes) as (keyof typeof draftNotes)[];

/**
 * The foot of anything the assistant drafted from a call note. One line says where the draft came from, why a
 * field is blank and that nothing is saved yet; "What the assistant saw" opens the note exactly as it was sent,
 * with identity taken out, and the three limits that never change. It sits inside the plum `help-assistant` line.
 *
 * The note is fetched only when the sheet is opened. A draft the assistant could not check was made by rules alone, and the sheet says so.
 */
export function AssistantLimits({ callId, verification, notes, sealed = false }: { callId: Id<"calls">; verification: "checked" | "review"; notes: string[]; sealed?: boolean }) {
  const { words, data } = useWorkspace();
  const text = words.assistant;
  const [open, setOpen] = useState(false);
  const id = useId();
  // A line the backend wrote in English is said in the reader's language; one this table does not know stays as written.
  const said = notes.map((line) => {
    const key = noteKeys.find((name) => draftNotes[name] === line);
    return key ? text.notes[key] : line;
  });
  const removed: Record<string, string> = text.removed;
  const checked = verification === "checked";
  const sent = useQuery(api.drafts.noteAsSent, open && checked ? { churchId: data.church.id as Id<"churches">, callId } : "skip");
  const read = sent?.replace(/\[(name|phone|email|address|date)\]/g, (_: string, kind: string) => `[${removed[kind]}]`);
  return (
    <span className="block min-w-0">
      {text.written} {checked ? text.checked : text.review} {said.join(" ")} {!sealed && text.unsaved}{" "}
      <button
        type="button"
        className="-my-2.5 inline-flex min-h-11 cursor-pointer items-center border-0 bg-transparent p-0 text-inherit underline decoration-[#cfc5dc] underline-offset-4 hover:decoration-current"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
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
