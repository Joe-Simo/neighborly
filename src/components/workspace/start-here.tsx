"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useWorkspace } from "@/components/workspace/context";
import { useQuery } from "@/components/workspace/query";
import { useFirstLook } from "@/components/workspace/first-look";

/**
 * For a visitor to the sample only: one quiet line at the top of This week that leads to the draft waiting
 * for a yes on the Help line. It is there while such a draft waits and gone once the visitor has said yes.
 * A real conference never shows it.
 */
export function StartHere() {
  const { data, words } = useWorkspace();
  // Already being read above the rooms, so this answers at once.
  // A first look at the sample is always a visitor's, and the seed says how many drafts wait.
  const look = useFirstLook();
  const visiting = useQuery(api.demo.visiting, data.church.sample ? {} : "skip") ?? (look ? (look.visiting ?? true) : undefined);
  const show = visiting === true;
  const waiting = useQuery(api.assistance.drafts, show ? { churchId: data.church.id } : "skip")?.length ?? look?.draftsWaiting;
  if (!show || waiting === 0) return null;
  // Until the answer is in, the line's place is kept, so nothing under it moves when it is drawn.
  return <StartHereLine {...words.week.startHere} waiting={waiting === undefined} />;
}

function StartHereLine({ lead, rest, waiting = false }: { lead: string; rest: string; waiting?: boolean }) {
  return (
    <Link className="start-here" href="/app/help-line" data-waiting={waiting ? "" : undefined} data-room-pending={waiting ? "" : undefined} inert={waiting} aria-hidden={waiting || undefined}>
      <span>
        <strong>{lead}:</strong> {rest}
      </span>
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );
}
