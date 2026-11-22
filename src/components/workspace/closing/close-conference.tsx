"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { Download, Lock } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { NameToConfirm } from "@/components/workspace/help-line/name-to-confirm";
import { LiveFailure, LiveWaiting } from "@/components/workspace/states";
import { useSave } from "@/components/workspace/use-save";
import "@/components/workspace/for-good.css";
import "@/components/workspace/help-line/help-line.css";
import { reportsWords } from "@/lib/words/rooms/reports";

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
  const { data, isOwner, words } = useWorkspace();
  const w = reportsWords(words).closing;
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
          {w.open}
        </Button>
        <span className="live-count help-private">
          <Lock size={14} aria-hidden="true" /> {w.owners}
        </span>
      </p>
      {open && (
        <LiveDialog
          // "for good" stays together, so the title breaks as "Close this conference / for good".
          title={w.title}
          description={w.deck(data.church.name)}
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

function CloseConferenceForm({
  church,
  onExport,
}: {
  church: { id: Id<"churches">; name: string };
  onExport: () => void;
}) {
  const w = reportsWords(useWorkspace().words).closing;
  const close = useMutation(api.closing.close);
  const router = useRouter();
  const { pending, error, save } = useSave();
  const [typed, setTyped] = useState("");
  const agrees = nameKey(typed) === nameKey(church.name);
  return (
    <form
      className="live-form help-form help-for-good"
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
          <dt>{w.goes}</dt>
          <dd>
            {w.goesAll}
          </dd>
        </div>
        <div>
          <dt>{w.stays}</dt>
          <dd>
            {w.staysNothing}
          </dd>
        </div>
      </dl>
      {/* A step offered before the last act, never required: the sheet closes and Your files shows the export. */}
      <div className="closing-first">
        <p>{w.first}</p>
        <Button type="button" variant="outline" onClick={onExport}>
          <Download size={18} aria-hidden="true" /> {w.download}
        </Button>
      </div>
      <NameToConfirm
        label={w.type(church.name)}
        name={church.name}
        typed={typed}
        onTyped={setTyped}
      />
      <p className="for-good-last">{w.final}</p>
      {error && <LiveFailure message={error} kept={w.kept} />}
      <div className="live-form-actions">
        <LiveWaiting when={pending} />
        <Button
          type="submit"
          className="for-good-confirm"
          disabled={pending || !agrees}
        >
          {w.close}
        </Button>
      </div>
    </form>
  );
}
