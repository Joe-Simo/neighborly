"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useWorkspace } from "@/components/workspace/context";
import { fill } from "@/lib/words/fill";
import { LiveField } from "@/components/workspace/primitives";
import type { NeighborRecord } from "@/components/workspace/help-line/format";

/**
 * Each adult's work and, with a job, the place: drawn on the record and asked on the household form. Its own chunk,
 * words and all, so the rooms' first load does not carry it. Every sentence is written whole in each language.
 */
const en = {
  work: "Work",
  workAt: "{work} at {place}",
  workNotAsked: "Not asked",
  works: { fullTime: "Works full time", partTime: "Works part time", looking: "Looking for work", unable: "Not able to work", retired: "Retired" },
  employer: "Where",
  employerHint: "Only the place, if they say",
};
const es: typeof en = {
  work: "Trabajo",
  workAt: "{work} en {place}",
  workNotAsked: "Sin preguntar",
  works: { fullTime: "Trabaja tiempo completo", partTime: "Trabaja medio tiempo", looking: "Busca trabajo", unable: "No puede trabajar", retired: "Se jubiló" },
  employer: "Dónde",
  employerHint: "Solo el lugar, si lo dice",
};

export type Work = NonNullable<NeighborRecord["household"][number]["work"]>;
/** The kinds of work in the order the form offers them. */
const workKinds: Work[] = ["fullTime", "partTime", "looking", "unable", "retired"];
const workValue = (value: string): Work | "" => workKinds.find((kind) => kind === value) ?? "";
/** Work is asked of adults: by the birth year when there is one, else by the question. */
const adultNow = (person: { child: boolean; born: string }) =>
  /^\d{4}$/.test(person.born.trim()) ? new Date().getFullYear() - Number(person.born.trim()) >= 18 : !person.child;

/** The record's line of who works and where, under who lives here. */
export function WorkRow({ household, change }: { household: NeighborRecord["household"]; change: ReactNode }) {
  const { words, sampleSaid } = useWorkspace();
  const text = words.locale === "es" ? es : en;
  return (
    <div>
      <dt>{text.work}</dt>
      <dd>
        <ul className="help-accounts">
          {household.map((person, index) =>
            person.work ? (
              <li key={index}>
                {sampleSaid(person.relationship)}
                <span>{person.employer ? fill(text.workAt, { work: text.works[person.work], place: sampleSaid(person.employer) }) : text.works[person.work]}</span>
              </li>
            ) : null,
          )}
        </ul>
      </dd>
      {change}
    </div>
  );
}

type Line = { child: boolean; born: string; work: Work | ""; employer: string };
/** The household form's work question for one adult, and the place when they have a job. */
export function WorkFields({ person, set }: { person: Line; set: (change: Partial<Line>) => void }) {
  const text = useWorkspace().words.locale === "es" ? es : en;
  if (!adultNow(person)) return null;
  return (
    <div className="help-work">
      <LiveField label={text.work}>
        <NativeSelect className="w-full" value={person.work} onChange={(event) => set({ work: workValue(event.target.value) })}>
          <option value="">{text.workNotAsked}</option>
          {workKinds.map((kind) => (
            <option key={kind} value={kind}>{text.works[kind]}</option>
          ))}
        </NativeSelect>
      </LiveField>
      {(person.work === "fullTime" || person.work === "partTime") && (
        <LiveField label={text.employer}>
          <Input value={person.employer} maxLength={80} placeholder={text.employerHint} onChange={(event) => set({ employer: event.target.value })} />
        </LiveField>
      )}
    </div>
  );
}
