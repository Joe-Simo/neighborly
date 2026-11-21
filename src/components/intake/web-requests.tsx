"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/context";
import { LiveField } from "@/components/workspace/primitives";
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
  const saveSettings = useMutation(api.intake.saveSettings);
  const releaseAll = useMutation(api.intake.releaseAll);
  const { save, error } = useSave();
  const [editing, setEditing] = useState(false);
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
              await saveSettings({ churchId, enabled: true, address: area.address, miles: area.miles });
              setEditing(false);
              return null;
            } catch (cause) {
              return readFailure(cause, words.states.notSaved);
            }
          }}
        />
      ) : (
        <div className="web-area">
          <p>{settings ? (settings.enabled ? w.area(settings.miles, settings.zip) : w.paused(settings.miles, settings.zip)) : w.off}</p>
          <div className="live-row-actions">
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>{w.setArea}</Button>
            {settings && (
              <Button type="button" variant="ghost" onClick={() => void save(() => saveSettings({ churchId, enabled: !settings.enabled, address: settings.address, miles: settings.miles }))}>
                {settings.enabled ? w.pause : w.resume}
              </Button>
            )}
          </div>
        </div>
      )}
      {error && !editing && <LiveFailure message={error} />}
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
  const [open, setOpen] = useState<"pass" | "block" | "close" | null>(null);
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
      {row.late && <p className="web-mark web-late-note">{w.late}</p>}
      <div className="live-row-actions">
        <Button type="button" variant="outline" onClick={() => setOpen(open === "pass" ? null : "pass")}>{w.passOn}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(open === "close" ? null : "close")}>{w.close}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(open === "block" ? null : "block")}>{w.block}</Button>
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
      {(open === "block" || open === "close") && (
        <div className="web-ask">
          <p>{open === "block" ? w.blockAsk : w.closeAsk}</p>
          <div className="live-form-actions">
            <Button type="button" variant="ghost" onClick={() => setOpen(null)}>{w.cancel}</Button>
            <Button type="button" disabled={pending} onClick={() => void save(() => (open === "block" ? block : close)({ churchId, requestId: row.id }))}>{open === "block" ? w.block : w.close}</Button>
          </div>
        </div>
      )}
      {error && <LiveFailure message={error} />}
    </article>
  );
}
