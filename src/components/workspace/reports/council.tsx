"use client";

import { saveFile } from "@/lib/save-file";
import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { Download } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/context";
import { LiveField, LiveLoading } from "@/components/workspace/primitives";
import { HousingFrame } from "@/components/workspace/reports/housing-providers";
import { useHour, useQuery } from "@/components/workspace/query";
import { LiveFailure, LiveWaiting, SaveLabel } from "@/components/workspace/states";
import { councilCsv, councilFileName, figureOrder, isMoney } from "@/components/workspace/reports/council-lines";
import { councilWords } from "@/components/workspace/reports/council-words";
import { sayRefused } from "@/lib/refusals";
import type { Language } from "@/lib/words/sets";
import { reportsWords } from "@/lib/words/rooms/reports";

/** The room's way of saying an amount (lines.ts), handed in so this chunk does not share that module with the room. */
export type CouncilMoney = (cents: number, language: Language) => string;

/** A refusal from the backend in the reader's language, or the plain "try again". */
function useSaying() {
  const { words } = useWorkspace();
  return (problem: unknown, fallback: string) => (problem instanceof ConvexError && typeof problem.data === "string" ? sayRefused(words.notices, problem.data) : fallback);
}

/** The district or council report under the year: closed until asked for, so nothing is read for most visits. */
export default function CouncilSection({ year, money }: { year: number; money: CouncilMoney }) {
  const { words } = useWorkspace();
  const w = councilWords(words.locale);
  const [open, setOpen] = useState(false);
  return (
    <section className="live-section housing-section council-section" aria-labelledby="council-title">
      <div className="live-section-head">
        <h2 id="council-title">{w.title}</h2>
      </div>
      <Button variant="outline" aria-expanded={open} aria-controls="council-body" onClick={() => startTransition(() => setOpen(!open))}>
        {open ? w.hide : w.show}
      </Button>
      <div id="council-body">{open && <Councils year={year} money={money} />}</div>
    </section>
  );
}

function Councils({ year, money }: { year: number; money: CouncilMoney }) {
  const { words } = useWorkspace();
  const w = councilWords(words.locale);
  const councils = useQuery(api.councils.mine, {});
  // The form leaves once the council is saved, so the council that takes its place says it was created.
  const [created, setCreated] = useState(false);
  if (!councils) return <LiveLoading label={w.loading} />;
  return (
    <div className="housing-body">
      <p className="housing-note">{w.deck}</p>
      {councils.map((council) => (
        <Council key={council.id} council={council} year={year} money={money} said={created ? w.created : ""} />
      ))}
      {councils.length === 0 && <CreateCouncil onCreated={() => setCreated(true)} />}
    </div>
  );
}

function CreateCouncil({ onCreated }: { onCreated: () => void }) {
  const { words } = useWorkspace();
  const w = councilWords(words.locale);
  const create = useMutation(api.councils.create);
  const saying = useSaying();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await create({ name, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      onCreated();
    } catch (problem) {
      setError(saying(problem, w.failed));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="council-form" onSubmit={submit}>
      <h3>{w.start}</h3>
      <p className="housing-note">{w.startDeck}</p>
      {error && <LiveFailure message={error} kept="" />}
      <LiveField label={w.councilName}>
        <Input name="council" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
      </LiveField>
      <Button type="submit" disabled={busy}>{w.create}</Button>
    </form>
  );
}

type CouncilRow = { id: Id<"councils">; name: string; conferences: { id: Id<"councilLinks">; name: string; status: "pending" | "accepted" }[] };

function Council({ council, year, money, said: first = "" }: { council: CouncilRow; year: number; money: CouncilMoney; said?: string }) {
  const { words } = useWorkspace();
  const w = councilWords(words.locale);
  const invite = useMutation(api.councils.invite);
  const unlink = useMutation(api.councils.unlink);
  const saying = useSaying();
  const [code, setCode] = useState("");
  const [said, setSaid] = useState(first);
  const [error, setError] = useState("");
  // Taking a conference off is asked once more first: only a new invitation joins the two again.
  const [removing, setRemoving] = useState<string | null>(null);
  // One change at a time: while it is on its way its button says so, and nothing here can be sent twice.
  const [busy, setBusy] = useState<"invite" | "remove" | null>(null);
  const run = async (work: () => Promise<unknown>, done: string, which: "invite" | "remove") => {
    setError("");
    setSaid("");
    setBusy(which);
    try {
      await work();
      setSaid(done);
    } catch (problem) {
      setError(saying(problem, w.failed));
    } finally {
      setBusy(null);
    }
  };
  const counted = council.conferences.some((row) => row.status === "accepted");
  return (
    <div className="council-one">
      <h3>{council.name}</h3>
      {error && <LiveFailure message={error} kept="" />}
      <p className="housing-note" role="status">{said}</p>
      {council.conferences.length === 0 ? (
        <p className="housing-note">{w.noConferences}</p>
      ) : (
        <ul className="council-list">
          {council.conferences.map((row) => (
            <li key={row.id}>
              <span>{row.name}</span> <small>{row.status === "accepted" ? w.joined : w.pending}</small>{" "}
              {removing === row.id ? (
                <>
                  <span>{w.removeQuestion}</span>{" "}
                  <Button variant="outline" disabled={busy !== null} onClick={() => void run(() => unlink({ linkId: row.id }), w.removed, "remove").then(() => setRemoving(null))}>
                    <SaveLabel saving={busy === "remove"} idle={w.removeSure} busy={w.removing} />
                  </Button>{" "}
                  <Button variant="ghost" disabled={busy !== null} onClick={() => setRemoving(null)}>{w.stay}</Button>
                </>
              ) : (
                <Button variant="ghost" aria-label={`${w.remove}: ${row.name}`} onClick={() => setRemoving(row.id)}>{w.remove}</Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="council-form"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await invite({ councilId: council.id, code });
            setCode("");
          }, w.invited, "invite");
        }}
      >
        <LiveField label={w.inviteCode}>
          <Input name="code" required maxLength={64} autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} />
        </LiveField>
        <LiveWaiting when={busy === "invite"} />
        <Button type="submit" variant="outline" disabled={busy !== null}>
          <SaveLabel saving={busy === "invite"} idle={w.invite} busy={w.inviting} />
        </Button>
      </form>
      {counted && <CouncilYearTable councilId={council.id} year={year} money={money} />}
    </div>
  );
}

function CouncilYearTable({ councilId, year, money }: { councilId: Id<"councils">; year: number; money: CouncilMoney }) {
  const { words } = useWorkspace();
  const w = councilWords(words.locale);
  const at = useHour();
  const report = useQuery(api.councils.yearReport, { councilId, year, at });
  const refresh = useMutation(api.councils.refresh);
  const [done, setDone] = useState("");
  const updating = report?.updating ?? false;
  // A year no conference has stored yet (an older one) is asked to be added up; stale ones are already on their way.
  useEffect(() => {
    if (updating) void refresh({ councilId, year }).catch(() => undefined);
  }, [updating, councilId, year, refresh]);
  const language = words.locale;
  if (!report) return <LiveLoading label={w.loading} />;
  const number = new Intl.NumberFormat(language === "es" ? "es-US" : "en-US", { maximumFractionDigits: 2 });
  const say = (key: (typeof figureOrder)[number], value: number) => (isMoney(key) ? money(value, language) : number.format(value));

  function save() {
    if (!report) return;
    const name = councilFileName(report);
    saveFile(new Blob([councilCsv(report, w)], { type: "text/csv;charset=utf-8" }), name);
    startTransition(() => setDone(reportsWords(words).saved(name)));
  }

  return (
    <>
      <p className="housing-note">{report.closed ? w.year(report.year) : `${w.year(report.year)}, ${w.soFar}`}</p>
      {report.updating && <p className="housing-note" role="status">{w.updating}</p>}
      <HousingFrame label={w.title}>
        <table className="housing-table">
          <thead>
            <tr>
              <th scope="col">{w.conference}</th>
              {report.conferences.map((row) => (
                <th scope="col" key={row.name}>{row.name}</th>
              ))}
              <th scope="col">{w.total}</th>
            </tr>
          </thead>
          <tbody>
            {figureOrder.map((key) => (
              <tr key={key}>
                <th scope="row">{w.lines[key]}</th>
                {report.conferences.map((row) => (
                  <td key={row.name}>{say(key, row.figures[key])}</td>
                ))}
                <td>{say(key, report.total[key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </HousingFrame>
      <div className="live-row-actions">
        <Button variant="outline" onClick={save}>
          <Download size={17} aria-hidden="true" /> {w.download}
        </Button>
      </div>
      <p className="housing-note" role="status">{done}</p>
    </>
  );
}
