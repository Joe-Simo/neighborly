"use client";

import Link from "next/link";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { useHour, useQuery } from "@/components/workspace/query";
import { useWorkspace } from "@/components/workspace/context";
import { useFirstLook } from "@/components/workspace/first-look";
import { formatDate, formatMoney, type Language } from "@/lib/words";
import { upcomingCommitments } from "@/lib/commitment-visibility";
import "@/components/workspace/glance/glance.css";

type Home = FunctionReturnType<typeof api.glance.home>;
type Conference = NonNullable<Home["conference"]>;

/** Only this part of the week carries these words. Fixed words around counts from the records; nothing here is the assistant's. */
const said = {
  en: {
    yours: "Yours",
    whole: "The conference at a glance",
    visits: "Yours this week",
    visitsLine: (next: string) => (next ? `Next ${next}` : "Nothing of yours in the next 7 days"),
    asks: (n: number) => (n ? `${n} home visit${n === 1 ? "" : "s"} waiting for your answer` : ""),
    tasks: "Your tasks",
    tasksLine: (late: number) => (late ? `${late} past due` : "None past due"),
    callbacks: "Callbacks two days late",
    callbackLine: (owed: number, mine: number) => [`${owed} owed in all`, mine ? `${mine} yours` : ""].filter(Boolean).join(" · "),
    month: (name: string) => `Help in ${name}`,
    budget: (budget: string, spent: number, day: number) => `${spent}% of ${budget}, ${day}% through the month`,
    noBudget: "No monthly budget set",
    lastYear: (amount: string) => `${amount} the same month last year`,
    year: (year: number) => `Help, fiscal ${year}`,
    byNow: (amount: string) => `Last year by now: ${amount}`,
    households: "Households approved for help",
    unwritten: "Past visits not written up",
    dueLine: (n: number) => (n === 1 ? "1 more planned this week" : `${n} more planned this week`),
    volunteers: "Active members",
    away: (names: string[]) => (names.length ? `Away today: ${names.join(", ")}` : "Nobody away today"),
    balance: "Treasury balance",
    balanceLine: "Every ledger entry added up",
    balanceLong: "The ledger is too long to add up here; Treasury shows it",
    flags: "Assistant's marks for you",
    flagLine: (urgent: number, drafts: number, doubles: number) => [urgent ? `${urgent} urgent call${urgent === 1 ? "" : "s"}` : "", drafts ? `${drafts} draft${drafts === 1 ? "" : "s"} to check` : "", doubles ? `${doubles} possible double${doubles === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ") || "Nothing to check",
    council: (name: string, n: number) => `${name}, ${n} conference${n === 1 ? "" : "s"}`,
    councilLine: (households: number, paid: string, visits: number, updating: boolean) => `${households} households, ${paid} paid, ${visits} visits this fiscal year${updating ? " (being added up)" : ""}`,
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  },
  es: {
    yours: "Lo tuyo",
    whole: "La conferencia de un vistazo",
    visits: "Lo tuyo esta semana",
    visitsLine: (next: string) => (next ? `Lo próximo: ${next}` : "Nada tuyo en los próximos 7 días"),
    asks: (n: number) => (n ? `${n} visita${n === 1 ? "" : "s"} esperan tu respuesta` : ""),
    tasks: "Tus tareas",
    tasksLine: (late: number) => (late ? `${late} con la fecha pasada` : "Ninguna con la fecha pasada"),
    callbacks: "Llamadas con dos días de retraso",
    callbackLine: (owed: number, mine: number) => [`${owed} por devolver en total`, mine ? `${mine} tuyas` : ""].filter(Boolean).join(" · "),
    month: (name: string) => `Ayuda en ${name}`,
    budget: (budget: string, spent: number, day: number) => `${spent} % de ${budget}, ${day} % del mes transcurrido`,
    noBudget: "Sin presupuesto mensual",
    lastYear: (amount: string) => `${amount} el mismo mes del año pasado`,
    year: (year: number) => `Ayuda, año fiscal ${year}`,
    byNow: (amount: string) => `El año pasado a estas alturas: ${amount}`,
    households: "Hogares con ayuda aprobada",
    unwritten: "Visitas pasadas sin anotar",
    dueLine: (n: number) => (n === 1 ? "1 más prevista esta semana" : `${n} más previstas esta semana`),
    volunteers: "Miembros activos",
    away: (names: string[]) => (names.length ? `Fuera hoy: ${names.join(", ")}` : "Nadie fuera hoy"),
    balance: "Saldo de tesorería",
    balanceLine: "La suma de todo el libro",
    balanceLong: "El libro es demasiado largo para sumarlo aquí; Tesorería lo muestra",
    flags: "Avisos del asistente para ti",
    flagLine: (urgent: number, drafts: number, doubles: number) => [urgent ? `${urgent} llamada${urgent === 1 ? "" : "s"} urgente${urgent === 1 ? "" : "s"}` : "", drafts ? `${drafts} borrador${drafts === 1 ? "" : "es"} por revisar` : "", doubles ? `${doubles} posible${doubles === 1 ? "" : "s"} duplicado${doubles === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ") || "Nada que revisar",
    council: (name: string, n: number) => `${name}, ${n} conferencia${n === 1 ? "" : "s"}`,
    councilLine: (households: number, paid: string, visits: number, updating: boolean) => `${households} hogares, ${paid} pagados, ${visits} visitas este año fiscal${updating ? " (sumándose)" : ""}`,
    months: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  },
} satisfies Record<Language, unknown>;
type Said = (typeof said)[Language];

type Tile = { href: string; label: string; figure: string; line: string | string[]; waits?: boolean; share?: { spent: number; day: number } };

function TileLink({ tile }: { tile: Tile }) {
  return (
    <Link href={tile.href} data-waits={tile.waits ? "" : undefined}>
      <span>{tile.label}</span>
      <span className="count-up">{tile.figure}</span>
      {tile.share && (
        // The month's money against the month's days: the fill is what is approved of the budget, the tick is today.
        <span className="glance-pace" aria-hidden="true" style={{ "--spent": `${Math.min(100, tile.share.spent)}%`, "--day": `${tile.share.day}%` } as React.CSSProperties} />
      )}
      <small>{[tile.line].flat().map((part) => <span key={part}>{part}</span>)}</small>
    </Link>
  );
}

function conferenceTiles(c: Conference, w: Said, money: (cents: number) => string): Tile[] {
  const spent = c.month.budget ? Math.round((c.month.approved.now / c.month.budget) * 100) : 0;
  const day = Math.round((c.month.day / c.month.days) * 100);
  const flags = c.flags.urgent + c.flags.drafts + c.flags.doubles;
  return [
    // The week's figures above already count calls waiting, visits planned and requests open: these say what they do not.
    { href: "/app/help-line?late=1", label: w.callbacks, figure: `${c.callbacks.late}`, line: w.callbackLine(c.callbacks.owed, c.callbacks.mine), waits: c.callbacks.late > 0 },
    { href: "/app/help-line", label: w.flags, figure: `${flags}`, line: w.flagLine(c.flags.urgent, c.flags.drafts, c.flags.doubles), waits: flags > 0 },
    { href: "/app/visits#to-write-up", label: w.unwritten, figure: `${c.visits.late}`, line: w.dueLine(c.visits.due), waits: c.visits.late > 0 },
    {
      href: "/app/treasury", label: w.month(w.months[c.month.month - 1] ?? ""), figure: money(c.month.approved.now),
      line: [c.month.budget ? w.budget(money(c.month.budget), spent, day) : w.noBudget, w.lastYear(money(c.month.approved.before))],
      share: c.month.budget ? { spent, day } : undefined,
    },
    { href: "/app/reports", label: w.year(c.year.fiscalYear), figure: money(c.year.approved.now), line: w.byNow(money(c.year.approved.before)) },
    { href: "/app/reports", label: w.households, figure: `${c.year.households.now}`, line: w.byNow(`${c.year.households.before}`) },
    { href: "/app/treasury", label: w.balance, figure: c.balance === null ? "—" : money(c.balance), line: c.balance === null ? w.balanceLong : w.balanceLine },
    { href: "/app/people", label: w.volunteers, figure: `${c.volunteers.active}`, line: w.away(c.volunteers.away) },
  ];
}

/**
 * The home's glance, under the week's note: for everyone, their own visits and tasks; for whoever may open neighbor
 * records, the whole conference; for a council's owner, the council's year. Each figure opens the room it is dealt with in.
 * Until it arrives its place is held unseen, so nothing under it moves when it lands.
 */
export function Glance({ quiet = false }: { quiet?: boolean }) {
  const { data, words, now } = useWorkspace();
  const look = useFirstLook();
  const at = useHour();
  const home = useQuery(api.glance.home, at && !look ? { churchId: data.church.id, at } : "skip");
  if (look) return null;
  if (!home) return <><span hidden data-room-pending="" /><div className="glance glance-held" aria-hidden="true" /></>;
  const locale = words.locale;
  const w = said[locale];
  const money = (cents: number) => formatMoney(cents / 100, locale, true);
  const { own, conference, councils } = home;
  // A group in its first days stays on its first-week state until the conference holds anything to count.
  if (quiet && !councils.length && own.tasks + own.visitAsks === 0 && (!conference || (conference.callbacks.owed + conference.year.approved.now + conference.visits.due + conference.visits.late === 0 && !conference.balance))) return null;
  // The same list Coming up reads, cut the same way, so the two always agree.
  const week = upcomingCommitments(data.commitments, now).filter((item) => item.assigneeId === data.user.id && item.start <= now + 7 * 86_400_000);
  const next = week[0];
  const when = next ? formatDate(locale, next.start, { timeZone: data.church.timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  const mine: Tile[] = [
    { href: "/app/mine", label: w.visits, figure: `${week.length}`, line: [w.visitsLine(when), w.asks(own.visitAsks)].filter(Boolean).join(" · "), waits: own.visitAsks > 0 },
    { href: "/app/tasks", label: w.tasks, figure: `${own.tasks}`, line: w.tasksLine(own.tasksLate), waits: own.tasksLate > 0 },
  ];
  // A leader with nothing of their own this fortnight sees the conference alone.
  const showMine = !conference || week.length + own.tasks + own.visitAsks > 0;
  return (
    <div className="glance">
      {showMine && (
        <section aria-labelledby="glance-yours">
          <h2 id="glance-yours">{w.yours}</h2>
          <nav className="glance-tiles">{mine.map((tile) => <TileLink key={tile.label} tile={tile} />)}</nav>
        </section>
      )}
      {conference && (
        <section aria-labelledby="glance-whole">
          <h2 id="glance-whole">{w.whole}</h2>
          <nav className="glance-tiles">{conferenceTiles(conference, w, money).map((tile) => <TileLink key={tile.label} tile={tile} />)}</nav>
        </section>
      )}
      {/* A council's owner may hold no leader's seat here: their council stands on its own. */}
      {councils.map((council) => (
        <p className="glance-council" key={council.name}>
          <strong>{w.council(council.name, council.conferences)}</strong> {w.councilLine(council.households, money(council.helpPaid), council.visits, council.updating)}
        </p>
      ))}
    </div>
  );
}
