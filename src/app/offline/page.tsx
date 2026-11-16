import "@/components/live-workspace.css";
import "@/components/public-state.css";
import "@/components/public-page.css";
import type { Metadata } from "next";
import { TryAgain } from "./try-again";

export const metadata: Metadata = {
  title: "No connection — Kind Helps",
  description: "This device is offline. What is on screen is kept, and Kind Helps opens again when the connection returns.",
  robots: { index: false, follow: false },
};

export default function Offline() {
  return (
    <div className="live-app public-state">
      <main className="live-auth paper-rise">
        <div className="live-auth-art" aria-hidden="true" />
        <p className="live-kicker">Kind Helps</p>
        <h1>No connection right now.</h1>
        <p className="live-deck">
          Nothing is lost. Your team’s week will be here as soon as this
          device is back online.
        </p>
        <TryAgain />
      </main>
    </div>
  );
}
