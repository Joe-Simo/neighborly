"use client";
import { Button } from "@/components/ui/button";
export default function WorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="live-auth">
      <p className="live-kicker">Neighborly</p>
      <h1>We couldn’t open this.</h1>
      <p className="live-deck">
        Your workspace is still there. Try again to reconnect.
      </p>
      <Button onClick={reset} style={{ marginTop: 24 }}>
        Try again
      </Button>
    </main>
  );
}
