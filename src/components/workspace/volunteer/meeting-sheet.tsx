"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { Printer, Send } from "lucide-react";
import { useQuery } from "@/components/workspace/query";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { LiveField } from "@/components/workspace/primitives";
import { LiveFailure, LiveWaiting } from "@/components/workspace/states";
import { useWorkspace } from "@/components/workspace/context";
import { useSave } from "@/components/workspace/use-save";
import { recordHref } from "@/components/workspace/help-line/format";
import { formatMoney, type Language } from "@/lib/words";
import "@/components/workspace/volunteer/meeting-sheet.css";

type Kind = "rent" | "utility" | "food" | "voucher" | "other";
type Place = "home" | "prison" | "hospital" | "eldercare" | "other";

/** Only this sheet carries these words; it loads when a coordinator opens a meeting's agenda. */
const said = {
  en: {
    open: "Agenda and minutes",
    deck: (since: string) => `From the records since the last meeting, ${since}. Decide each request on its record.`,
    reflection: "Spiritual reflection", reflectionHelp: "The reading or prayer that opened the meeting.",
    waiting: "Requests to decide", decided: "Decided since the last meeting", visits: "Visits since the last meeting", balance: "The books’ balance",
    none: "None.", decide: "Decide",
    minutes: "Minutes", minutesHelp: "Members get these by email with every neighbor’s name and address taken out.",
    attended: "Who came",
    save: "Save the minutes", saved: "Saved.", print: "Print", send: "Email to members", sent: "Emailed to members.", notSent: "Email is not switched on here, so nothing was sent.", emailSample: "Email is off for the sample.", emailOff: "Email is not switched on here yet.", saveFirst: "Save the minutes first, then email them.",
    status: { approved: "approved", paid: "paid", declined: "declined", closed: "closed", open: "open" } as Record<string, string>,
    kinds: { rent: "Rent", utility: "Utility", food: "Food", voucher: "Voucher", other: "Other" } satisfies Record<Kind, string>,
    places: { home: "home", prison: "prison", hospital: "hospital", eldercare: "nursing home", other: "in person" } satisfies Record<Place, string>,
  },
  es: {
    open: "Agenda y acta",
    deck: (since: string) => `Según los registros desde la última reunión, ${since}. Decide cada petición en su registro.`,
    reflection: "Reflexión espiritual", reflectionHelp: "La lectura u oración con que empezó la reunión.",
    waiting: "Peticiones por decidir", decided: "Decididas desde la última reunión", visits: "Visitas desde la última reunión", balance: "El saldo de las cuentas",
    none: "Ninguna.", decide: "Decidir",
    minutes: "Acta", minutesHelp: "Los miembros la reciben por correo sin los nombres ni direcciones de las personas que ayudamos.",
    attended: "Quién vino",
    save: "Guardar el acta", saved: "Guardada.", print: "Imprimir", send: "Enviar a los miembros", sent: "Enviada a los miembros.", notSent: "El correo no está activado aquí, así que no se envió nada.", emailSample: "El correo está desactivado en el ejemplo.", emailOff: "El correo todavía no está activado aquí.", saveFirst: "Guarda primero el acta y luego envíala.",
    status: { approved: "aprobada", paid: "pagada", declined: "rechazada", closed: "cerrada", open: "abierta" } as Record<string, string>,
    kinds: { rent: "Alquiler", utility: "Servicios", food: "Comida", voucher: "Vales", other: "Otra ayuda" } satisfies Record<Kind, string>,
    places: { home: "en casa", prison: "en prisión", hospital: "en el hospital", eldercare: "en un asilo", other: "en persona" } satisfies Record<Place, string>,
  },
} satisfies Record<Language, unknown>;

/** A meeting's agenda from the records and what the meeting keeps, for the owner and approved coordinators. */
export default function MeetingSheet({ meetingId, title }: { meetingId: Id<"meetings">; title: string }) {
  const { data, words, format } = useWorkspace();
  const churchId = data.church.id;
  const w = said[words.locale];
  const allowed = useQuery(api.access.canOpenNeighborRecords, { churchId });
  const [open, setOpen] = useState(false);
  if (!allowed) return null;
  return (
    <div className="live-row-actions">
      <Button variant="outline" aria-label={`${w.open}: ${title}`} onClick={() => setOpen(true)}>{w.open}</Button>
      {open && (
        <LiveDialog title={title} closeLabel={words.shell.close} onClose={() => setOpen(false)} className="meeting-dialog">
          <Agenda churchId={churchId} meetingId={meetingId} language={words.locale} leave={() => setOpen(false)} day={(at) => format(at, { month: "long", day: "numeric" })} />
        </LiveDialog>
      )}
    </div>
  );
}

function Agenda({ churchId, meetingId, language, leave, day }: { churchId: Id<"churches">; meetingId: Id<"meetings">; language: Language; leave: () => void; day: (at: number) => string }) {
  const w = said[language];
  const sheet = useQuery(api.minutes.sheet, { churchId, meetingId });
  const keep = useMutation(api.minutes.keep);
  const send = useMutation(api.minutes.send);
  const [attended, setAttended] = useState<string[] | null>(null);
  const [done, setDone] = useState("");
  const { pending, error, save } = useSave();
  if (!sheet) return <LiveWaiting when />;
  const present = attended ?? sheet.kept.attended;
  // Email the members is off in the sample and where no email is set up, and waits for saved minutes: one muted line says which.
  const emailWhy = sheet.emailOff === "sample" ? w.emailSample : sheet.emailOff === "off" ? w.emailOff : "";
  const sendWhy = emailWhy || (sheet.kept.savedAt ? "" : w.saveFirst);
  const money = (cents: number) => formatMoney(cents / 100, language, cents % 100 === 0);
  return (
    <form
      className="live-form meeting-sheet"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const outcome = await save(() => keep({ churchId, meetingId, reflection: String(form.get("reflection") ?? ""), minutes: String(form.get("minutes") ?? ""), attended: present as Id<"memberships">[] }));
        if (outcome.saved) setDone(w.saved);
      }}
    >
      <p className="help-form-note">{w.deck(day(sheet.since))}</p>
      <LiveField label={w.reflection} help={w.reflectionHelp}>
        <Textarea name="reflection" rows={2} defaultValue={sheet.kept.reflection} />
      </LiveField>
      <section>
        <h3>{w.waiting}</h3>
        {sheet.waiting.length ? (
          <ul>
            {sheet.waiting.map((row) => (
              <li key={row.requestId}>
                <span>{`${row.name} · ${w.kinds[row.kind]} · ${money(row.amount)}`}</span>
                <Link href={recordHref(row.neighborId)} className="meeting-decide" onClick={leave}>{w.decide}</Link>
              </li>
            ))}
          </ul>
        ) : <p>{w.none}</p>}
      </section>
      <section>
        <h3>{w.decided}</h3>
        {sheet.decided.length ? (
          <ul>{sheet.decided.map((row) => <li key={row.requestId}>{`${row.name} · ${w.kinds[row.kind]} · ${w.status[row.status] ?? row.status}${row.amount ? ` · ${money(row.amount)}` : ""}`}</li>)}</ul>
        ) : <p>{w.none}</p>}
      </section>
      <section>
        <h3>{w.visits}</h3>
        {sheet.visits.length ? (
          <ul>{sheet.visits.map((row) => <li key={row.visitId}>{`${row.name} · ${w.places[row.place]} · ${day(row.at)}`}</li>)}</ul>
        ) : <p>{w.none}</p>}
      </section>
      <section>
        <h3>{w.balance}</h3>
        <p>{money(sheet.balance)}</p>
      </section>
      <fieldset className="help-lines">
        <legend>{w.attended}</legend>
        <div className="meeting-people">
          {sheet.members.map((member) => (
            <Toggle key={member.id} variant="outline" pressed={present.includes(member.id)} onPressedChange={(on) => setAttended(on ? [...present, member.id] : present.filter((id) => id !== member.id))}>
              {member.name}
            </Toggle>
          ))}
        </div>
      </fieldset>
      <LiveField label={w.minutes} help={w.minutesHelp}>
        <Textarea name="minutes" rows={8} defaultValue={sheet.kept.minutes} />
      </LiveField>
      {error && <LiveFailure message={error} />}
      {done && <p role="status">{done}</p>}
      <div className="live-form-actions">
        {sendWhy && <p id="meeting-send-why" className="meeting-send-why">{sendWhy}</p>}
        <LiveWaiting when={pending} />
        <Button type="button" variant="ghost" onClick={() => {
          // The print rule holds only while this sheet is printing, so no other page's print is blanked by it.
          const root = document.documentElement;
          root.dataset.print = "meeting";
          window.addEventListener("afterprint", () => delete root.dataset.print, { once: true });
          window.print();
        }}><Printer aria-hidden="true" />{w.print}</Button>
        <Button type="button" variant="outline" disabled={pending || Boolean(sendWhy)} aria-describedby={sendWhy ? "meeting-send-why" : undefined} onClick={async () => {
          const outcome = await save(() => send({ churchId, meetingId }));
          if (outcome.saved) setDone(outcome.result === "sent" ? w.sent : w.notSent);
        }}><Send aria-hidden="true" />{w.send}</Button>
        <Button type="submit" disabled={pending}>{w.save}</Button>
      </div>
    </form>
  );
}
