"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useAction, useMutation, useQueries, useQuery } from "convex/react";
import { Check, X } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LiveField } from "@/components/workspace/primitives";
import {
  cents,
  kindLabels,
  languageLabels,
  money,
  payeeLabels,
  shortMoney,
  recordHref,
  type Call,
  type HelpRequest,
  vouchers,
  type Neighbor,
} from "@/components/workspace/help-line/format";
import { useSave } from "@/components/workspace/help-line/use-save";

type ChurchId = Id<"churches">;
const pick = <Key extends string>(labels: Record<Key, string>, value: string) =>
  (Object.keys(labels) as Key[]).find((key) => key === value);
const fieldsOf = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  return (name: string) => String(data.get(name) ?? "").trim();
};

export function HelpDialog({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="live-dialog help-dialog"
        showCloseButton={false}
        // Start in the first box to fill in, not on the close button.
        onOpenAutoFocus={(event) => {
          const first =
            event.currentTarget instanceof HTMLElement &&
            event.currentTarget.querySelector<HTMLElement>(
              "input, textarea, select",
            );
          if (!first) return;
          event.preventDefault();
          first.focus();
        }}
      >
        {/* The title and the way out stay in view while a long form scrolls, as the button does. */}
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label="Close">
              <X aria-hidden="true" />
            </Button>
          </DialogClose>
        </DialogHeader>
        <DialogDescription>{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

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
const onHand = (line: Shelf[number] | undefined) =>
  !line
    ? "not on the shelf yet"
    : line.onHand > 0
      ? `${line.onHand} on hand`
      : "none on hand";

export function FormEnd({
  error,
  pending,
  submit,
  children,
}: {
  error: string;
  pending: boolean;
  submit: string;
  children?: ReactNode;
}) {
  return (
    <>
      {error && (
        <div className="live-error" role="alert">
          <p>{error}</p>
          <p className="live-error-recovery">
            What you typed is still here. Correct it and save again.
          </p>
        </div>
      )}
      <div className="live-form-actions">
        {children}
        <Button type="submit" disabled={pending}>
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
}: {
  churchId: ChurchId;
  neighbor?: Pick<Neighbor, "id" | "name" | "phone">;
  onSaved: (matched: boolean) => void;
}) {
  const record = useMutation(api.assistance.recordCall);
  const readUrgency = useAction(api.drafts.readUrgency);
  const setUrgency = useMutation(api.assistance.setUrgency);
  const { pending, error, save } = useSave();
  return (
    <form
      className="live-form help-form"
      onSubmit={async (event) => {
        const value = fieldsOf(event);
        const callback = value("callback") === "none" ? "none" : "needed";
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
        onSaved(outcome.result.neighborId !== null);
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
      <div className="live-form-grid">
        <LiveField label="Name">
          <Input
            name="callerName"
            defaultValue={neighbor?.name}
            autoComplete="off"
          />
        </LiveField>
        <LiveField label="Phone">
          <Input
            name="phone"
            type="tel"
            defaultValue={neighbor?.phone}
            autoComplete="off"
          />
        </LiveField>
      </div>
      <LiveField label="What they said">
        <Textarea name="note" rows={4} required />
      </LiveField>
      <LiveField label="Next step">
        <NativeSelect name="callback" className="w-full" defaultValue="needed">
          <option value="needed">Call them back</option>
          <option value="none">Nothing more to do</option>
        </NativeSelect>
      </LiveField>
      <FormEnd error={error} pending={pending} submit="Save call" />
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
  const { pending, error, save } = useSave();
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
        label="What came of it"
        help="For example: home visit planned for Thursday, or referred to 211."
      >
        <Textarea name="outcome" rows={3} />
      </LiveField>
      <FormEnd error={error} pending={pending} submit="Mark returned" />
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
  const [amountError, setAmountError] = useState("");
  const [kind, setKind] = useState(start?.kind ?? "rent");
  // The shelf's kind that is chosen; null means a kind the shelf does not hold yet, named by hand.
  const [choice, setChoice] = useState<string | null>();
  const shelf = useShelf(churchId, true);
  const payees = usePayees(churchId);
  const [payeeKind, setPayeeKind] = useState<keyof typeof payeeLabels>(
    start?.payeeKind &&
      start.payeeKind in payeeLabels &&
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
        const value = fieldsOf(event);
        const amountRequested = fromShelf ? 0 : cents(value("amount"));
        if (amountRequested === null)
          return setAmountError("Enter the amount in dollars, such as 450.");
        setAmountError("");
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
        <LiveField label="Kind of help">
          <NativeSelect
            name="kind"
            className="w-full"
            value={kind}
            onChange={(event) =>
              setKind(pick(kindLabels, event.target.value) ?? "other")
            }
          >
            {Object.entries(kindLabels).map(([kind, label]) => (
              <option key={kind} value={kind}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </LiveField>
        {fromShelf ? (
          <LiveField label="How many">
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
          <LiveField label="Amount asked, in dollars">
            <Input
              name="amount"
              inputMode="decimal"
              placeholder="450"
              required
              aria-invalid={!!amountError}
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
        <LiveField label="Voucher for">
          <NativeSelect
            className="w-full"
            value={chosen ?? ""}
            onChange={(event) => setChoice(event.target.value || null)}
          >
            {fromShelf.map((line) => (
              <option key={line.item} value={line.item}>
                {line.item}, {onHand(line)}
              </option>
            ))}
            <option value="">Something else</option>
          </NativeSelect>
        </LiveField>
      )}
      {fromShelf && chosen === null && (
        <LiveField
          label={fromShelf.length ? "Name the voucher" : "Voucher for"}
          help="The treasurer adds it to the shelf when vouchers arrive."
        >
          <Input
            name="item"
            maxLength={80}
            required
            defaultValue={onShelf(fromShelf, asked) ? "" : asked}
          />
        </LiveField>
      )}
      {fromShelf ? (
        <p className="help-form-note">
          Vouchers come off the shelf when the request is approved. Nobody is
          paid.
        </p>
      ) : (
        <>
          <div className="live-form-grid">
            <LiveField label="Who is paid">
              <NativeSelect
                name="payeeKind"
                className="w-full"
                value={payeeKind}
                onChange={(event) =>
                  setPayeeKind(
                    pick(payeeLabels, event.target.value) ?? "vendor",
                  )
                }
              >
                {Object.entries(payeeLabels).map(([kind, label]) => (
                  <option key={kind} value={kind}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </LiveField>
            <LiveField label="Their name">
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
            Payments go to the landlord, utility or store, never to the
            neighbor.
          </p>
        </>
      )}
      <FormEnd
        error={amountError || error}
        pending={pending}
        submit={request ? "Save changes" : "Save request"}
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
  const { pending, error, save } = useSave();
  const [amountError, setAmountError] = useState("");
  const approving = decision === "approved";
  const voucher = approving ? request.voucher : null;
  const shelf = useShelf(churchId, !!voucher);
  return (
    <form
      className="live-form help-form"
      onSubmit={async (event) => {
        const value = fieldsOf(event);
        const amountApproved =
          approving && !voucher ? cents(value("amount")) : null;
        if (approving && !voucher && !amountApproved)
          return setAmountError("Enter the amount to approve, in dollars.");
        const places = [...referred, value("elsewhere")].filter(Boolean);
        if (places.length > 4)
          return setAmountError("Name at most four places.");
        setAmountError("");
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
          label="How many to give"
          help={`They asked for ${vouchers(voucher)}.${shelf ? ` The shelf has ${onHand(onShelf(shelf, voucher.item))}.` : ""}`}
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
          label="Amount to approve, in dollars"
          help={`They asked for ${money(request.amountRequested)}${request.payeeName ? `, paid to ${request.payeeName.replace(/\.$/, "")}` : ""}.`}
        >
          <Input
            name="amount"
            inputMode="decimal"
            aria-invalid={!!amountError}
            defaultValue={(request.amountRequested / 100).toString()}
          />
        </LiveField>
      )}
      <LiveField
        label={
          approving ? "Note on the decision (optional)" : "Why it was declined"
        }
      >
        <Textarea name="note" rows={3} />
      </LiveField>
      <fieldset className="help-lines">
        <legend>Also referred to</legend>
        {agencies && agencies.length > 0 && (
          <ToggleGroup
            type="multiple"
            variant="outline"
            className="help-places"
            aria-label="Places your group refers to"
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
          label={agencies?.length ? "Somewhere else" : "Where"}
          help={
            agencies?.length
              ? "A place not listed. It is offered here next time."
              : "Such as 211 or the county rent program. It is offered here next time."
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
        error={amountError || error}
        pending={pending}
        submit={approving ? "Approve request" : "Decline request"}
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
  const paid = payable?.find((row) => row.requestId === request.id)?.paid ?? 0;
  const back = takingBack(request);
  const effect = request.voucher
    ? request.status === "paid"
      ? `${vouchers(request.voucher)} ${request.voucher.quantity === 1 ? "goes" : "go"} back on the shelf. No money has moved.`
      : "Nothing was given. No money has moved."
    : !payable
      ? ""
      : paid > 0
        ? `${shortMoney(paid)} of ${shortMoney(request.amountApproved ?? 0)} was paid and stays in the ledger. The rest is not paid.`
        : "No money has moved.";
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
        label={back ? "Why it is being taken back" : "Why it is being closed"}
      >
        <Textarea name="note" rows={3} required maxLength={500} />
      </LiveField>
      <p className="help-form-note">{effect}</p>
      <FormEnd
        error={error}
        pending={pending}
        submit={back ? "Take back voucher" : "Close request"}
      />
    </form>
  );
}

/** Adds a neighbor, or changes one when `neighbor` is given. Shows who is already on file before saving a second time. */
export function NeighborForm({
  churchId,
  neighbor,
  call,
  onSaved,
  aside,
}: {
  churchId: ChurchId;
  neighbor?: Neighbor;
  call?: Call;
  onSaved: (neighborId: Id<"neighbors">) => void;
  aside?: ReactNode;
}) {
  const create = useMutation(api.neighbors.create);
  const update = useMutation(api.neighbors.update);
  const { pending, error, save } = useSave();
  const [typed, setTyped] = useState({
    name: neighbor?.name ?? call?.callerName ?? "",
    phone: neighbor?.phone ?? call?.phone ?? "",
  });
  const [checked, setChecked] = useState<typeof typed | null>(null);
  // An older backend does not send or accept the alert yet.
  const hasAlert = typeof neighbor?.alert === "string";
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
          language: pick(languageLabels, value("language")) ?? "en",
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
      <div className="live-form-grid">
        <LiveField label="Name">
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
        <LiveField label="Phone">
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
      <LiveField label="Address">
        <Input
          name="address"
          defaultValue={neighbor?.address}
          autoComplete="off"
        />
      </LiveField>
      <div className="live-form-grid">
        <LiveField label="Adults at home">
          <Input
            name="adults"
            type="number"
            min={1}
            max={30}
            required
            defaultValue={neighbor?.adults ?? 1}
          />
        </LiveField>
        <LiveField label="Children at home">
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
        <LiveField label="Speaks">
          <NativeSelect
            name="language"
            className="w-full"
            defaultValue={neighbor?.language ?? "en"}
          >
            {Object.entries(languageLabels).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </LiveField>
        <LiveField label="Email">
          <Input
            name="email"
            type="email"
            defaultValue={neighbor?.email}
            autoComplete="off"
          />
        </LiveField>
      </div>
      <LiveField
        label="Good to know"
        help="Best time to call, who lives at home, anything the next visitor should know."
      >
        <Textarea name="notes" rows={3} defaultValue={neighbor?.notes} />
      </LiveField>
      {neighbor && hasAlert && (
        <LiveField
          label="Alert"
          help="One line shown at the top of the record, such as “Call before visiting.” Leave empty for none."
        >
          <Input name="alert" maxLength={160} defaultValue={neighbor.alert} />
        </LiveField>
      )}
      {duplicates.length > 0 && (
        <div className="live-error help-matches" role="alert">
          <p>
            {duplicates[0].name} is already on file with this{" "}
            {duplicates[0].same === "phone" ? "phone number" : "name"}.
          </p>
          <p className="live-error-recovery">
            Open the record, or change the{" "}
            {duplicates[0].same === "phone" ? "number" : "name"}. What you typed
            is still here. If this is someone else, save again.
          </p>
          {duplicates.map((match) => (
            <div className="live-row" key={match.id}>
              <div>
                <h3>{match.name}</h3>
                <p>
                  {[match.phone, match.address].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={recordHref(match.id)}>Open record</Link>
              </Button>
            </div>
          ))}
        </div>
      )}
      <FormEnd
        error={duplicates.length ? "" : error}
        pending={pending}
        submit={
          neighbor
            ? "Save changes"
            : duplicates.length
              ? "Save as a new neighbor"
              : "Add neighbor"
        }
      >
        {aside}
      </FormEnd>
    </form>
  );
}
