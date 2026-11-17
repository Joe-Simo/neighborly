"use client";
import "@/components/live-workspace.css";
import "@/components/public-state.css";
import Link from "next/link";
import { errorButton } from "./error-button";
import { stateWords } from "@/components/workspace/state-words";

export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="live-app public-state">
      <main className="live-auth">
        <div className="live-auth-art" aria-hidden="true" />
        <p className="public-state-mark"><Link href="/" aria-label="Kind Helps home">kind helps</Link></p>
        <h1>This page didn’t open.</h1>
        <p className="live-deck">Nothing is lost. Try again in a moment.</p>
        <div className="public-state-ways">
          <button {...errorButton} onClick={reset}>{stateWords.tryAgain}</button>
          <Link href="/">Back to kind helps</Link>
        </div>
      </main>
    </div>
  );
}
