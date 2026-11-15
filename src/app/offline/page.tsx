import "@/components/live-workspace.css";
import type { Metadata } from "next";
import { TryAgain } from "./try-again";

export const metadata: Metadata = {
  title: "No connection",
  robots: { index: false, follow: false },
};

export default function Offline() {
  return (
    <div className="live-app">
      <main className="live-auth">
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
