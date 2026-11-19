"use client";

import { keepTitle } from "@/lib/words/titles";
import "@/components/workspace/for-good.css";
import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useAction, useMutation, useQueries } from "convex/react";
import { useQuery } from "@/components/workspace/query";
import { Check, Sparkles } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LiveField, markWrong } from "@/components/workspace/primitives";
import { LiveFailure, LiveWaiting } from "@/components/workspace/states";
import { useWorkspaceIfAny } from "@/components/workspace/context";
import {
  cents,
  shortMoney,
  recordHref,
  type Call,
  type HelpRequest,
  type Neighbor,
} from "@/components/workspace/help-line/format";
import { useSave } from "@/components/workspace/help-line/use-save";
import { words as wordsFor } from "@/lib/words";
import { fill } from "@/lib/words/fill";

/** English, for a sheet laid outside the workspace shell. */
const english = wordsFor();
/** The person's words inside the shell, English outside it. Never throws. */
const useWords = () => useWorkspaceIfAny()?.words ?? english;
type PayeeKind = keyof typeof english.rooms.helpLineForms.request.payees;

type ChurchId = Id<"churches">;
const pick = <Key extends string>(labels: Record<Key, string>, value: string) =>
  (Object.keys(labels) as Key[]).find((key) => key === value);
const fieldsOf = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  return (name: string) => String(data.get(name) ?? "").trim();
};

/**
 * What the treasury's voucher shelf holds. Undefined while it loads, and also when the backend is
 * older than the shelf, so a form offers vouchers only once they can be kept.
 */
function useShelf(churchId: ChurchId, wanted: boolean) {
  const asked = useMemo(() => {
    const shelf: Parameters<typeof useQueries>[0] = {
      shelf: { query: api.treasury.voucherShelf, args: { churchId } },
    };
    return wanted ? shelf : {};
  }, [churchId, wanted]);
  const answer:
    FunctionReturnType<typeof api.treasury.voucherShelf> | Error | undefined =
    useQueries(asked).shelf;
  return answer instanceof Error ? undefined : answer?.items;
}
type Shelf = NonNullable<ReturnType<typeof useShelf>>;
/** The conference's own payees, to suggest as a name is typed. Undefined when the backend has no list yet. */
function usePayees(churchId: ChurchId) {
  const asked = useMemo(() => {
    const payees: Parameters<typeof useQueries>[0] = {
      payees: { query: api.importExport.payees, args: { churchId } },
    };
    return payees;
  }, [churchId]);
  const answer:
    FunctionReturnType<typeof api.importExport.payees> | Error | undefined =
    useQueries(asked).payees;
  return answer instanceof Error ? undefined : answer;
}
const onShelf = (shelf: Shelf, item: string) =>
  shelf.find((line) => line.item.toLowerCase() === item.trim().toLowerCase());
/** The shelf's name for a voucher as a sentence carries it: lower case, and "voucher" said once, by the sentence. */
const itemOf = (voucher: { item: string }) =>
  voucher.item.toLowerCase().replace(/\s+vouchers?$/, "");

export function FormEnd({
  error,
  pending,
  submit,
  value,
  children,
}: {
  error: string;
  pending: boolean;
  submit: string;
  /** Sent as the button's value, for a form with more than one way to save. */
  value?: string;
  children?: ReactNode;
}) {
  return (
    <>
      {error && <LiveFailure message={error} />}
      <div className="live-form-actions">
        <LiveWaiting when={pending} />
        {children}
        <Button type="submit" value={value} disabled={pending}>
          {submit}
        </Button>
      </div>
    </>
  );
}

export function CallForm({
  churchId,
  neighbor,
  onSaved,
  draftable = false,
}: {
  churchId: ChurchId;
  neighbor?: Pick<Neighbor, "id" | "name" | "phone">;
  /** `draft` is true when the person asked to go straight on to the assistant's draft of a request. */
  onSaved: (matched: boolean, callId: Call["id"], draft: boolean) => void;
  /** Offers "Save and draft a request" beside the plain save. */
  draftable?: boolean;
}) {
  const record = useMutation(api.assistance.recordCall);
  const readUrgency = useAction(api.drafts.readUrgency);
  const setUrgency = useMutation(api.assistance.setUrgency);
  const { pending, error, save } = useSave();
  const w = useWords().rooms.helpLineForms.call;
  // With words to draft from and a call back owed, going on to the draft is the main way forward.
  const [said, setSaid] = useState(false);
  const [owed, setOwed] = useState(true);
  const lead = draftable && said && owed;
  return (
    <form
      className="live-form help-form"
      onSubmit={async (event) => {
        // Which of the two buttons sent the form: the plain save, or the one that goes on to a draft.
        const sender = (event.nativeEvent as SubmitEvent).submitter;
        const value = fieldsOf(event);
        const callback = value("callback") === "none" ? "none" : "needed";
        const draft =
          callback === "needed" &&
          sender instanceof HTMLButtonElement &&
          sender.value === "draft";
        const outcome = await save(() =>
          record({
            churchId,
            neighborId: neighbor?.id,
            callerName: value("callerName"),
            phone: value("phone"),
            note: value("note"),
            callback,
          }),
        );
        if (!outcome.saved) return;
        onSaved(outcome.result.neighborId !== null, outcome.result.callId, draft);
        if (callback === "none") return;
        // The assistant reads the note for a reason to call first. The call is already saved;
        // if the assistant is away or finds nothing, the list simply keeps its plain order.
        const { callId } = outcome.result;
        void readUrgency({ churchId, callId })
          .then(({ signs }) =>
            signs.length
              ? setUrgency({
                  churchId,
                  callId,
                  reasons: signs.map((sign) => sign.reason),
                  day:
                    signs.find((sign) => sign.day !== null)?.day ?? undefined,
                  by: "assistant",
                })
              : null,
          )
          .catch(() => null);
      }}
    >
      <div className="live-form-grid help-caller-grid">
        <LiveField label={w.name}>
          <Input
            name="callerName"
            defaultValue={neighbor?.name}
            autoComplete="off"
          />
        </LiveField>
        <LiveField label={w.phone}>
          <Input
            name="phone"
            type="tel"
            defaultValue={neighbor?.phone}
            autoComplete="off"
          />
        </LiveField>
      </div>
      <LiveField label={w.said}>
        <Textarea
          name="note"
          rows={4}
          required
          onChange={(event) => setSaid(!!event.target.value.trim())}
        />
      </LiveField>
      <LiveField label={w.next}>
        <NativeSelect
          name="callback"
          className="w-full"
          defaultValue="needed"
          onChange={(event) => setOwed(event.target.value !== "none")}
        >
          <option value="needed">{w.callBack}</option>
          <option value="none">{w.nothing}</option>
        </NativeSelect>
      </LiveField>
      {lead ? (
        <FormEnd
          error={error}
          pending={pending}
          submit={w.saveAndDraft}
          value="draft"
        >
          <Button type="submit" variant="outline" disabled={pending}>
            {w.save}
          </Button>
        </FormEnd>
      ) : (
        <FormEnd error={error} pending={pending} submit={w.save}>
          {draftable && owed && (
            <Button
              type="submit"
              variant="outline"
              value="draft"
              disabled={pending}
            >
              <Sparkles size={17} aria-hidden="true" /> {w.saveAndDraft}
            </Button>
          )}
        </FormEnd>
      )}
    </form>
  );
}

export function ReturnForm({
  churchId,
  call,
  onSaved,
}: {
  churchId: ChurchId;
  call: Call;
  onSaved: () => void;
}) {
  const markReturned = useMutation(api.assistance.markReturned);
  const { pending, error, save } = useSave("decided");
  const w = useWords().rooms.helpLineForms.call;
  return (
    <form
      className="live-form help-form"
      onSubmit={async (event) => {
        const value = fieldsOf(event);
        const outcome = await save(() =>
          markReturned({
            churchId,
            callId: call.id,
            outcome: value("outcome"),
          }),
        );
        if (outcome.saved) onSaved();
      }}
    >
      <LiveField
        label={w.outcome}
        help={w.outcomeHelp}
      >
        <Textarea name="outcome" rows={3} />
      </LiveField>
      <FormEnd error={error} pending={pending} submit={w.markReturned} />
    </form>
  );
}

export type RequestStart = Partial<
  Pick<HelpRequest, "kind" | "summary" | "payeeName" | "source" | "voucher"> & {
    amountRequested: number | null;
    payeeKind: HelpRequest["payeeKind"] | null;
  }
>;

/** Adds a request for a neighbor, or changes one that is still open when `request` is given. */
export function RequestForm({
  churchId,
  neighborId,
  callId,
  request,
  start = request,
  onSaved,
}: {
  churchId: ChurchId;
  neighborId: Id<"neighbors">;
  callId?: Id<"calls">;
  request?: HelpRequest;
  start?: RequestStart;
  onSaved: () => void;
}) {
  const create = useMutation(api.assistance.createRequest);
  const update = useMutation(api.assistance.updateRequest);
  const { pending, error, save } = useSave();
  const words = useWords();
  const w = words.rooms.helpLineForms.request;
  const [kind, setKind] = useState(start?.kind ?? "rent");
  // The shelf's kind that is chosen; null means a kind the shelf does not hold yet, named by hand.
  const [choice, setChoice] = useState<string | null>();
  const shelf = useShelf(churchId, true);
  const payees = usePayees(churchId);
  const [payeeKind, setPayeeKind] = useState<PayeeKind>(
    start?.payeeKind &&
      start.payeeKind in w.payees &&
      start.payeeKind !== "neighbor"
      ? start.payeeKind
      : "landlord",
  );
  const fromShelf = kind === "voucher" && shelf;
  const asked = start?.voucher?.item ?? "";
  const chosen =
    choice !== undefined || !shelf
      ? (choice ?? null)
      : (onShelf(shelf, asked)?.item ??
        (asked ? null : (shelf[0]?.item ?? null)));
  return (
    <form
      className="live-form help-form"
      onSubmit={async (event) => {
        const form = event.currentTarget;
        const value = fieldsOf(event);
        const amountRequested = fromShelf ? 0 : cents(value("amount"));
        if (amountRequested === null) markWrong(form, "amount", w.amountNeeded);
        if (!form.checkValidity() || amountRequested === null) return;
        const details = {
          churchId,
          kind,
          summary: value("summary"),
          amountRequested,
          payeeKind,
          payeeName: value("payeeName"),
          ...(fromShelf && {
            voucher: {
              item: chosen ?? value("item"),
              quantity: Number(value("quantity")),
            },
          }),
        };
        const outcome = await save(() =>
          request
            ? update({ ...details, requestId: request.id })
            : create({ ...details, neighborId, callId, source: start?.source }),
        );
        if (outcome.saved) onSaved();
      }}
    >
      <div className="live-form-grid">
        <LiveField label={w.kind}>
          <NativeSelect
            name="kind"
            className="w-full"
            value={kind}
            onChange={(event) =>
              setKind(pick(words.kinds, event.target.value) ?? "other")
            }
          >
            {Object.entries(words.kinds).map(([kind, label]) => (
              <option key={kind} value={kind}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </LiveField>
        {fromShelf ? (
          <LiveField label={w.howMany}>
            <Input
              name="quantity"
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              required
              defaultValue={start?.voucher?.quantity ?? 1}
            />
          </LiveField>
        ) : (
          <LiveField label={w.amount}>
            <Input
              name="amount"
              inputMode="decimal"
              required
              defaultValue={
                typeof start?.amountRequested === "number"
                  ? (start.amountRequested / 100).toString()
                  : ""
              }
            />
          </LiveField>
        )}
      </div>
      {fromShelf && fromShelf.length > 0 && (
        <LiveField label={w.voucherFor}>
          <NativeSelect
            className="w-full"
            value={chosen ?? ""}
            onChange={(event) => setChoice(event.target.value || null)}
          >
            {fromShelf.map((line) => (
              <option key={line.item} value={line.item}>
                {fill(w.onShelf(line.onHand), { item: line.item })}
              </option>
            ))}
            <option value="">{w.somethingElse}</option>
          </NativeSelect>
        </LiveField>
      )}
      {fromShelf && chosen === null && (
        <LiveField
          label={fromShelf.length ? w.nameVoucher : w.voucherFor}
          help={w.nameVoucherHelp}
        >
          <Input
            name="item"
            maxLength={80}
            required
            defaultValue={onShelf(fromShelf, asked) ? "" : asked}
          />
        </LiveField>
      )}
      <LiveField label={w.need}>
        <Textarea
          name="summary"
          rows={3}
          required
          defaultValue={start?.summary}
        />
      </LiveField>
      {fromShelf ? (
        <p className="help-form-note">
          {w.shelfNote}
        </p>
      ) : (
        <>
          <div className="live-form-grid">
            <LiveField label={w.payee}>
              <NativeSelect
                name="payeeKind"
                className="w-full"
                value={payeeKind}
                onChange={(event) =>
                  setPayeeKind(
                    pick(w.payees, event.target.value) ?? "vendor",
                  )
                }
              >
                {Object.entries(w.payees).map(([kind, label]) => (
                  <option key={kind} value={kind}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </LiveField>
            <LiveField label={w.payeeName}>
              <Input
                name="payeeName"
                list="help-payees"
                autoComplete="off"
                defaultValue={start?.payeeName}
                onChange={(event) => {
                  // A name from the conference's list brings its kind with it.
                  const typed = event.target.value.trim().toLowerCase();
                  const listed = payees?.find(
                    (payee) => payee.name.toLowerCase() === typed,
                  );
                  if (listed) setPayeeKind(listed.kind);
                }}
              />
              <datalist id="help-payees">
                {payees?.map((payee) => (
                  <option key={payee.id} value={payee.name} />
                ))}
              </datalist>
            </LiveField>
          </div>
          <p className="help-form-note">
            {w.payeeNote}
          </p>
        </>
      )}
      <FormEnd
        error={error}
        pending={pending}
        submit={
          request
            ? w.saveChanges
            : start?.source === "ai_draft"
              ? w.saveDraft
              : w.save
        }
      />
    </form>
  );
}

/** One decision at a time: approve with an amount, or decline with where they were pointed. */
export function DecideForm({
  churchId,
  request,
  decision,
  known,
  onSaved,
}: {
  churchId: ChurchId;
  request: HelpRequest;
  decision: "approved" | "declined";
  /** The group's places, when the caller already has them. */
  known?: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const decide = useMutation(api.assistance.decide);
  const listed = useQuery(
    api.assistance.agencies,
    known ? "skip" : { churchId },
  );
  const agencies = known ?? listed;
  const [referred, setReferred] = useState<string[]>(request.referrals ?? []);
  const approving = decision === "approved";
  const { pending, error, save } = useSave(approving ? "decided" : "saved");
  const voucher = approving ? request.voucher : null;
  const shelf = useShelf(churchId, !!voucher);
  const w = useWords().rooms.helpLineForms.decide;
  // What the shelf holds of the voucher asked for, as its own whole sentence after what was asked.
  const held = voucher && shelf ? onShelf(shelf, voucher.item) : null;
  const shelfLine = !voucher || !shelf ? "" : held ? w.shelfHas(held.onHand) : w.notOnShelf;
  return (
    <form
      className="live-form help-form"
      onSubmit={async (event) => {
        const form = event.currentTarget;
        const value = fieldsOf(event);
        const amountApproved =
          approving && !voucher ? cents(value("amount")) : null;
        if (approving && !voucher && !amountApproved) markWrong(form, "amount", w.amountNeeded);
        const places = [...referred, value("elsewhere")].filter(Boolean);
        if (places.length > 4) markWrong(form, "elsewhere", w.tooManyPlaces);
        if (!form.checkValidity()) return;
        const outcome = await save(() =>
          decide({
            churchId,
            requestId: request.id,
            decision,
            amountApproved: amountApproved ?? undefined,
            ...(voucher && { quantity: Number(value("quantity")) }),
            note: value("note"),
            // An older backend does not know the list of places yet; it keeps the single line.
            ...(agencies
              ? { referrals: places }
              : { referral: places.join(", ") }),
          }),
        );
        if (outcome.saved) onSaved();
      }}
    >
      {voucher && (
        <LiveField
          label={w.give}
          help={[fill(w.askedVouchers(voucher.quantity), { item: itemOf(voucher) }), shelfLine].filter(Boolean).join(" ")}
        >
          <Input
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            required
            defaultValue={voucher.quantity}
          />
        </LiveField>
      )}
      {approving && !voucher && (
        <LiveField
          label={w.amount}
          help={
            request.payeeName
              ? fill(w.askedPaidTo, { amount: shortMoney(request.amountRequested), name: request.payeeName.replace(/\.$/, "") })
              : fill(w.asked, { amount: shortMoney(request.amountRequested) })
          }
        >
          <Input
            name="amount"
            inputMode="decimal"
            defaultValue={(request.amountRequested / 100).toString()}
          />
        </LiveField>
      )}
      <LiveField
        label={
          approving ? w.note : w.why
        }
      >
        <Textarea name="note" rows={3} />
      </LiveField>
      <fieldset className="help-lines">
        <legend>{w.referred}</legend>
        {agencies && agencies.length > 0 && (
          <ToggleGroup
            type="multiple"
            variant="outline"
            className="help-places"
            aria-label={w.places}
            value={referred}
            onValueChange={setReferred}
          >
            {agencies.map((agency) => (
              <ToggleGroupItem key={agency.id} value={agency.name}>
                <Check aria-hidden="true" />
                {agency.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        <LiveField
          label={agencies?.length ? w.elsewhere : w.where}
          help={
            agencies?.length
              ? w.elsewhereHelp
              : w.whereHelp
          }
        >
          <Input
            name="elsewhere"
            maxLength={120}
            defaultValue={request.referral}
          />
        </LiveField>
      </fieldset>
      <FormEnd
        error={error}
        pending={pending}
        submit={approving ? w.approve : w.decline}
      />
    </form>
  );
}

/** A voucher that was given is finished, so ending it is taking the voucher back. */
export const takingBack = (request: HelpRequest) =>
  !!request.voucher && request.status === "paid";

/** Ends a request that will go no further, and says plainly what happens to what was given or paid. */
export function CloseForm({
  churchId,
  request,
  onSaved,
}: {
  churchId: ChurchId;
  request: HelpRequest;
  onSaved: () => void;
}) {
  const close = useMutation(api.assistance.closeRequest);
  const payable = useQuery(
    api.treasury.payable,
    request.voucher ? "skip" : { churchId },
  );
  const { pending, error, save } = useSave();
  const w = useWords().rooms.helpLineForms.close;
  const paid = payable?.find((row) => row.requestId === request.id)?.paid ?? 0;
  const back = takingBack(request);
  const effect = request.voucher
    ? request.status === "paid"
      ? fill(w.goesBack(request.voucher.quantity), { item: itemOf(request.voucher) })
      : w.nothingGiven
    : !payable
      ? ""
      : paid > 0
        ? fill(w.partPaid, { paid: shortMoney(paid), approved: shortMoney(request.amountApproved ?? 0) })
        : w.noMoney;
  return (
    <form
      className="live-form help-form"
      onSubmit={async (event) => {
        const value = fieldsOf(event);
        const outcome = await save(() =>
          close({ churchId, requestId: request.id, note: value("note") }),
        );
        if (outcome.saved) onSaved();
      }}
    >
      <LiveField
        label={back ? w.whyBack : w.why}
      >
        <Textarea name="note" rows={3} required maxLength={500} />
      </LiveField>
      <p className="help-form-note">{effect}</p>
      <FormEnd
        error={error}
        pending={pending}
        submit={back ? w.takeBack : w.close}
      />
    </form>
  );
}

/** Adds a neighbor, or changes one when `neighbor` is given. Shows who is already on file before saving a second time. */
export function NeighborForm({
  churchId,
  neighbor,
  call,
  submit,
  submitNew,
  useLabel,
  onSaved,
}: {
  churchId: ChurchId;
  neighbor?: Neighbor;
  call?: Call;
  /** What the save button says when adding a neighbor leads on to something else. */
  submit?: string;
  /** The same, once someone on file matches and this one is saved as new. */
  submitNew?: string;
  /** When given, someone already on file can be chosen instead, under this label. */
  useLabel?: string;
  onSaved: (neighborId: Id<"neighbors">) => void;
}) {
  const create = useMutation(api.neighbors.create);
  const update = useMutation(api.neighbors.update);
  const { pending, error, save } = useSave();
  const w = useWords().rooms.helpLineForms.neighbor;
  const [typed, setTyped] = useState({
    name: neighbor?.name ?? call?.callerName ?? "",
    phone: neighbor?.phone ?? call?.phone ?? "",
  });
  const [checked, setChecked] = useState<typeof typed | null>(null);
  // An older backend does not send or accept the alert yet.
  const hasAlert = typeof neighbor?.alert === "string";
  // A household speaks what it speaks: the three met most often are offered, and any other is named.
  const [speaks, setSpeaks] = useState<string>(neighbor?.language ?? "en");
  const onFile = useQuery(
    api.neighbors.matches,
    !neighbor && checked ? { churchId, ...checked } : "skip",
  );
  const duplicates = checked === typed ? (onFile ?? []) : [];
  return (
    <form
      className="live-form help-form"
      onSubmit={async (event) => {
        const value = fieldsOf(event);
        const details = {
          churchId,
          name: value("name"),
          phone: value("phone"),
          email: value("email"),
          address: value("address"),
          adults: Number(value("adults")),
          children: Number(value("children")),
          language: pick(w.languages, value("language")) ?? "en",
          ...(value("language") === "other" ? { languageName: value("languageName") } : {}),
          notes: value("notes"),
        };
        if (neighbor) {
          const outcome = await save(() =>
            update({
              ...details,
              ...(hasAlert ? { alert: value("alert") } : {}),
              neighborId: neighbor.id,
            }),
          );
          if (outcome.saved) onSaved(neighbor.id);
          return;
        }
        const outcome = await save(() =>
          create({
            ...details,
            callId: call?.id,
            confirmedNew: duplicates.length > 0,
          }),
        );
        if (outcome.saved) onSaved(outcome.result);
        else setChecked(typed);
      }}
    >
      <div className="live-form-grid help-caller-grid">
        <LiveField label={w.name}>
          <Input
            name="name"
            required
            autoComplete="off"
            value={typed.name}
            onChange={(event) =>
              setTyped({ ...typed, name: event.target.value })
            }
          />
        </LiveField>
        <LiveField label={w.phone}>
          <Input
            name="phone"
            type="tel"
            autoComplete="off"
            value={typed.phone}
            onChange={(event) =>
              setTyped({ ...typed, phone: event.target.value })
            }
          />
        </LiveField>
      </div>
      <LiveField label={w.address}>
        <Input
          name="address"
          defaultValue={neighbor?.address}
          autoComplete="off"
        />
      </LiveField>
      <div className="live-form-grid">
        <LiveField label={w.adults}>
          <Input
            name="adults"
            type="number"
            min={1}
            max={30}
            required
            defaultValue={neighbor?.adults ?? 1}
          />
        </LiveField>
        <LiveField label={w.children}>
          <Input
            name="children"
            type="number"
            min={0}
            max={30}
            required
            defaultValue={neighbor?.children ?? 0}
          />
        </LiveField>
      </div>
      <div className="live-form-grid">
        <LiveField label={w.speaks}>
          <NativeSelect
            name="language"
            className="w-full"
            value={speaks}
            onChange={(event) => setSpeaks(event.target.value)}
          >
            {Object.entries(w.languages).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </LiveField>
        {speaks === "other" && (
          <LiveField label={w.language}>
            <Input
              name="languageName"
              required
              maxLength={40}
              defaultValue={neighbor?.languageName}
              autoComplete="off"
            />
          </LiveField>
        )}
        <LiveField label={w.email}>
          <Input
            name="email"
            type="email"
            defaultValue={neighbor?.email}
            autoComplete="off"
          />
        </LiveField>
      </div>
      <LiveField
        label={w.notes}
        help={w.notesHelp}
      >
        <Textarea name="notes" rows={3} defaultValue={neighbor?.notes} />
      </LiveField>
      {neighbor && hasAlert && (
        <LiveField
          label={w.alert}
          help={w.alertHelp}
        >
          <Input name="alert" maxLength={160} defaultValue={neighbor.alert} />
        </LiveField>
      )}
      {duplicates.length > 0 && (
        <div className="live-error help-matches" role="alert">
          <p>
            {fill(w.onFile[duplicates[0].same === "phone" ? "phone" : "name"], { name: duplicates[0].name })}
          </p>
          <p className="live-error-recovery">
            {w.recovery[useLabel ? "use" : "open"][duplicates[0].same === "phone" ? "phone" : "name"]}
          </p>
          {duplicates.map((match) => (
            <div className="live-row" key={match.id}>
              <div>
                <h3>{keepTitle(match.name)}</h3>
                {match.address && <p>{match.address}</p>}
              </div>
              {useLabel ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onSaved(match.id)}
                >
                  {useLabel}
                </Button>
              ) : (
                <Button variant="outline" size="sm" asChild>
                  <Link href={recordHref(match.id)}>{w.openRecord}</Link>
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      <FormEnd
        error={duplicates.length ? "" : error}
        pending={pending}
        submit={
          neighbor
            ? w.saveChanges
            : duplicates.length
              ? (submitNew ?? w.saveNew)
              : (submit ?? w.add)
        }
      />
    </form>
  );
}

/** The same reading of a name the backend makes, so the button wakes only when the names agree. */
const nameKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The box where a name is typed to confirm an act that cannot be undone. While the person types, nothing is
 * said. When they leave the box or press Enter with something in it that is not the name, one quiet line
 * gives the name as it is written; it goes as soon as they type again.
 */
export function NameToConfirm({
  label,
  name,
  typed,
  onTyped,
}: {
  label: string;
  name: string;
  typed: string;
  onTyped: (typed: string) => void;
}) {
  const note = useId();
  const w = useWords().rooms.helpLineForms.confirm;
  const [left, setLeft] = useState(false);
  const off = left && typed.trim() !== "" && nameKey(typed) !== nameKey(name);
  return (
    <LiveField label={label}>
      <Input
        value={typed}
        onChange={(event) => {
          setLeft(false);
          onTyped(event.target.value);
        }}
        onBlur={() => setLeft(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") setLeft(true);
        }}
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        aria-describedby={off ? note : undefined}
        required
      />
      {off && (
        <small id={note} className="live-field-needed" role="status">
          {w.noMatch}{" "}
          <span className={name.length <= 28 ? "help-name-whole" : undefined}>{name}.</span>
        </small>
      )}
    </LiveField>
  );
}

/**
 * Removes a neighbor's record for good: says what goes and what stays, and asks for the
 * neighbor's name before the button will work. `onBegin` lets the screen stop reading the
 * record before it is gone; `onRefused` lets it read again.
 */
export function RemoveForm({
  churchId,
  neighbor,
  onBegin,
  onRefused,
  onRemoved,
}: {
  churchId: ChurchId;
  neighbor: Pick<Neighbor, "id" | "name">;
  onBegin: () => void;
  onRefused: () => void;
  onRemoved: () => void;
}) {
  const remove = useMutation(api.neighbors.remove);
  const { pending, error, save } = useSave();
  const w = useWords().rooms.helpLineForms.remove;
  const [typed, setTyped] = useState("");
  const agrees = nameKey(typed) === nameKey(neighbor.name);
  return (
    <form
      className="live-form help-form help-for-good"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!agrees) return;
        onBegin();
        const outcome = await save(() =>
          remove({ churchId, neighborId: neighbor.id, typedName: typed }),
        );
        if (outcome.saved) onRemoved();
        else onRefused();
      }}
    >
      <dl className="for-good-terms">
        <div>
          <dt>{w.goes}</dt>
          <dd>
            {w.goesDetail}
          </dd>
        </div>
        <div>
          <dt>{w.stays}</dt>
          <dd>
            {w.staysDetail}
          </dd>
        </div>
      </dl>
      <NameToConfirm
        label={w.type(neighbor.name)}
        name={neighbor.name}
        typed={typed}
        onTyped={setTyped}
      />
      <p className="help-form-note">{w.final}</p>
      {error && <LiveFailure message={error} kept={w.kept} />}
      <div className="live-form-actions">
        <LiveWaiting when={pending} />
        <Button
          type="submit"
          className="for-good-confirm"
          disabled={pending || !agrees}
        >
          {w.remove}
        </Button>
      </div>
    </form>
  );
}
