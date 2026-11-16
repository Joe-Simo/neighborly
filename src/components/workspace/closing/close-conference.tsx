"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { Download, Lock } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/context";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { LiveField } from "@/components/workspace/primitives";
import { LiveFailure, LiveWaiting } from "@/components/workspace/states";
import { useSave } from "@/components/workspace/use-save";
import "@/components/workspace/for-good.css";
import "@/components/workspace/help-line/help-line.css";

/** Where the export lives in Your files, so the advice to export first is one step from it. */
const EXPORT = "records-export-name";

/** The same reading of a name the backend makes, so the button wakes only when the names agree. */
const nameKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * "Close this conference for good": the quiet link and its sheet. It draws nothing unless
 * the person is an owner of a real conference, so a room mounts it with one line and no props.
 */
export function CloseConference() {
  const { data, isOwner } = useWorkspace();
  const [open, setOpen] = useState(false);
  if (!isOwner || data.church.sample) return null;
  return (
    <>
      <p className="for-good">
        <Button
          variant="ghost"
          className="for-good-open"
          onClick={() => setOpen(true)}
        >
          Close this conference for good
        </Button>
        <span className="live-count help-private">
          <Lock size={14} aria-hidden="true" /> Owners only
        </span>
      </p>
      {open && (
        <LiveDialog
          title="Close this conference for good"
          description={`${data.church.name}, and everything in it.`}
          onClose={() => setOpen(false)}
        >
          <CloseConferenceForm
            church={data.church}
            onExport={() => {
              setOpen(false);
              const records = document.getElementById(EXPORT);
              records?.scrollIntoView({ block: "start" });
              // The heading takes focus so a keyboard or screen reader lands on the export, not back on the link.
              records?.setAttribute("tabindex", "-1");
              records?.focus({ preventScroll: true });
            }}
          />
        </LiveDialog>
      )}
    </>
  );
}

export function CloseConferenceForm({
  church,
  onExport,
}: {
  church: { id: Id<"churches">; name: string };
  onExport: () => void;
}) {
  const close = useMutation(api.closing.close);
  const router = useRouter();
  const { pending, error, save } = useSave();
  const [typed, setTyped] = useState("");
  const agrees = nameKey(typed) === nameKey(church.name);
  return (
    <form
      className="live-form help-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!agrees) return;
        const outcome = await save(() =>
          close({ churchId: church.id, typedName: typed }),
        );
        // The conference is gone, and with it this screen: start again from the front door.
        if (outcome.saved) router.push("/app");
      }}
    >
      <dl className="for-good-terms">
        <div>
          <dt>What goes</dt>
          <dd>
            Every record, call, visit, request, ledger line and file of this
            conference, and every member’s place and invitation.
          </dd>
        </div>
        <div>
          <dt>What stays</dt>
          <dd>
            Nothing.
          </dd>
        </div>
      </dl>
      {/* A step offered before the last act, never required: the sheet closes and Your files shows the export. */}
      <div className="closing-first">
        <p>First, if you may need any of it:</p>
        <Button type="button" variant="outline" onClick={onExport}>
          <Download size={18} aria-hidden="true" /> Download your records
        </Button>
      </div>
      <LiveField label={`Type ${church.name} to close it`}>
        <Input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          required
        />
      </LiveField>
      <p className="for-good-last">This cannot be undone.</p>
      {error && <LiveFailure message={error} />}
      <div className="live-form-actions">
        <LiveWaiting when={pending} />
        <Button
          type="submit"
          className="for-good-confirm"
          disabled={pending || !agrees}
        >
          Close this conference
        </Button>
      </div>
    </form>
  );
}
