"use client";

/** The one way back from no connection: ask for the page again. */
export function TryAgain({ label }: { label: string }) {
  return <button type="button" onClick={() => window.location.reload()}>{label}</button>;
}
