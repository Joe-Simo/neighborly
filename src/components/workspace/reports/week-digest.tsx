"use client";

import Link from "next/link";
import { useMutation } from "convex/react";
import { Mail } from "lucide-react";
import { useHour, useQuery } from "@/components/workspace/query";
import { api } from "../../../../convex/_generated/api";
import { Toggle } from "@/components/ui/toggle";
import { useWorkspace } from "@/components/workspace/context";
import { recordHref } from "@/components/workspace/help-line/format";
import { formatMoney, type Language } from "@/lib/words";
import "@/components/workspace/reports/week-digest.css";

type Kind = "rent" | "utility" | "food" | "voucher" | "other";

/** Only this page carries these words; it loads after the year's report, for the people who decide. */
const said = {
  en: {
    title: "This week",
    waiting: (n: number) => (n === 0 ? "No request is waiting on a decision." : n === 1 ? "1 request is waiting on a decision." : `${n} requests are waiting on a decision.`),
    days: (n: number) => (n === 0 ? "today" : n === 1 ? "1 day" : `${n} days`),
    recent: "Same-kind help in the 90 days before",
    sameAmount: "The same amount asked in the 60 days before",
    month: (month: string, approved: string, budget: string, before: string) => `Approved in ${month}: ${approved}${budget && ` of the ${budget} budget`}. ${month} last year: ${before}.`,
    none: "none",
    overdue: (n: number) => (n === 0 ? "No callback is overdue." : n === 1 ? "1 call has waited two days or more for a callback." : `${n} calls have waited two days or more for a callback.`),
    with: (name: string) => `with ${name}`,
    noName: "No name given",
    more: (n: number) => `and ${n} more`,
    email: "Email me this on Monday mornings",
    kinds: { rent: "Rent", utility: "Utility", food: "Food", voucher: "Voucher", other: "Other" } satisfies Record<Kind, string>,
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  },
  es: {
    title: "Esta semana",
    waiting: (n: number) => (n === 0 ? "Ninguna petición espera una decisión." : n === 1 ? "1 petición espera una decisión." : `${n} peticiones esperan una decisión.`),
    days: (n: number) => (n === 0 ? "hoy" : n === 1 ? "1 día" : `${n} días`),
    recent: "Ayuda del mismo tipo en los 90 días anteriores",
    sameAmount: "La misma cantidad pedida en los 60 días anteriores",
    month: (month: string, approved: string, budget: string, before: string) => `Aprobado en ${month}: ${approved}${budget && ` de un presupuesto de ${budget}`}. En ${month} del año pasado: ${before}.`,
    none: "nada",
    overdue: (n: number) => (n === 0 ? "Ninguna llamada espera respuesta con retraso." : n === 1 ? "1 llamada espera respuesta desde hace dos días o más." : `${n} llamadas esperan respuesta desde hace dos días o más.`),
    with: (name: string) => `con ${name}`,
    noName: "Sin nombre",
    more: (n: number) => `y ${n} más`,
    email: "Enviármelo por correo los lunes por la mañana",
    kinds: { rent: "Renta", utility: "Servicios", food: "Comida", voucher: "Vales", other: "Otra ayuda" } satisfies Record<Kind, string>,
    months: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  },
} satisfies Record<Language, unknown>;

/** The week for the people who decide, from the records alone: what waits on them, the month's money, and calls owed. */
export default function WeekDigest() {
  const { data, words } = useWorkspace();
  const locale = words.locale;
  const w = said[locale];
  const churchId = data.church.id;
  const at = useHour();
  const allowed = useQuery(api.access.canOpenNeighborRecords, { churchId });
  const found = useQuery(api.digest.week, allowed && at ? { churchId, at } : "skip");
  const setEmail = useMutation(api.digest.setDigestEmail);
  if (!found) return null;
  const { waiting, month, overdue } = found.digest;
  const money = (cents: number) => formatMoney(cents / 100, locale, cents % 100 === 0);
  const name = w.months[month.month - 1];
  return (
    <section className="week-digest" aria-labelledby="week-digest-title">
      <h2 id="week-digest-title">{w.title}</h2>
      <p>{w.month(name, money(month.approved), month.budget ? money(month.budget) : "", month.lastYear ? money(month.lastYear) : w.none)}</p>
      <p>{w.waiting(waiting.count)}</p>
      {waiting.rows.length > 0 && (
        <ul>
          {waiting.rows.map((row) => (
            <li key={row.requestId}>
              <Link href={recordHref(row.neighborId)}>{row.name}</Link>
              <span>{` · ${w.kinds[row.kind]} · ${money(row.amount)} · ${w.days(row.days)}`}</span>
              {row.repeat && <small>{row.repeat === "recent" ? w.recent : w.sameAmount}</small>}
            </li>
          ))}
          {waiting.count > waiting.rows.length && <li>{w.more(waiting.count - waiting.rows.length)}</li>}
        </ul>
      )}
      <p>{w.overdue(overdue.count)}</p>
      {overdue.rows.length > 0 && (
        <ul>
          {overdue.rows.map((row) => (
            <li key={row.callId}>
              <Link href="/app/help-line">{row.name || w.noName}</Link>
              <span>{` · ${w.days(row.days)}${row.owner ? ` · ${w.with(row.owner)}` : ""}`}</span>
            </li>
          ))}
          {overdue.count > overdue.rows.length && <li>{w.more(overdue.count - overdue.rows.length)}</li>}
        </ul>
      )}
      <Toggle variant="outline" pressed={found.emailed} onPressedChange={(on) => void setEmail({ churchId, on })}>
        <Mail aria-hidden="true" />
        {w.email}
      </Toggle>
    </section>
  );
}
