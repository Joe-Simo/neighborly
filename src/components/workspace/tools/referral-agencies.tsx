"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { Building2 } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/context";
import { agenciesWords } from "@/components/workspace/tools/agencies-words";
import { useQuery } from "@/components/workspace/query";
import { LiveField, LiveLoading } from "@/components/workspace/primitives";
import { LiveFailure } from "@/components/workspace/states";
import { sayFailure } from "@/components/workspace/failure";
import { UndoAct } from "@/components/workspace/undo";

type Agency = { id: Id<"referralAgencies">; name: string; phone: string; helpsWith: string };
type Fields = { name: string; phone: string; helpsWith: string };

/**
 * Your files: the local agencies the group refers neighbors to, kept by hand. Loaded only when the room opens, and
 * only for someone the server lets open neighbor records (the room asks; see tools.tsx).
 */
export default function ReferralAgencies() {
  const { data, words } = useWorkspace();
  const text = agenciesWords(words.locale, words.terms);
  const churchId = data.church.id;
  const rows = useQuery(api.referralAgencies.list, { churchId });
  const add = useMutation(api.referralAgencies.add);
  const edit = useMutation(api.referralAgencies.edit);
  const remove = useMutation(api.referralAgencies.remove);
  const [editing, setEditing] = useState<Id<"referralAgencies"> | null>(null);
  const [removing, setRemoving] = useState<Id<"referralAgencies"> | null>(null);
  const [said, setSaid] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // The agency just taken off, kept so the line that says so can put it back as it was.
  const [back, setBack] = useState<Fields | null>(null);

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError("");
    setSaid("");
    setBack(null);
    try {
      await work();
      setSaid(done);
      return true;
    } catch (problem) {
      setError(sayFailure(words.notices, problem, text.failed));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="tools-leaf" aria-labelledby="referral-agencies-name">
      <h2 id="referral-agencies-name"><Building2 size={18} aria-hidden="true" /> {text.title}</h2>
      <p className="tools-leaf-deck">{text.deck}</p>
      {error && <LiveFailure message={error} kept="" />}
      <p className="tools-small" role="status">
        {said}
        {back && <> <UndoAct run={async () => { await run(() => add({ churchId, ...back }), text.putBack); }} /></>}
      </p>
      {rows === undefined ? (
        <LiveLoading label={text.loading} />
      ) : rows.length === 0 ? (
        <p className="tools-small">{text.empty}</p>
      ) : (
        <ul className="tools-agencies paper-rows">
          {rows.map((row: Agency) => (
            <li key={row.id}>
              {editing === row.id ? (
                <AgencyForm
                  initial={row}
                  submit={text.save}
                  busy={busy}
                  onCancel={() => setEditing(null)}
                  onSave={async (fields) => {
                    if (await run(() => edit({ churchId, id: row.id, ...fields }), text.saved)) setEditing(null);
                  }}
                />
              ) : (
                <div className="tools-agency">
                  <strong>{row.name}</strong>
                  {row.helpsWith && <span>{row.helpsWith}</span>}
                  <div className="tools-agency-line">
                    {row.phone && <span>{row.phone}</span>}
                    {removing === row.id ? (
                      <>
                        <span>{text.removeQuestion}</span>
                        <button type="button" className="tools-agency-act" disabled={busy} onClick={() => void run(() => remove({ churchId, id: row.id }), text.removed).then((done) => { setRemoving(null); if (done) setBack({ name: row.name, phone: row.phone, helpsWith: row.helpsWith }); })}>{text.removeSure}</button>
                        <button type="button" className="tools-agency-act" onClick={() => setRemoving(null)}>{text.keep}</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="tools-agency-act" aria-label={`${text.edit}: ${row.name}`} onClick={() => { setRemoving(null); setEditing(row.id); }}>{text.edit}</button>
                        <button type="button" className="tools-agency-act" aria-label={`${text.remove}: ${row.name}`} onClick={() => { setEditing(null); setRemoving(row.id); }}>{text.remove}</button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <AgencyForm
        key={said}
        initial={{ name: "", phone: "", helpsWith: "" }}
        submit={text.add}
        busy={busy}
        onSave={async (fields) => {
          await run(() => add({ churchId, ...fields }), text.added);
        }}
      />
    </section>
  );
}

function AgencyForm({ initial, submit, busy, onSave, onCancel }: { initial: Fields; submit: string; busy: boolean; onSave: (fields: Fields) => Promise<void>; onCancel?: () => void }) {
  const { words } = useWorkspace();
  const text = agenciesWords(words.locale, words.terms);
  const [fields, setFields] = useState<Fields>(initial);
  const set = (key: keyof Fields) => (event: { currentTarget: { value: string } }) => {
    const value = event.currentTarget.value;
    setFields((now) => ({ ...now, [key]: value }));
  };
  return (
    <form
      className="tools-agency-form"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void onSave(fields);
      }}
    >
      <LiveField label={text.name}><Input name="name" required maxLength={120} value={fields.name} onChange={set("name")} /></LiveField>
      <LiveField label={text.phone}><Input name="phone" type="tel" maxLength={40} value={fields.phone} onChange={set("phone")} /></LiveField>
      <LiveField label={text.helpsWith}><Input name="helpsWith" maxLength={300} value={fields.helpsWith} onChange={set("helpsWith")} /></LiveField>
      <div className="help-actions">
        <Button type="submit" variant="outline" disabled={busy}>{submit}</Button>
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>{text.cancel}</Button>}
      </div>
    </form>
  );
}
