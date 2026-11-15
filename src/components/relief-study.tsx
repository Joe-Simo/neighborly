"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExampleState } from "@/lib/neighborly";
import "./relief-study.css";

export function ReliefStudy({ onOpenWorkspace, onStartTeam }: {
  state: ExampleState;
  onOpenWorkspace: (element: HTMLElement) => void;
  onStartTeam: (element: HTMLElement) => void;
}) {
  return (
    <section className="neighborly-afterword" id="relief-study" aria-labelledby="afterword-title">
      <div className="afterword-intro">
        <p className="afterword-kicker">For the people who come together</p>
        <h2 id="afterword-title">Your community.<br /><em>Your way to help.</em></h2>
      </div>
      <div className="afterword-copy">
        <p>Every church and community has its own rhythm. Bring your people together around the work, gatherings and care that matter to yours.</p>
        <p>Choose what your group needs. Invite people to take part. Keep responsibilities clear, with room for life when plans change.</p>
        <div className="afterword-actions">
          <Button onClick={(event) => onStartTeam(event.currentTarget)}>Start a group <ArrowRight aria-hidden="true" /></Button>
          <Button variant="ghost" onClick={(event) => onOpenWorkspace(event.currentTarget)}>Explore an example <ArrowRight aria-hidden="true" /></Button>
        </div>
        <span>The optional example uses fictional people. No messages are sent.</span>
      </div>
      <footer>
        <a href="#main">kind helps</a>
        <p>Good work, together.</p>
        <Link href="/app">Open your workspace <span aria-hidden="true">↗</span></Link>
      </footer>
    </section>
  );
}
