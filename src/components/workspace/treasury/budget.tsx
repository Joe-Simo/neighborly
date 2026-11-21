"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "@/components/workspace/query";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LiveField } from "@/components/workspace/primitives";
import { LiveFailure, LiveWaiting } from "@/components/workspace/states";
import { useWorkspace } from "@/components/workspace/context";
import { useSave } from "@/components/workspace/use-save";
import { monthTitle } from "@/components/workspace/treasury/labels";
import { formatMoney, type Language } from "@/lib/words";

/** Only the treasury carries these words, so no other room pays for them. */
const said = {
  en: {
    line: (approved: string, budget: string) => `${approved} of ${budget} approved`,
    none: (approved: string) => `${approved} approved`,
    deck: (month: string) => `${month}, against the monthly budget.`,
    noDeck: (month: string) => `${month}. No monthly budget is set.`,
    set: "Set a monthly budget", change: "Change the budget", label: "Monthly budget",
    help: "Leave it empty for no budget.", wrong: "Write the budget in dollars, such as 2000.", save: "Save budget", cancel: "Cancel",
  },
  es: {
    line: (approved: string, budget: string) => `${approved} de ${budget} aprobados`,
    none: (approved: string) => `${approved} aprobados`,
    deck: (month: string) => `${month}, frente al presupuesto mensual.`,
    noDeck: (month: string) => `${month}. No hay presupuesto mensual.`,
    set: "Fijar un presupuesto mensual", change: "Cambiar el presupuesto", label: "Presupuesto mensual",
    help: "Déjalo vacío para no tener presupuesto.", wrong: "Escribe el presupuesto en dólares, como 2000.", save: "Guardar presupuesto", cancel: "Cancelar",
  },
} satisfies Record<Language, unknown>;

/** The month's approved help against the group's monthly budget, and the one place the budget is set. */
export default function BudgetLine({ churchId, today }: { churchId: Id<"churches">; today: string }) {
  const locale = useWorkspace().words.locale;
  const w = said[locale];
  const month = today.slice(0, 7);
  const found = useQuery(api.treasury.budget, { churchId, month });
  const setBudget = useMutation(api.treasury.setBudget);
  const [editing, setEditing] = useState(false);
  // The button gives way to the form and comes back for it: focus goes with each, so it is never left on nothing.
  const opener = useRef<HTMLButtonElement>(null);
  const was = useRef(editing);
  useEffect(() => {
    if (was.current && !editing) opener.current?.focus();
    was.current = editing;
  }, [editing]);
  const { pending, error, save } = useSave();
  if (!found) return null;
  const money = (cents: number) => formatMoney(cents / 100, locale, cents % 100 === 0);
  const title = monthTitle(locale, month, today);
  return (
    <section className="treasury-budget" aria-label={w.label}>
      <div aria-live="polite">
        <h2>{found.budget ? w.line(money(found.approved), money(found.budget)) : w.none(money(found.approved))}</h2>
        <p>{found.budget ? w.deck(title) : w.noDeck(title)}</p>
      </div>
      {editing ? (
        <form
          className="live-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const field = event.currentTarget.elements.namedItem("budget") as HTMLInputElement;
            const typed = field.value.replace(/[$,\s]/g, "");
            const dollars = typed ? Number(typed) : null;
            if (dollars !== null && !(Number.isInteger(dollars) && dollars > 0)) {
              field.setCustomValidity(w.wrong);
              field.reportValidity();
              return;
            }
            const outcome = await save(() => setBudget({ churchId, budget: dollars === null ? null : dollars * 100 }));
            if (outcome.saved) setEditing(false);
          }}
        >
          <LiveField label={w.label} help={w.help}>
            <Input name="budget" inputMode="numeric" autoFocus defaultValue={found.budget ? String(found.budget / 100) : ""} onInput={(event) => event.currentTarget.setCustomValidity("")} />
          </LiveField>
          {error && <LiveFailure message={error} />}
          <div className="live-form-actions">
            <LiveWaiting when={pending} />
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setEditing(false)}>{w.cancel}</Button>
            <Button type="submit" disabled={pending}>{w.save}</Button>
          </div>
        </form>
      ) : (
        <Button ref={opener} type="button" variant="outline" onClick={() => setEditing(true)}>{found.budget ? w.change : w.set}</Button>
      )}
    </section>
  );
}
