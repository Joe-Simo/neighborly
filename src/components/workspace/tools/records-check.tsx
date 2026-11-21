"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { useQuery } from "@/components/workspace/query";
import { recordHref } from "@/components/workspace/help-line/format";

/** Only this leaf's words, in both languages, so they load with it. */
const said = {
  en: {
    title: "Check for doubles",
    deck: "Members who may have signed up twice, and phone numbers several households give under different names. Read by code only.",
    run: "Check records",
    checking: "Checking…",
    none: "Nothing to look at. No member appears twice, and no phone is shared under different names.",
    people: "Maybe one person signed up twice",
    phones: "One phone, different households",
    by: { email: "Same email", name: "Similar name" },
    fine: "They are different",
    fineThis: (what: string) => `${what}: they are different`,
    found: (n: number) => (n === 1 ? "1 to look at." : `${n} to look at.`),
    people_: "Open People",
  },
  es: {
    title: "Buscar duplicados",
    deck: "Miembros que quizá se inscribieron dos veces, y teléfonos que varios hogares dan con nombres distintos. Solo lo revisa el código.",
    run: "Revisar registros",
    checking: "Revisando…",
    none: "No hay nada que revisar. Ningún miembro aparece dos veces y ningún teléfono se comparte con nombres distintos.",
    people: "Quizá una persona se inscribió dos veces",
    phones: "Un teléfono, hogares distintos",
    by: { email: "Mismo correo", name: "Nombre parecido" },
    fine: "Son distintos",
    fineThis: (what: string) => `${what}: son distintos`,
    found: (n: number) => (n === 1 ? "1 para revisar." : `${n} para revisar.`),
    people_: "Abrir Personas",
  },
} as const;

/** Asked only when pressed: it reads every member and household of the conference once. */
export function RecordsCheck() {
  const { data, words } = useWorkspace();
  const w = said[words.locale === "es" ? "es" : "en"];
  const churchId = data.church.id;
  const [asked, setAsked] = useState(false);
  const found = useQuery(api.duplicates.recordsCheck, asked ? { churchId } : "skip");
  const dismiss = useMutation(api.duplicates.dismissCheck);
  // Pressed, the button waits and then goes: focus goes to the leaf's name and the answer is said when it comes, so neither is lost.
  const name = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (asked) name.current?.focus();
  }, [asked]);
  const count = found ? found.people.length + found.phones.length : 0;
  const fine = (kind: "person" | "phone", key: string, what: string) => (
    <Button variant="link" className="help-text-action" aria-label={w.fineThis(what)} onClick={() => void dismiss({ churchId, kind, key }).catch(() => null)}>
      {w.fine}
    </Button>
  );
  return (
    <section className="tools-leaf tools-leaf-wide paper-corner" aria-labelledby="records-check-name">
      <h2 id="records-check-name" ref={name} tabIndex={-1}>{w.title}</h2>
      <p className="tools-leaf-deck">{w.deck}</p>
      <p className="sr-only" role="status">{!found ? "" : count ? w.found(count) : w.none}</p>
      {!found ? (
        <div className="help-actions">
          <Button variant="outline" disabled={asked} onClick={() => setAsked(true)}>{asked ? w.checking : w.run}</Button>
        </div>
      ) : !found.people.length && !found.phones.length ? (
        <p className="tools-done" aria-hidden="true">{w.none}</p>
      ) : (
        <>
          {found.people.length > 0 && (
            <>
              <h3>{w.people}</h3>
              <div className="live-list">
                {found.people.map((row) => (
                  <div className="help-row" data-plain key={row.key}>
                    <div>
                      <p>{`${row.first.name} · ${row.first.email}`}</p>
                      <p>{`${row.second.name} · ${row.second.email}`}</p>
                      <p>{row.sameBy.map((by) => w.by[by]).join(" · ")}</p>
                    </div>
                    <div className="live-row-actions">
                      <Link className="live-link" href="/app/people">{w.people_}</Link>
                      {fine("person", row.key, `${row.first.name}, ${row.second.name}`)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {found.phones.length > 0 && (
            <>
              <h3>{w.phones}</h3>
              <div className="live-list">
                {found.phones.map((row) => (
                  <div className="help-row" data-plain key={row.key}>
                    <div>
                      <p className="help-tel">{row.phone}</p>
                      {row.households.map((home) => (
                        <p key={home.id}>
                          <Link className="live-link" href={recordHref(home.id)}>{home.name}</Link>
                          {home.address && ` · ${home.address}`}
                        </p>
                      ))}
                    </div>
                    <div className="live-row-actions">{fine("phone", row.key, row.phone)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
