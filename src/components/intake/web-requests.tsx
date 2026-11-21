"use client";

import { useEffect, useState } from "react";
import { useAction, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/context";
import { LiveField } from "@/components/workspace/primitives";
import { DateField } from "@/components/workspace/date-field";
import { useHour, useQuery } from "@/components/workspace/query";
import { LiveFailure } from "@/components/workspace/states";
import { useSave } from "@/components/workspace/use-save";
import { readFailure } from "@/components/workspace/failure";
import { ServiceAreaForm, type ServiceArea } from "./service-area";
import { webWords } from "./web-words";
import { AREA_MILES, type AreaSize } from "@/lib/intake/intake-words";
import "./web-requests.css";

type Row = FunctionReturnType<typeof api.intake.forTeam>["waiting"][number];
const sizeFor = (miles: number): AreaSize => (Object.entries(AREA_MILES).find(([, value]) => value === miles)?.[0] as AreaSize | undefined) ?? "custom";

/**
 * The Help line's requests from the public web form: where the team helps, the ones held after a rush, and each waiting
 * request with its marks (unverified, do not message, late in ochre, passed from another team), to pass on, block or
 * close. Each request is also a call in the list below; this is where its web-only actions live.
 */
export function WebRequests() {
  const { data, words } = useWorkspace();
  const w = webWords(words.locale);
  const churchId = data.church.id;
  const at = useHour();
  const settings = useQuery(api.intake.settings, { churchId });
  const requests = useQuery(api.intake.forTeam, at ? { churchId, at } : "skip");
  const saveArea = useAction(api.intakeActions.saveArea);
  const saveSettings = useMutation(api.intake.saveSettings);
  const releaseAll = useMutation(api.intake.releaseAll);
  const seen = useMutation(api.intake.seen);
  const setNewRequestEmail = useMutation(api.intakeNotify.setNewRequestEmail);
  const { save, error } = useSave();
  const [editing, setEditing] = useState(false);
  const [more, setMore] = useState(false);
  // An owner or coordinator opened the Help line: the team is alive, so the form is not paused for silence.
  useEffect(() => {
    if (!data.church.sample) void seen({ churchId }).catch(() => undefined);
  }, [churchId, data.church.sample, seen]);
  if (settings === undefined || data.church.sample) return null;
  const held = requests?.waiting.filter((row) => row.stage === "held") ?? [];
  const waiting = requests?.waiting.filter((row) => row.stage === "received") ?? [];

  return (
    <section className="live-section web-requests" aria-labelledby="web-requests-title">
      <div className="live-section-head">
        <h2 id="web-requests-title">{w.title}</h2>
      </div>
      {editing ? (
        <ServiceAreaForm
          language={words.locale}
          start={settings ? { address: settings.address, size: sizeFor(settings.miles), miles: settings.miles } : undefined}
          onCancel={() => setEditing(false)}
          onSubmit={async (area: ServiceArea) => {
            try {
              await saveArea({ churchId, enabled: true, address: area.address, miles: area.miles });
              setEditing(false);
              return null;
            } catch (cause) {
              return readFailure(cause, words.states.notSaved);
            }
          }}
        />
      ) : (
        <div className="web-area">
          <p>{settings ? (settings.enabled ? w.area(settings.miles, settings.zip) : settings.autoPaused ? w.autoPaused : w.paused(settings.miles, settings.zip)) : w.off}</p>
          {settings?.placed === "zip" && <p className="live-muted">{w.placedByZip}</p>}
          {settings?.phone && <p className="live-muted">{w.phoneShown(settings.phone)}</p>}
          <div className="live-row-actions">
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>{w.setArea}</Button>
            {settings && (
              <Button type="button" variant="ghost" onClick={() => void save(() => saveSettings({ churchId, enabled: !settings.enabled, address: settings.address, miles: settings.miles }))}>
                {settings.enabled ? w.pause : w.resume}
              </Button>
            )}
            {settings && <Button type="button" variant="ghost" aria-expanded={more} onClick={() => setMore(!more)}>{w.more}</Button>}
          </div>
        </div>
      )}
      {error && !editing && <LiveFailure message={error} />}
      {settings && more && <AreaMore churchId={churchId} settings={settings} onDone={() => setMore(false)} />}
      {settings && (
        <label className="web-choice web-notify">
          <input type="checkbox" checked={settings.newRequestEmail} onChange={(event) => void save(() => setNewRequestEmail({ churchId, on: event.currentTarget.checked }))} />
          <span>{w.newRequestEmail}</span>
        </label>
      )}
      {settings && <Partners churchId={churchId} />}
      <Review churchId={churchId} />
      {held.length > 0 && (
        <div className="web-held">
          <p>{w.held(held.length)}</p>
          <Button type="button" onClick={() => void save(() => releaseAll({ churchId }))}>{w.releaseAll}</Button>
        </div>
      )}
      {settings && (waiting.length ? (
        <div className="live-list">{waiting.map((row) => <WebRow key={row.id} row={row} churchId={churchId} />)}</div>
      ) : requests && <p className="live-muted">{w.none}</p>)}
      {requests && requests.passedOn.length > 0 && (
        <div className="web-traces">
          <h3>{w.passedOn}</h3>
          <ul>{requests.passedOn.map((pass) => <li key={pass.at}>{w.trace(pass.toName, pass.reason)}</li>)}</ul>
        </div>
      )}
    </section>
  );
}

function WebRow({ row, churchId }: { row: Row; churchId: Id<"churches"> }) {
  const { words } = useWorkspace();
  const w = webWords(words.locale);
  const [open, setOpen] = useState<"pass" | "block" | "close" | "back" | "flag" | null>(null);
  const accept = useMutation(api.intake.accept);
  const giveBack = useMutation(api.intake.giveBack);
  const notGenuine = useMutation(api.intake.notGenuine);
  const passOn = useMutation(api.intake.passOn);
  const block = useMutation(api.intake.block);
  const close = useMutation(api.intake.close);
  const { save, error, pending } = useSave();
  const targets = useQuery(api.intake.passTargets, open === "pass" ? { churchId, requestId: row.id } : "skip");
  return (
    <article className={`help-row web-row${row.late ? " web-late" : ""}`}>
      {row.passedFrom && <p className="web-passed">{w.passedFrom(row.passedFrom.name, row.passedFrom.reason)}</p>}
      <p className="live-name">{row.kinds.map((kind) => w.kinds[kind]).join(" · ")}{row.language === "es" ? ` · ${w.spanish}` : ""}</p>
      {/* The person's own words, as plain text: React escapes them and nothing is turned into a link. */}
      <p className="web-need">{row.need}</p>
      <p className="live-muted">{[row.phone, row.email, row.zip].filter(Boolean).join(" · ")}</p>
      {row.unverified && <p className="web-mark">{w.unverified}</p>}
      {row.doNotMessage && <p className="web-mark">{w.doNotMessage(row.callAt)}</p>}
      {row.meet && <p className="web-mark">{w.meet(row.meet)}</p>}
      {row.checkArea && <p className="web-mark">{w.checkArea}</p>}
      {row.partner && <p className="web-mark">{w.fromPartner}</p>}
      {row.late && <p className="web-mark web-late-note">{w.late}</p>}
      {row.acceptBy !== null && (
        <div className="web-ask">
          <p>{w.acceptBy}</p>
          <div className="live-row-actions">
            <Button type="button" onClick={() => void save(() => accept({ churchId, requestId: row.id }))}>{w.accept}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(open === "back" ? null : "back")}>{w.giveBack}</Button>
          </div>
        </div>
      )}
      {open === "back" && (
        <form className="live-form" onSubmit={(event) => {
          event.preventDefault();
          const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
          void save(() => giveBack({ churchId, requestId: row.id, reason }));
        }}>
          <LiveField label={w.giveBackWhy}><Input name="reason" maxLength={160} required /></LiveField>
          <div className="live-form-actions">
            <Button type="button" variant="ghost" onClick={() => setOpen(null)}>{w.cancel}</Button>
            <Button type="submit" disabled={pending}>{w.giveBack}</Button>
          </div>
        </form>
      )}
      <div className="live-row-actions">
        <Button type="button" variant="outline" onClick={() => setOpen(open === "pass" ? null : "pass")}>{w.passOn}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(open === "close" ? null : "close")}>{w.close}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(open === "block" ? null : "block")}>{w.block}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(open === "flag" ? null : "flag")}>{w.notGenuine}</Button>
      </div>
      {open === "pass" && (
        <form
          className="live-form web-pass"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const to = String(form.get("to") ?? "") as Id<"churches">;
            void save(() => passOn({ churchId, requestId: row.id, toChurchId: to, reason: String(form.get("reason") ?? "") }));
          }}
        >
          {targets && !targets.length ? <p className="live-muted">{w.passNone}</p> : (
            <>
              <fieldset>
                <legend>{w.passTo}</legend>
                {targets?.map((team, index) => (
                  <label key={team.id} className="web-choice"><input type="radio" name="to" value={team.id} defaultChecked={index === 0} required /> {team.name} · {w.miles(team.miles)}</label>
                ))}
              </fieldset>
              <LiveField label={w.passWhy}><Input name="reason" maxLength={160} required /></LiveField>
              <div className="live-form-actions">
                <Button type="button" variant="ghost" onClick={() => setOpen(null)}>{w.cancel}</Button>
                <Button type="submit" disabled={pending || !targets}>{w.passSend}</Button>
              </div>
            </>
          )}
        </form>
      )}
      {(open === "block" || open === "close" || open === "flag") && (
        <div className="web-ask">
          <p>{open === "block" ? w.blockAsk : open === "flag" ? w.notGenuineAsk : w.closeAsk}</p>
          <div className="live-form-actions">
            <Button type="button" variant="ghost" onClick={() => setOpen(null)}>{w.cancel}</Button>
            <Button type="button" disabled={pending} onClick={() => void save(() => (open === "block" ? block : open === "flag" ? notGenuine : close)({ churchId, requestId: row.id }))}>{open === "block" ? w.block : open === "flag" ? w.notGenuine : w.close}</Button>
          </div>
        </div>
      )}
      {error && <LiveFailure message={error} />}
    </article>
  );
}

type Settings = NonNullable<FunctionReturnType<typeof api.intake.settings>>;
/** A team's weekly limit, overlap order and closed days. */
function AreaMore({ churchId, settings, onDone }: { churchId: Id<"churches">; settings: Settings; onDone: () => void }) {
  const { words } = useWorkspace();
  const w = webWords(words.locale);
  const saveSettings = useMutation(api.intake.saveSettings);
  const { save, error, pending } = useSave();
  const [holidays, setHolidays] = useState(settings.holidays);
  const [day, setDay] = useState("");
  const whole = (text: FormDataEntryValue | null) => (String(text ?? "").trim() ? Number(text) : null);
  return (
    <form className="live-form web-more" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      void save(() => saveSettings({ churchId, enabled: settings.enabled, address: settings.address, miles: settings.miles, weeklyLimit: whole(form.get("weeklyLimit")), order: whole(form.get("order")), holidays, phone: String(form.get("phone") ?? "").trim() || null })).then((done) => done.saved && onDone());
    }}>
      <LiveField label={w.teamPhone} help={w.teamPhoneHelp}><Input name="phone" type="tel" inputMode="tel" autoComplete="off" maxLength={30} defaultValue={settings.phone ?? ""} /></LiveField>
      <LiveField label={w.weeklyLimit}><Input name="weeklyLimit" type="number" inputMode="numeric" min={1} max={1000} defaultValue={settings.weeklyLimit ?? ""} /></LiveField>
      <LiveField label={w.order}><Input name="order" type="number" inputMode="numeric" min={0} max={1000} defaultValue={settings.order ?? ""} /></LiveField>
      <LiveField label={w.holidays}><DateField value={day} onChange={setDay} /></LiveField>
      <Button type="button" variant="outline" disabled={!day} onClick={() => { setHolidays([...new Set([...holidays, day])].sort()); setDay(""); }}>{w.addHoliday}</Button>
      {holidays.length > 0 && (
        <ul className="web-days">{holidays.map((one) => (
          <li key={one}>{one} <Button type="button" variant="ghost" onClick={() => setHolidays(holidays.filter((other) => other !== one))}>{w.removeHoliday(one)}</Button></li>
        ))}</ul>
      )}
      {error && <LiveFailure message={error} />}
      <div className="live-form-actions">
        <Button type="button" variant="ghost" onClick={onDone}>{w.cancel}</Button>
        <Button type="submit" disabled={pending}>{w.saveMore}</Button>
      </div>
    </form>
  );
}

/**
 * Owners only (the query answers null to anyone else): the team's own requests marked not genuine, and the contacts
 * another team marked too, as a piece of a hash and a count. "Genuine" takes the mark back; "Not genuine" keeps it.
 */
function Review({ churchId }: { churchId: Id<"churches"> }) {
  const { words } = useWorkspace();
  const w = webWords(words.locale);
  const list = useQuery(api.intakeReview.forOwner, { churchId });
  const decideMarked = useMutation(api.intakeReview.decideMarked);
  const decideShared = useMutation(api.intakeReview.decideShared);
  const { save, error, pending } = useSave();
  if (!list) return null;
  const day = (at: number) => new Intl.DateTimeFormat(words.locale === "es" ? "es-US" : "en-US", { month: "short", day: "numeric" }).format(at);
  const actions = (decide: (genuine: boolean) => Promise<null>) => (
    <span className="live-row-actions">
      <Button type="button" variant="outline" disabled={pending} onClick={() => void save(() => decide(true))}>{w.genuine}</Button>
      <Button type="button" variant="ghost" disabled={pending} onClick={() => void save(() => decide(false))}>{w.keepMark}</Button>
    </span>
  );
  return (
    <div className="web-review">
      <h3>{w.review}</h3>
      <p className="live-muted">{w.reviewHelp}</p>
      {list.marked.length + list.shared.length === 0 && <p className="live-muted">{w.reviewNone}</p>}
      {list.marked.length > 0 && <h4>{w.reviewOwn}</h4>}
      {list.marked.map((row) => (
        <div key={row.id} className="web-partner">
          <span>{w.markedOn(row.kinds.map((kind) => w.kinds[kind]).join(", "), day(row.at), row.referredBy)}</span>
          {actions((genuine) => decideMarked({ churchId, requestId: row.id, genuine }))}
        </div>
      ))}
      {list.shared.length > 0 && <><h4>{w.reviewShared}</h4><p className="live-muted">{w.reviewSharedHelp}</p></>}
      {list.shared.map((row) => (
        <div key={row.id} className="web-partner">
          <span>{w.sharedCase(row.hash, row.teams)}</span>
          {actions((genuine) => decideShared({ churchId, flagId: row.id, genuine }))}
        </div>
      ))}
      {error && <LiveFailure message={error} />}
    </div>
  );
}

/** The team's partners: add one (its link is shown once), give a new link, or revoke. */
function Partners({ churchId }: { churchId: Id<"churches"> }) {
  const { words } = useWorkspace();
  const w = webWords(words.locale);
  const partners = useQuery(api.intakePartners.list, { churchId });
  const create = useAction(api.intakeActions.createPartner);
  const relink = useAction(api.intakeActions.newPartnerLink);
  const revoke = useMutation(api.intakePartners.revoke);
  const { save, error, pending } = useSave();
  const [link, setLink] = useState("");
  const show = (token: string) => setLink(`${window.location.origin}${words.locale === "es" ? "/ayuda" : "/help"}?p=${token}`);
  return (
    <div className="web-partners">
      <h3>{w.partners}</h3>
      <p className="live-muted">{w.partnersHelp}</p>
      {partners?.map((partner) => (
        <div key={partner.id} className="web-partner">
          <span>{partner.name} · {partner.email} · {partner.language === "es" ? "Español" : "English"}{partner.active ? "" : ` · ${w.revoked}`}</span>
          <Button type="button" variant="ghost" disabled={pending} onClick={() => void save(() => relink({ churchId, partnerId: partner.id })).then((done) => done.saved && show(done.result))}>{w.newLink}</Button>
          {partner.active && <Button type="button" variant="ghost" disabled={pending} onClick={() => void save(() => revoke({ churchId, partnerId: partner.id }))}>{w.revoke}</Button>}
        </div>
      ))}
      {link && <p className="web-link">{w.linkOnce} <code>{link}</code></p>}
      <form className="live-form" onSubmit={(event) => {
        event.preventDefault();
        const target = event.currentTarget;
        const form = new FormData(target);
        void save(() => create({ churchId, name: String(form.get("name") ?? ""), email: String(form.get("email") ?? ""), language: form.get("language") === "es" ? "es" : "en" })).then((done) => {
          if (!done.saved) return;
          show(done.result);
          target.reset();
        });
      }}>
        <LiveField label={w.partnerName}><Input name="name" maxLength={80} required /></LiveField>
        <LiveField label={w.partnerEmail}><Input name="email" type="email" maxLength={254} required /></LiveField>
        <fieldset className="web-language">
          <legend>{w.partnerLanguage}</legend>
          <label className="web-choice"><input type="radio" name="language" value="en" defaultChecked={words.locale === "en"} /> <span lang="en">English</span></label>
          <label className="web-choice"><input type="radio" name="language" value="es" defaultChecked={words.locale === "es"} /> <span lang="es">Español</span></label>
        </fieldset>
        {error && <LiveFailure message={error} />}
        <Button type="submit" disabled={pending}>{w.addPartner}</Button>
      </form>
    </div>
  );
}
