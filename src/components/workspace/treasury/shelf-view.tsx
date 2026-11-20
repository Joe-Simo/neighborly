"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "@/components/workspace/query";
import { HelpDone } from "@/components/workspace/help-line/room";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { Input } from "@/components/ui/input";
import { sayFailure } from "@/components/workspace/failure";
import { DateField } from "@/components/workspace/date-field";
import { LiveField, markWrong, PaperScene } from "@/components/workspace/primitives";
import { useWorkspace } from "@/components/workspace/context";
import { fill } from "@/lib/words/fill";
import { LedgerLoading } from "@/components/workspace/treasury/ledger-view";
import {
  FormActions,
  FormError,
  type Refusal,
} from "@/components/workspace/treasury/form-parts";
import { dayLabel, type Shelf } from "@/components/workspace/treasury/labels";

type Vouchers = {
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
  const w = useWorkspace().words.rooms.treasury.shelf.form;
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
        const form = event.currentTarget;
        if (!change) markWrong(form, "count", w.wrong);
        if (down && !note.trim()) markWrong(form, "note", w.sayWhy);
        if (!form.checkValidity() || !change) return;
        setError("");
        setSaving(true);
        const refusal = await onSubmit({ item, change, date, note });
        setSaving(false);
        if (refusal) setError(refusal);
      }}
    >
      <LiveField label={w.item}>
        <Input
          name="item"
          list="treasury-voucher-items"
          maxLength={120}
          placeholder={w.itemExample}
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
        <LiveField label={w.count}>
          <Input
            name="count"
            inputMode="numeric"
            autoComplete="off"
            value={count}
            onChange={(event) => setCount(event.target.value)}
            required
          />
        </LiveField>
        <LiveField label={w.day}>
          <DateField name="date" max={today} value={date} onChange={setDate} required />
        </LiveField>
      </div>
      <LiveField
        label={down ? w.why : w.note}
      >
        <Input
          name="note"
          maxLength={200}
          placeholder={down ? w.whyExample : w.noteExample}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </LiveField>
      {error && <FormError message={error} />}
      <FormActions saving={saving} onCancel={onCancel}>
        {down ? w.correct : w.put}
      </FormActions>
    </form>
  );
}

/** How many of each voucher are on hand, and what moved lately. A count, never money. */
function ShelfView({
  shelf,
  done,
  onAdd,
}: {
  shelf: Shelf;
  done: string;
  onAdd: () => void;
}) {
  const { words, sampleSaid } = useWorkspace();
  const w = words.rooms.treasury.shelf;
  return (
    <>
      {done && <HelpDone className="treasury-notice" focus={false}>{done}</HelpDone>}
      {shelf.items.length ? (
        <>
          <div className="live-section-head">
            <h2>{w.onHand}</h2>
            <span className="live-count">
              {w.counted}
            </span>
          </div>
          <div className="live-table-scroll">
            <table className="help-ledger treasury-shelf">
              <caption className="sr-only">{w.onHand}</caption>
              <thead>
                <tr>
                  <th scope="col">{w.columns.voucher}</th>
                  <th scope="col" className="help-money">
                    {w.columns.received}
                  </th>
                  <th scope="col" className="help-money">
                    {w.columns.given}
                  </th>
                  <th scope="col" className="help-money">
                    {w.columns.onHand}
                  </th>
                </tr>
              </thead>
              <tbody>
                {shelf.items.map((row) => (
                  <tr key={row.item}>
                    <th scope="row" className="help-what">
                      {sampleSaid(row.item)}
                      {row.onHand < 0 && (
                        <small>
                          {w.short}
                        </small>
                      )}
                    </th>
                    <td className="help-money" data-label={w.columns.received}>
                      {row.received}
                    </td>
                    <td className="help-money" data-label={w.columns.given}>
                      {row.given}
                    </td>
                    <td className="help-money" data-label={w.columns.onHand} data-total>
                      {row.onHand === 0 && <small>{w.noneLeft}</small>}
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
              <h2 id="treasury-moves-title">{w.lately}</h2>
              <span className="live-count">
                {w.newest(shelf.lately.length)}
              </span>
            </div>
            <ul className="treasury-lines">
              {shelf.lately.map((row) => (
                <li key={row.id}>
                  <span>{dayLabel(words.locale, row.date)}</span>
                  <span>
                    {fill(row.change > 0 ? w.cameIn : w.wentOut, { vouchers: w.vouchers(Math.abs(row.change)), item: row.item })}
                  </span>
                  <span>
                    {/* A request moves vouchers with one of two sentences the backend writes itself (treasury.ts): those are
                        said in the person's language. Anything else is a note someone typed, shown as typed. */}
                    {row.forRequest && row.note === "Back on the shelf"
                      ? w.backOnShelf
                      : row.forRequest && (!row.note || row.note === "Given on a request")
                        ? w.givenOnRequest
                        : sampleSaid(row.note ?? "") || w.received}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <div className="help-empty" data-first>
          <PaperScene kind="empty" />
          <div>
            <h3>{w.empty.title}</h3>
            <p>
              {w.empty.deck}
            </p>
            <Button variant="outline" onClick={onAdd}>{w.empty.action}</Button>
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
  const { setHeading, setHeadAction, words } = useWorkspace();
  const room = words.rooms.treasury;
  const w = room.shelf;
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
      title: w.title,
      deck: w.deck,
      back: { label: room.ledgerName, run: () => back.current() },
    });
    return () => setHeading(null);
  }, [setHeading, w.title, w.deck, room.ledgerName]);
  useLayoutEffect(() => {
    if (!stocked) return;
    setHeadAction({
      label: w.record,
      plus: true,
      run: () => setAdding(true),
    });
    return () => setHeadAction(null);
  }, [stocked, setHeadAction, w.record]);

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
        title={w.record}
        description={w.recordDeck}
      >
        <VoucherForm
          items={shelf.items.map((row) => row.item)}
          today={today}
          onCancel={() => setAdding(false)}
          onSubmit={async (vouchers) => {
            try {
              await recordVouchers({ churchId, ...vouchers });
            } catch (cause) {
              return sayFailure(words.notices,cause, room.refused);
            }
            setAdding(false);
            setDone(
              vouchers.change > 0
                ? fill(w.done.added(vouchers.change), { item: vouchers.item.trim() })
                : w.done.corrected(vouchers.item.trim()),
            );
            return null;
          }}
        />
      </LiveDialog>
    </>
  );
}
