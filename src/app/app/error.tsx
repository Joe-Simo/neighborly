"use client";
import "@/components/public-state.css";
import { Button } from "@/components/ui/button";
import { useEntryLanguage } from "@/components/live-auth-words";
import { words as wordsFor } from "@/lib/words";

export default function WorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Outside the workspace's own tables, so it speaks the language chosen at the door.
  const [language] = useEntryLanguage();
  const said = wordsFor(language);
  return (
    <div className="public-state">
      <main className="live-auth" lang={said.locale}>
        <div className="live-auth-art" aria-hidden="true" />
        <p className="public-state-mark">kind helps</p>
        <h1>{said.states.launchTitle}</h1>
        <p className="live-deck">{said.states.launchDeck}</p>
        <Button onClick={reset} style={{ marginTop: 24 }}>
          {said.states.tryAgain}
        </Button>
      </main>
    </div>
  );
}
