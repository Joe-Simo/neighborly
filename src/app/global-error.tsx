"use client";
/* The frame that failed here is the one links travel through, so the ways back are plain links that load the home page fresh. */
/* eslint-disable @next/next/no-html-link-for-pages */
import "./globals.css";
import "../../public/fonts/fonts.css";
import "@/components/live-workspace.css";
import "@/components/public-state.css";
import { errorButton } from "./error-button";
import { stateWords } from "@/components/workspace/state-words";

/** The last page there is: shown when the frame around every page fails, so it brings its own frame and never the browser's. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <title>This page didn’t open — Kind Helps</title>
        <div className="live-app public-state">
          <main className="live-auth">
            <div className="live-auth-art" aria-hidden="true" />
            <p className="public-state-mark"><a href="/" aria-label="Kind Helps home">kind helps</a></p>
            <h1>This page didn’t open.</h1>
            <p className="live-deck">Nothing is lost. Try again in a moment.</p>
            <div className="public-state-ways">
              <button {...errorButton} onClick={reset}>{stateWords.tryAgain}</button>
              <a href="/">Back to kind helps</a>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
