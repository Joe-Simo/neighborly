"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { useQuery } from "@/components/workspace/query";
import { LiveDialog, SheetCancel } from "@/components/workspace/live-dialog";
import { LiveFailure, LiveWaiting } from "@/components/workspace/states";
import { sayFailure } from "@/components/workspace/failure";
import { useSave } from "@/components/workspace/help-line/use-save";
import { recordHref } from "@/components/workspace/help-line/format";
import { heldOutFigure } from "@/lib/duplicate-set";
import run3 from "../../../../eval/duplicates/run-3.json";

/** What the record quotes: the held-out pairs of run 3, the live question and rule measured after they went live. */
const figure = heldOutFigure(run3);

type Figure = ReturnType<typeof heldOutFigure>;
type Moved = { calls: number; requests: number; visits: number; ledger: number; notes: number };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Only this sheet's words, in both languages, so they load with it and with no other room. */
const said = {
  en: {
    title: "Maybe the same household",
    count: (n: number) => (n === 1 ? "1 record" : `${n} records`),
    by: { phone: "Same phone", address: "Same address", name: "Similar name" },
    notes: "The assistant reads both records' notes as one household.",
    measured: (f: Figure) => `Measured on ${f.pairs} made-up pairs kept apart from the ones its line was set on: ${f.right} right, ${f.missed} missed, ${f.wrong} wrong. A small test.`,
    people: (adults: number, children: number) => `${adults} ${adults === 1 ? "adult" : "adults"}, ${children} ${children === 1 ? "child" : "children"}`,
    merge: "Merge into this record",
    mergeThis: (name: string) => `Merge into this record: ${name}`,
    notSame: "Not the same",
    notSameThis: (name: string) => `Not the same: ${name}`,
    sheet: (name: string) => `Merge ${name} into this record`,
    moves: "What moves here",
    movesDetail: "Every call, request, home visit, note and ledger line on the other record. Its phone, email or address fills any that this record leaves empty, and its notes are added under these.",
    goes: "What goes",
    goesDetail: "The other record. The yearly figures count this household once.",
    final: "A merge cannot be undone.",
    kept: "Nothing was merged.",
    confirm: "Merge records",
    merged: (name: string) => `${name} is merged into this record.`,
    counting: "Counting what moves…",
    moving: (m: Moved) => [plural(m.calls, "call", "calls"), plural(m.requests, "request", "requests"), plural(m.visits, "home visit", "home visits"), plural(m.ledger, "ledger line", "ledger lines"), plural(m.notes, "note", "notes")].join(", "),
    history: "Merged into this record",
    mergedBy: (name: string, who: string, when: string) => `${name}, merged by ${who} on ${when}.`,
  },
  es: {
    title: "Quizá el mismo hogar",
    count: (n: number) => (n === 1 ? "1 registro" : `${n} registros`),
    by: { phone: "Mismo teléfono", address: "Misma dirección", name: "Nombre parecido" },
    notes: "El asistente lee las notas de ambos registros como un solo hogar.",
    measured: (f: Figure) => `Medido con ${f.pairs} pares inventados, apartados de los que se usaron para fijar su línea: ${f.right} bien, ${f.missed} sin detectar, ${f.wrong} mal. Es una prueba pequeña.`,
    people: (adults: number, children: number) => `${adults} ${adults === 1 ? "adulto" : "adultos"}, ${children} ${children === 1 ? "niño" : "niños"}`,
    merge: "Unir a este registro",
    mergeThis: (name: string) => `Unir a este registro: ${name}`,
    notSame: "No es el mismo",
    notSameThis: (name: string) => `No es el mismo: ${name}`,
    sheet: (name: string) => `Unir ${name} a este registro`,
    moves: "Lo que pasa aquí",
    movesDetail: "Cada llamada, petición, visita, nota y línea del libro del otro registro. Su teléfono, correo o dirección llena lo que este registro deja vacío, y sus notas se añaden debajo de estas.",
    goes: "Lo que se va",
    goesDetail: "El otro registro. Las cifras del año cuentan este hogar una sola vez.",
    final: "Una unión no se puede deshacer.",
    kept: "No se unió nada.",
    confirm: "Unir registros",
    merged: (name: string) => `El registro de ${name} se unió a este.`,
    counting: "Contando lo que pasa…",
    moving: (m: Moved) => [plural(m.calls, "llamada", "llamadas"), plural(m.requests, "petición", "peticiones"), plural(m.visits, "visita", "visitas"), plural(m.ledger, "línea del libro", "líneas del libro"), plural(m.notes, "nota", "notas")].join(", "),
    history: "Unidos a este registro",
    mergedBy: (name: string, who: string, when: string) => `Registro de ${name}, unido por ${who} el ${when}.`,
  },
} as const;

type Shown = { id: Id<"neighbors">; name: string };

/**
 * Under a neighbor's record: other records that may be the same household, found by code, with the assistant's reading
 * of the notes where it agrees. A person merges one into this record or says it is not the same; nothing happens alone.
 */
export function PossibleSame({ neighborId, onMerged }: { neighborId: Id<"neighbors">; onMerged: (said: string) => void }) {
  const { data, words } = useWorkspace();
  const w = said[words.locale === "es" ? "es" : "en"];
  const churchId = data.church.id;
  const found = useQuery(api.duplicates.forRecord, { churchId, neighborId });
  const readPair = useAction(api.duplicates.readPair);
  // Each pair's notes are asked about once per opening, one after another; the answer comes back through the query.
  const asked = useRef(new Set<string>());
  const unread = found?.unread.join(" ") ?? "";
  useEffect(() => {
    const fresh = unread.split(" ").filter((id) => id && !asked.current.has(id)) as Id<"neighbors">[];
    for (const id of fresh) asked.current.add(id);
    void (async () => {
      for (const otherId of fresh) await readPair({ churchId, neighborId, otherId }).catch(() => null);
    })();
  }, [unread, churchId, neighborId, readPair]);
  return (
    <>
      {found?.shown.length ? <Candidates found={found.shown} w={w} neighborId={neighborId} onMerged={onMerged} /> : null}
      <Merged neighborId={neighborId} w={w} />
    </>
  );
}

/** Who merged which record into this one, and when: the record's own trail of its merges. */
function Merged({ neighborId, w }: { neighborId: Id<"neighbors">; w: Words }) {
  const { data, format, sampleSaid } = useWorkspace();
  const merges = useQuery(api.duplicates.merges, { churchId: data.church.id, neighborId });
  if (!merges?.length) return null;
  return (
    <section className="live-section" aria-labelledby="merged-here">
      <div className="live-section-head">
        <h2 id="merged-here">{w.history}</h2>
      </div>
      <div className="live-list">
        {merges.map((merge) => (
          <div className="help-row" data-plain key={merge.at}>
            <div>
              <p>{w.mergedBy(sampleSaid(merge.name), merge.who, format(merge.at, { weekday: undefined, year: "numeric" }))}</p>
              <p>{w.moving(merge.moved)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

type Words = (typeof said)["en" | "es"];
type Candidate = { id: Id<"neighbors">; name: string; address: string; adults: number; children: number; sameBy: ("phone" | "address" | "name")[]; notesAgree: boolean };

function Candidates({ found, w, neighborId, onMerged }: { found: Candidate[]; w: Words; neighborId: Id<"neighbors">; onMerged: (said: string) => void }) {
  const { data, sampleSaid, words } = useWorkspace();
  const churchId = data.church.id;
  const dismiss = useMutation(api.duplicates.dismiss);
  const [merging, setMerging] = useState<Shown | null>(null);
  // A "not the same" that does not go through is said under the list, and the pair stays for another try.
  const [refused, setRefused] = useState("");
  const notSame = (otherId: Id<"neighbors">) => {
    setRefused("");
    dismiss({ churchId, neighborId, otherId }).catch((cause: unknown) => setRefused(sayFailure(words.notices, cause, words.states.notSaved, words.states.offlineSave)));
  };
  return (
    <section className="live-section" aria-labelledby="possible-same">
      <div className="live-section-head">
        <h2 id="possible-same">{w.title}</h2>
        <span className="live-count">{w.count(found.length)}</span>
      </div>
      <div className="live-list">
        {found.map((row) => (
          <div className="help-row" data-plain key={row.id}>
            <div>
              <h3>
                <Link className="live-link" href={recordHref(row.id)} scroll={false}>
                  {sampleSaid(row.name)}
                </Link>
              </h3>
              <p>{[row.address && sampleSaid(row.address), w.people(row.adults, row.children)].filter(Boolean).join(" · ")}</p>
              <p>{row.sameBy.map((by) => w.by[by]).join(" · ")}</p>
              {row.notesAgree && <p className="help-why">{w.notes}</p>}
            </div>
            <div className="live-row-actions">
              <Button variant="outline" aria-label={w.mergeThis(sampleSaid(row.name))} onClick={() => setMerging(row)}>
                {w.merge}
              </Button>
              <Button
                variant="link"
                className="help-text-action"
                aria-label={w.notSameThis(sampleSaid(row.name))}
                onClick={() => notSame(row.id)}
              >
                {w.notSame}
              </Button>
            </div>
          </div>
        ))}
      </div>
      {refused && <LiveFailure message={refused} kept="" />}
      {found.some((row) => row.notesAgree) && <p className="help-form-note">{w.measured(figure)}</p>}
      {merging && (
        <LiveDialog title={w.sheet(sampleSaid(merging.name))} onClose={() => setMerging(null)}>
          <MergeForm
            neighborId={neighborId}
            other={merging}
            w={w}
            onMerged={() => {
              setMerging(null);
              onMerged(w.merged(sampleSaid(merging.name)));
            }}
          />
        </LiveDialog>
      )}
    </section>
  );
}

function MergeForm({ neighborId, other, w, onMerged }: { neighborId: Id<"neighbors">; other: Shown; w: Words; onMerged: () => void }) {
  const { data } = useWorkspace();
  const moving = useQuery(api.duplicates.mergeCounts, { churchId: data.church.id, otherId: other.id });
  const merge = useMutation(api.duplicates.merge);
  const { pending, error, save } = useSave();
  return (
    <form
      className="live-form help-form help-for-good"
      onSubmit={async (event) => {
        event.preventDefault();
        const outcome = await save(() => merge({ churchId: data.church.id, neighborId, otherId: other.id }));
        if (outcome.saved) onMerged();
      }}
    >
      <dl className="for-good-terms">
        <div>
          <dt>{w.moves}</dt>
          <dd>
            {/* The counts stand on their own line: run into the sentence after them, they read as one unpunctuated line. */}
            <strong className="block">{moving ? w.moving(moving) : w.counting}</strong>
            {w.movesDetail}
          </dd>
        </div>
        <div>
          <dt>{w.goes}</dt>
          <dd>{w.goesDetail}</dd>
        </div>
      </dl>
      <p className="help-form-note">{w.final}</p>
      {error && <LiveFailure message={error} kept={w.kept} />}
      <div className="live-form-actions">
        <LiveWaiting when={pending} />
        <SheetCancel disabled={pending} />
        <Button type="submit" disabled={pending || !moving}>
          {w.confirm}
        </Button>
      </div>
    </form>
  );
}
