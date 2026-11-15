"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LiveFailure, LiveWaiting } from "@/components/workspace/states";

/** What a form's submit resolves to: a message when the entry was refused, null when it was recorded. */
export type Refusal = string | null;

/** A refused entry, said inside its form. The form's own button sends it again. */
export function FormError({ message }: { message: string }) {
  return <LiveFailure message={message} kept="Nothing was recorded, and what you typed is still here." />;
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
  return (
    <div className="live-form-actions">
      <LiveWaiting when={saving} />
      <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      <Button type="submit" disabled={saving}>
        {saving ? "Recording…" : children}
      </Button>
    </div>
  );
}
