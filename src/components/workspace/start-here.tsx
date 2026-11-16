"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useWorkspace } from "@/components/workspace/context";
import { useQuery } from "@/components/workspace/query";

/**
 * For a visitor to the sample only: one quiet line at the top of This week that leads to the draft waiting
 * for a yes on the Help line. It is there while such a draft waits and gone once the visitor has said yes.
 * A real conference never shows it.
 */
export function StartHere() {
  const { data, words } = useWorkspace();
  // Already being read above the rooms, so this answers at once.
  const visiting = useQuery(api.demo.visiting, data.church.sample ? {} : "skip");
  const show = visiting === true;
  const drafts = useQuery(api.assistance.drafts, show ? { churchId: data.church.id } : "skip");
  if (!show || drafts?.length === 0) return null;
  // Until the answer is in, the line's place is kept, so nothing under it moves when it is drawn.
  return <StartHereLine {...words.week.startHere} waiting={drafts === undefined} />;
}

export function StartHereLine({ lead, rest, waiting = false }: { lead: string; rest: string; waiting?: boolean }) {
  return (
    <Link className="start-here" href="/app/help-line" data-waiting={waiting ? "" : undefined} data-room-pending={waiting ? "" : undefined} inert={waiting} aria-hidden={waiting || undefined}>
      <span>
        <strong>{lead}:</strong> {rest}
      </span>
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );
}
