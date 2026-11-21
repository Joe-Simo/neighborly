import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SheetCancel } from "@/components/workspace/live-dialog";
import { LiveFailure, LiveWaiting } from "@/components/workspace/states";

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
        <SheetCancel disabled={pending} />
        {children}
        <Button type="submit" value={value} disabled={pending}>
          {submit}
        </Button>
      </div>
    </>
  );
}
