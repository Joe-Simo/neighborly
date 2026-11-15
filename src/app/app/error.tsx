"use client";
import { Button } from "@/components/ui/button";
import { stateWords } from "@/components/workspace/failure";

export default function WorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="live-auth">
      <div className="live-auth-art" aria-hidden="true" />
      <p className="live-kicker">Kind Helps</p>
      <h1>We couldn’t open this.</h1>
      <p className="live-deck">
        Nothing is lost. Your workspace is still there; try again to reconnect.
      </p>
      <Button onClick={reset} style={{ marginTop: 24 }}>
        {stateWords.tryAgain}
      </Button>
    </main>
  );
}
