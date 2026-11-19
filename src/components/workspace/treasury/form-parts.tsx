"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { LiveFailure, LiveWaiting, SaveLabel } from "@/components/workspace/states";

/** What a form's submit resolves to: a message when the entry was refused, null when it was recorded. */
export type Refusal = string | null;

/** A refused entry, said inside its form. The form's own button sends it again. */
export function FormError({ message }: { message: string }) {
  const w = useWorkspace().words.rooms.treasury;
  return <LiveFailure message={message} kept={w.kept} />;
}

export function FormActions({
  saving,
  onCancel,
  children,
}: {
  saving: boolean;
  onCancel: () => void;
  children: ReactNode;
}) {
  const w = useWorkspace().words.rooms.treasury;
  return (
    <div className="live-form-actions">
      <LiveWaiting when={saving} />
      <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
        {w.cancel}
      </Button>
      <Button type="submit" disabled={saving}>
        <SaveLabel saving={saving} idle={children} busy={w.recording} />
      </Button>
    </div>
  );
}
