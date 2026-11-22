"use client";

import { saveFile } from "@/lib/save-file";
import { startTransition, useEffect, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { Download } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { LiveField, LiveLoading } from "@/components/workspace/primitives";
import { HousingFrame } from "@/components/workspace/reports/housing-providers";
import { useHour, useQuery } from "@/components/workspace/query";
import { LiveFailure } from "@/components/workspace/states";
import { councilCsv, councilFileName, figureOrder, isMoney } from "@/components/workspace/reports/council-lines";
import { councilWords } from "@/components/workspace/reports/council-words";
import { sayRefused } from "@/lib/refusals";
import type { Language } from "@/lib/words/sets";

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
  if (!councils) return <LiveLoading label={w.loading} />;
  return (
    <div className="housing-body">
      <p className="housing-note">{w.deck}</p>
      {councils.map((council) => (
        <Council key={council.id} council={council} year={year} money={money} />
      ))}
      {councils.length === 0 && <CreateCouncil />}
    </div>
  );
}

function CreateCouncil() {
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
        <input name="council" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
      </LiveField>
      <Button type="submit" disabled={busy}>{w.create}</Button>
    </form>
  );
}

type CouncilRow = { id: Id<"councils">; name: string; conferences: { id: Id<"councilLinks">; name: string; status: "pending" | "accepted" }[] };

function Council({ council, year, money }: { council: CouncilRow; year: number; money: CouncilMoney }) {
  const { words } = useWorkspace();
  const w = councilWords(words.locale);
  const invite = useMutation(api.councils.invite);
  const unlink = useMutation(api.councils.unlink);
  const saying = useSaying();
  const [code, setCode] = useState("");
  const [said, setSaid] = useState("");
  const [error, setError] = useState("");
  const run = async (work: () => Promise<unknown>, done: string) => {
    setError("");
    setSaid("");
    try {
      await work();
      setSaid(done);
    } catch (problem) {
      setError(saying(problem, w.failed));
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
              <Button variant="ghost" onClick={() => void run(() => unlink({ linkId: row.id }), w.removed)}>{w.remove}</Button>
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
          }, w.invited);
        }}
      >
        <LiveField label={w.inviteCode}>
          <input name="code" required maxLength={64} autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} />
        </LiveField>
        <Button type="submit" variant="outline">{w.invite}</Button>
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
    startTransition(() => setDone(words.rooms.reports.saved(name)));
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
