"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveEmpty } from "@/components/workspace/primitives";
import { formatCents } from "@/components/workspace/treasury/money";
import {
  categoryLabel,
  dayLabel,
  fullDayLabel,
  monthLabel,
  type Ledger,
  type Payable,
} from "@/components/workspace/treasury/labels";
import "./treasury.css";

const neighborHref = (id: string) =>
  `/app/neighbors?neighbor=${encodeURIComponent(id)}`;
const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export function LedgerView({
  ledger,
  payable,
  onMonth,
  onPay,
}: {
  ledger: Ledger;
  payable: Payable[];
  onMonth: (month: string) => void;
  onPay: (request: Payable) => void;
}) {
  const month = monthLabel(ledger.month, ledger.today);
  const position = ledger.months.indexOf(ledger.month);
  // Months are listed newest first.
  const earlier = ledger.months[position + 1];
  const later = position > 0 ? ledger.months[position - 1] : undefined;
  return (
    <>
      <dl className="treasury-figures">
        <div>
          <dt>Balance today</dt>
          <dd>
            {formatCents(ledger.balance)}
            <small>As of {fullDayLabel(ledger.today)}</small>
          </dd>
        </div>
        <div>
          <dt>In, {month}</dt>
          <dd>
            {formatCents(ledger.moneyIn)}
            <small>
              {ledger.incomeSources.map(categoryLabel).join(", ") ||
                "Nothing received yet"}
            </small>
          </dd>
        </div>
        <div>
          <dt>Out, {month}</dt>
          <dd>
            {formatCents(ledger.moneyOut)}
            <small>
              {count(ledger.neighborsHelped, "neighbor", "neighbors")} helped
            </small>
          </dd>
        </div>
      </dl>

      {payable.length > 0 && (
        <section
          className="live-request-section"
          aria-labelledby="treasury-payable-title"
        >
          <div className="live-section-head">
            <h2 id="treasury-payable-title">Approved, waiting to be paid</h2>
            <span className="live-count">
              {count(payable.length, "request", "requests")} ·{" "}
              {formatCents(payable.reduce((sum, row) => sum + row.remaining, 0))}
            </span>
          </div>
          <div className="live-list">
            {payable.map((request) => (
              <div className="live-row" key={request.requestId}>
                <div className="live-row-main">
                  <h3 className="treasury-owed">
                    {categoryLabel(request.kind)} ·{" "}
                    {formatCents(request.remaining)} to {request.payeeName}
                  </h3>
                  <p>
                    {request.summary}, for{" "}
                    <Link
                      className="live-link"
                      href={neighborHref(request.neighborId)}
                    >
                      {request.neighborName}
                    </Link>
                    {request.paid > 0 &&
                      `. ${formatCents(request.paid)} of ${formatCents(request.amountApproved)} already paid`}
                  </p>
                </div>
                <div className="live-row-actions treasury-pay">
                  <Button size="sm" onClick={() => onPay(request)}>
                    Record payment
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="live-section-head treasury-head">
        <div className="treasury-month">
          <h2 aria-live="polite">{month}</h2>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Earlier month"
            disabled={!earlier}
            onClick={() => earlier && onMonth(earlier)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Later month"
            disabled={!later}
            onClick={() => later && onMonth(later)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
        <span className="live-count">Every payment is tied to a request</span>
      </div>
      {ledger.entries.length ? (
        <div className="live-table-scroll">
          <table className="treasury-ledger" role="table">
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader" scope="col">Date</th>
                <th role="columnheader" scope="col">What</th>
                <th role="columnheader" scope="col">For</th>
                <th role="columnheader" scope="col" className="treasury-money">In</th>
                <th role="columnheader" scope="col" className="treasury-money">Out</th>
                <th role="columnheader" scope="col" className="treasury-money">Balance</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {ledger.entries.map((entry) => (
                <tr role="row" key={entry.id}>
                  <td role="cell">{dayLabel(entry.date)}</td>
                  <td role="cell">{entry.what}</td>
                  <td role="cell">
                    {entry.neighbor ? (
                      <Link
                        className="live-link"
                        href={neighborHref(entry.neighbor.id)}
                      >
                        {entry.neighbor.name}
                      </Link>
                    ) : (
                      categoryLabel(entry.category)
                    )}
                  </td>
                  <td role="cell" className="treasury-money">
                    {entry.kind === "income" && formatCents(entry.amount)}
                  </td>
                  <td role="cell" className="treasury-money">
                    {entry.kind === "expense" && formatCents(entry.amount)}
                  </td>
                  <td role="cell" className="treasury-money">
                    {formatCents(entry.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <LiveEmpty title={`Nothing recorded in ${month}.`}>
          The balance carried in is {formatCents(ledger.opening)}.
        </LiveEmpty>
      )}
    </>
  );
}
