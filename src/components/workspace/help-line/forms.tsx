"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
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
  recordHref,
  type Call,
  type HelpRequest,
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
      <DialogContent className="live-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

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
                  day: signs.find((sign) => sign.day !== null)?.day ?? undefined,
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
          markReturned({ churchId, callId: call.id, outcome: value("outcome") }),
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
  Pick<HelpRequest, "kind" | "summary" | "payeeName" | "source"> & {
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
  return (
    <form
      className="live-form help-form"
      onSubmit={async (event) => {
        const value = fieldsOf(event);
        const amountRequested = cents(value("amount"));
        if (amountRequested === null)
          return setAmountError("Enter the amount in dollars, such as 450.");
        setAmountError("");
        const details = {
          churchId,
          kind: pick(kindLabels, value("kind")) ?? "other",
          summary: value("summary"),
          amountRequested,
          payeeKind: pick(payeeLabels, value("payeeKind")) ?? "vendor",
          payeeName: value("payeeName"),
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
            defaultValue={start?.kind ?? "rent"}
          >
            {Object.entries(kindLabels).map(([kind, label]) => (
              <option key={kind} value={kind}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </LiveField>
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
      </div>
      <LiveField label="What they need">
        <Textarea
          name="summary"
          rows={3}
          required
          defaultValue={start?.summary}
        />
      </LiveField>
      <div className="live-form-grid">
        <LiveField label="Who is paid">
          <NativeSelect
            name="payeeKind"
            className="w-full"
            defaultValue={
              start?.payeeKind && start.payeeKind in payeeLabels
                ? start.payeeKind
                : "landlord"
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
          <Input name="payeeName" defaultValue={start?.payeeName} />
        </LiveField>
      </div>
      <p className="help-form-note">
        Payments go to the landlord, utility or store, never to the neighbor.
      </p>
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
  const listed = useQuery(api.assistance.agencies, known ? "skip" : { churchId });
  const agencies = known ?? listed;
  const [referred, setReferred] = useState<string[]>(request.referrals ?? []);
  const { pending, error, save } = useSave();
  const [amountError, setAmountError] = useState("");
  const approving = decision === "approved";
  return (
    <form
      className="live-form help-form"
      onSubmit={async (event) => {
        const value = fieldsOf(event);
        const amountApproved = approving ? cents(value("amount")) : null;
        if (approving && !amountApproved)
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
            note: value("note"),
            // An older backend does not know the list of places yet; it keeps the single line.
            ...(agencies ? { referrals: places } : { referral: places.join(", ") }),
          }),
        );
        if (outcome.saved) onSaved();
      }}
    >
      {approving && (
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
      <LiveField label={approving ? "Note on the decision" : "Why it was declined"}>
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
                {agency.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        <LiveField
          label={agencies?.length ? "Somewhere else" : "Where"}
          help="Such as 211 or the county rent program. It is offered here next time. Leave empty if nowhere."
        >
          <Input name="elsewhere" maxLength={120} defaultValue={request.referral} />
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
        <Input name="address" defaultValue={neighbor?.address} autoComplete="off" />
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
            Open the record, or change the {duplicates[0].same === "phone" ? "number" : "name"}. What you typed is
            still here. If this is someone else, save again.
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
