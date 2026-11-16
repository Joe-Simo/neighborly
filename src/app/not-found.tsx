import "@/components/live-workspace.css";
import "@/components/public-state.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PublicEnding } from "@/components/public-ending";
import "@/components/public-page.css";
import { stateWords } from "@/components/workspace/state-words";

export const metadata: Metadata = {
  title: "Page not found — Kind Helps",
  description: "The address may be old or mistyped. Kind Helps is at kindhelps.com.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
    <div className="live-app public-state">
      <main className="live-auth paper-rise">
        <div className="live-auth-art" aria-hidden="true" />
        <p className="live-kicker">Kind Helps</p>
        <h1>{stateWords.missingTitle}</h1>
        <p className="live-deck">{stateWords.missingDeck}</p>
        <Button asChild style={{ marginTop: 24 }}>
          <Link href="/app">{stateWords.missingAction}</Link>
        </Button>
      </main>
    </div>
    <PublicEnding />
    </>
  );
}
