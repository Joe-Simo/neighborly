"use client";
import "@/components/live-workspace.css";
import "@/components/public-state.css";
import { Button } from "@/components/ui/button";
import { stateWords } from "@/components/workspace/state-words";

export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="live-app public-state">
      <main className="live-auth">
        <div className="live-auth-art" aria-hidden="true" />
        <p className="live-kicker">Kind Helps</p>
        <h1>This page didn’t open.</h1>
        <p className="live-deck">Nothing is lost. Try again in a moment.</p>
        <Button onClick={reset} style={{ marginTop: 24 }}>
          {stateWords.tryAgain}
        </Button>
      </main>
    </div>
  );
}
