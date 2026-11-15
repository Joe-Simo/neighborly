"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** What a form's submit resolves to: a message when the entry was refused, null when it was recorded. */
export type Refusal = string | null;

export function FormError({ message }: { message: string }) {
  return (
    <div className="live-error" role="alert">
      <p>{message}</p>
      <p className="live-error-recovery">
        Nothing was recorded, and what you typed is still here.
      </p>
    </div>
  );
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
      <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      <Button type="submit" disabled={saving}>
        {saving ? "Recording…" : children}
      </Button>
    </div>
  );
}
