"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { CircleCheck } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { Input } from "@/components/ui/input";
import { readFailure } from "@/components/workspace/failure";
import { DateField } from "@/components/workspace/date-field";
import { LiveField } from "@/components/workspace/primitives";
import { useWorkspace } from "@/components/workspace/context";
import { LedgerLoading } from "@/components/workspace/treasury/ledger-view";
import {
  FormActions,
  FormError,
  type Refusal,
} from "@/components/workspace/treasury/form-parts";
import { dayLabel, type Shelf } from "@/components/workspace/treasury/labels";

const many = (n: number) =>
  `${n} ${Math.abs(n) === 1 ? "voucher" : "vouchers"}`;
const art = {
  backgroundImage: "url(/assets/painted-world/meal.webp)",
};
export type Vouchers = {
  item: string;
  change: number;
  date: string;
  note: string;
};

function VoucherForm({
  items,
  today,
  onSubmit,
  onCancel,
}: {
  items: string[];
  today: string;
  onSubmit: (vouchers: Vouchers) => Promise<Refusal>;
  onCancel: () => void;
}) {
  const [item, setItem] = useState(items[0] ?? "");
  const [count, setCount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const change = /^-?\d+$/.test(count.trim()) ? Number(count) : null;
  const down = change !== null && change < 0;
  return (
    <form
      className="live-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!change)
          return setError(
            "Enter how many as a whole number, like 20. To take a miscount off, put a minus first, like -2.",
          );
        if (down && !note.trim())
          return setError("Say why the count is going down.");
        setError("");
        setSaving(true);
        const refusal = await onSubmit({ item, change, date, note });
        setSaving(false);
        if (refusal) setError(refusal);
      }}
    >
      <LiveField label="What the voucher is for">
        <Input
          name="item"
          list="treasury-voucher-items"
          maxLength={120}
          placeholder="Winter coat, furniture, clothing…"
          value={item}
          onChange={(event) => setItem(event.target.value)}
          required
        />
        <datalist id="treasury-voucher-items">
          {items.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </LiveField>
      <div className="live-form-grid treasury-form-grid">
        <LiveField label="How many">
          <Input
            name="count"
            inputMode="numeric"
            autoComplete="off"
            placeholder="20"
            value={count}
            onChange={(event) => setCount(event.target.value)}
            required
          />
        </LiveField>
        <LiveField label="Day">
          <DateField name="date" max={today} value={date} onChange={setDate} required />
        </LiveField>
      </div>
      <LiveField
        label={down ? "Why the count is going down" : "Note (optional)"}
      >
        <Input
          name="note"
          maxLength={200}
          placeholder={
            down
              ? "Counted by hand, two were missing"
              : "From the thrift store, November"
          }
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </LiveField>
      {error && <FormError message={error} />}
      <FormActions saving={saving} onCancel={onCancel}>
        {down ? "Correct the count" : "Put on the shelf"}
      </FormActions>
    </form>
  );
}

/** How many of each voucher are on hand, and what moved lately. A count, never money. */
export function ShelfView({
  shelf,
  done,
  onAdd,
}: {
  shelf: Shelf;
  done: string;
  onAdd: () => void;
}) {
  return (
    <>
      {done && (
        <div className="live-success help-done treasury-notice" role="status">
          <CircleCheck size={22} aria-hidden="true" />
          <span>{done}</span>
        </div>
      )}
      {shelf.items.length ? (
        <>
          <div className="live-section-head">
            <h2>On hand</h2>
            <span className="live-count">
              Counted from what came in and what was given
            </span>
          </div>
          <div className="live-table-scroll">
            <table className="help-ledger treasury-shelf">
              <thead>
                <tr>
                  <th scope="col">Voucher</th>
                  <th scope="col" className="help-money">
                    Received
                  </th>
                  <th scope="col" className="help-money">
                    Given
                  </th>
                  <th scope="col" className="help-money">
                    On hand
                  </th>
                </tr>
              </thead>
              <tbody>
                {shelf.items.map((row) => (
                  <tr key={row.item}>
                    <td className="help-what">
                      {row.item}
                      {row.onHand < 0 && (
                        <small>
                          More were given than were put on the shelf. Record
                          what you received.
                        </small>
                      )}
                    </td>
                    <td className="help-money" data-label="Received">
                      {row.received}
                    </td>
                    <td className="help-money" data-label="Given">
                      {row.given}
                    </td>
                    <td className="help-money" data-label="On hand" data-total>
                      {row.onHand === 0 && <small>none left</small>}
                      {row.onHand}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <section
            className="treasury-lately treasury-moves"
            aria-labelledby="treasury-moves-title"
          >
            <div className="live-section-head">
              <h2 id="treasury-moves-title">Lately</h2>
              <span className="live-count">
                The newest {shelf.lately.length}
              </span>
            </div>
            <ul className="treasury-lines">
              {shelf.lately.map((row) => (
                <li key={row.id}>
                  <span>{dayLabel(row.date)}</span>
                  <span>
                    {row.change > 0 ? "+" : "−"}
                    {many(Math.abs(row.change))}, {row.item}
                  </span>
                  <span>
                    {row.note ||
                      (row.forRequest ? "Given on a request" : "Received")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <div className="help-empty" data-first>
          <div className="help-empty-art" style={art} aria-hidden="true" />
          <div>
            <h3>Nothing on the shelf yet.</h3>
            <p>
              When the thrift store hands you vouchers, record how many. Each
              one given on a request comes off the count by itself.
            </p>
            <Button onClick={onAdd}>Record vouchers received</Button>
          </div>
        </div>
      )}
    </>
  );
}

/** Fetches the shelf and records what is put on it. */
export function ShelfRoom({
  churchId,
  today,
  onBack,
}: {
  churchId: Id<"churches">;
  today: string;
  onBack: () => void;
}) {
  const { setHeading, setHeadAction } = useWorkspace();
  // The head's way back always runs the newest onBack without redrawing the head.
  const back = useRef(onBack);
  useEffect(() => {
    back.current = onBack;
  });
  const shelf = useQuery(api.treasury.voucherShelf, { churchId });
  const recordVouchers = useMutation(api.treasury.recordVouchers);
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState("");
  const stocked = Boolean(shelf?.items.length);
  useLayoutEffect(() => {
    setHeading({
      title: "The voucher shelf",
      deck: "Thrift store vouchers on hand. A count, kept apart from the money.",
      back: { label: "Ledger", run: () => back.current() },
    });
    return () => setHeading(null);
  }, [setHeading]);
  useLayoutEffect(() => {
    if (!stocked) return;
    setHeadAction({
      label: "Record vouchers",
      plus: true,
      run: () => setAdding(true),
    });
    return () => setHeadAction(null);
  }, [stocked, setHeadAction]);

  if (!shelf) return <LedgerLoading />;
  return (
    <>
      <ShelfView
        shelf={shelf}
        done={done}
        onAdd={() => setAdding(true)}
      />
      <LiveDialog
        open={adding}
        onClose={() => setAdding(false)}
        className="treasury-dialog"
        title="Record vouchers"
        description="Vouchers the thrift store gave you, or a correction after counting them by hand."
      >
        <VoucherForm
          items={shelf.items.map((row) => row.item)}
          today={today}
          onCancel={() => setAdding(false)}
          onSubmit={async (vouchers) => {
            try {
              await recordVouchers({ churchId, ...vouchers });
            } catch (cause) {
              return readFailure(cause, "That couldn’t be recorded. Please try again.");
            }
            setAdding(false);
            setDone(
              vouchers.change > 0
                ? `${many(vouchers.change)} for ${vouchers.item.trim()} are on the shelf.`
                : `The count for ${vouchers.item.trim()} is corrected.`,
            );
            return null;
          }}
        />
      </LiveDialog>
    </>
  );
}
