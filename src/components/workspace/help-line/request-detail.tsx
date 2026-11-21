"use client";

import { Lock, Printer } from "lucide-react";
import { useQuery } from "@/components/workspace/query";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { printFoot } from "@/components/workspace/print-foot";
import { HelpLoading } from "@/components/workspace/help-line/room";
import { money, type HelpRequest } from "@/components/workspace/help-line/format";
import { referralsOf, requestDetailFacts } from "@/components/workspace/help-line/request-detail-facts";
import { fill } from "@/lib/words/fill";
import { requestDetailWords } from "@/components/workspace/help-line/request-detail-words";
import "@/components/workspace/help-line/request-detail.css";

/** What the page says about the neighbor; each caller already has it in hand. */
type DetailNeighbor = { name: string; address: string; phone: string; householdSize: number; speaks: string; alert: string };
/** The home visit the page goes to, when it is printed from one. */
type DetailVisit = { at: number; visitors: string[] };

/**
 * One assistance request on one printed page, for a home visit: who asked and how to reach them, what they asked
 * for, the help asked for before, and the visit. Drawn in place of the room's own page, so printing takes only it.
 */
export function RequestDetailView({ neighbor, rows, requestId, visit }: { neighbor: DetailNeighbor; rows: HelpRequest[]; requestId: HelpRequest["id"]; visit: DetailVisit | null }) {
  const { data, format, now, words, sampleSaid } = useWorkspace();
  const text = requestDetailWords(words.locale);
  const { request, past, totals } = requestDetailFacts(rows, requestId);
  if (!request) return <HelpLoading label={text.opening} />;
  const kind = (row: HelpRequest) => (row.voucher ? `${words.kinds.voucher} · ${row.voucher.quantity} × ${row.voucher.item}` : words.kinds[row.kind]);
  const sample = data.church.sample;
  const printed = format(now, { month: "long", day: "numeric", year: "numeric" });
  const referrals = referralsOf(request);
  const visitors = visit?.visitors ?? [];
  const foot = printFoot({ pages: ["request-detail"], left: `${data.church.name} · ${neighbor.name}`, printed: sample ? text.printedSample(printed) : text.printed(printed), pageWords: text.pageFoot });
  return (
    <>
      <style>{foot}</style>
      <div className="request-detail-bar">
        <Button onClick={() => window.print()}>
          <Printer size={18} aria-hidden="true" /> {text.printNow}
        </Button>
      </div>
      <article className="request-detail paper-settle" aria-label={text.label(neighbor.name)}>
        <header>
          <p className="request-detail-kicker">{sample ? text.kickerSample(data.church.name) : text.kicker(data.church.name)}</p>
          <h2>{neighbor.name}</h2>
          <p className="request-detail-when">{fill(text.takenOn, { date: format(request.createdAt, { month: "long", day: "numeric", year: "numeric" }), name: request.createdByName })}</p>
        </header>
        {neighbor.alert && (
          <p className="request-detail-alert" role="note">
            <strong>{text.alert}</strong> {sampleSaid(neighbor.alert)}
          </p>
        )}
        <dl className="request-detail-facts">
          <div><dt>{text.address}</dt><dd>{neighbor.address}</dd></div>
          <div><dt>{text.phone}</dt><dd>{neighbor.phone || text.noPhone}</dd></div>
          <div><dt>{text.household}</dt><dd>{text.householdOf(neighbor.householdSize)}</dd></div>
          <div><dt>{text.speaks}</dt><dd>{neighbor.speaks}</dd></div>
        </dl>

        <section>
          <h3>{text.request}</h3>
          {request.summary && <p className="request-detail-words">{sampleSaid(request.summary)}</p>}
          <dl className="request-detail-facts">
            <div><dt>{text.kind}</dt><dd>{kind(request)}</dd></div>
            <div><dt>{text.status}</dt><dd>{text.statuses[request.status]}</dd></div>
            <div><dt>{text.asked}</dt><dd>{money(request.amountRequested)}</dd></div>
            <div><dt>{text.approved}</dt><dd>{request.amountApproved === null ? text.notDecided : money(request.amountApproved)}</dd></div>
            <div><dt>{text.payee}</dt><dd>{request.payeeName || text.noPayee}</dd></div>
            <div><dt>{text.referrals}</dt><dd>{referrals.length ? referrals.join(", ") : text.noReferrals}</dd></div>
          </dl>
        </section>

        {visit && (
          <section>
            <h3>{text.visit}</h3>
            <dl className="request-detail-facts">
              <div><dt>{text.visitOn}</dt><dd>{format(visit.at, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}</dd></div>
              <div>
                <dt>{text.visitors}</dt>
                <dd>{visitors.length === 2 ? fill(text.pair, { first: visitors[0], second: visitors[1] }) : visitors.join(", ") || text.noVisitors}</dd>
              </div>
            </dl>
          </section>
        )}

        <section>
          <h3>{text.past}</h3>
          {past.length ? (
            <table className="request-detail-table">
              <thead>
                <tr>
                  <th scope="col">{text.columns.date}</th>
                  <th scope="col">{text.columns.kind}</th>
                  <th scope="col">{text.columns.asked}</th>
                  <th scope="col">{text.columns.approved}</th>
                  <th scope="col">{text.columns.status}</th>
                </tr>
              </thead>
              <tbody>
                {past.map((row) => (
                  <tr key={row.id}>
                    <td>{format(row.createdAt, { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td>{kind(row)}</td>
                    <td>{money(row.amountRequested)}</td>
                    <td>{row.amountApproved === null ? "—" : money(row.amountApproved)}</td>
                    <td>{text.statuses[row.status]}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={2}>{text.totals} · {text.totalsLine(totals.count)}</th>
                  <td>{money(totals.asked)}</td>
                  <td>{money(totals.approved)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="request-detail-words">{text.pastNone}</p>
          )}
        </section>
        <footer>
          <Lock size={15} aria-hidden="true" /> {text.private}
        </footer>
      </article>
    </>
  );
}

/** From a home visit sheet: the neighbor's requests are read with the audit line the sheet's opening wrote. */
export function RequestDetailFromVisit({ churchId, neighborId, requestId, opening, neighbor, visit }: { churchId: Id<"churches">; neighborId: Id<"neighbors">; requestId: Id<"assistanceRequests">; opening: Id<"auditEvents">; neighbor: DetailNeighbor; visit: DetailVisit }) {
  const { words } = useWorkspace();
  const rows = useQuery(api.assistance.requestsForNeighbor, { churchId, neighborId, opening });
  if (!rows) return <HelpLoading label={requestDetailWords(words.locale).opening} />;
  return <RequestDetailView neighbor={neighbor} rows={rows} requestId={requestId} visit={visit} />;
}
