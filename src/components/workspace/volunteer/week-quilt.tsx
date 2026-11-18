"use client";

import { useState, type CSSProperties } from "react";
import { useHour, useQuery } from "@/components/workspace/query";
import { api } from "../../../../convex/_generated/api";
import { useWorkspace } from "@/components/workspace/context";
import { useFirstLook } from "@/components/workspace/first-look";
import { fill } from "@/lib/words/fill";

/**
 * The week as a paper quilt: every call called back, visit written up and yes given since Monday is one small
 * piece of paper laid along the foot of the room's head, in the order it was done. It comes only from the
 * records, so a piece is laid only once its act is saved; one laid while the room is open is cut in and set
 * down, the rest are simply there. Nothing counts up and nothing lies over the picture.
 */
export function WeekQuilt() {
  const { data, words } = useWorkspace();
  const churchId = data.church.id;
  const look = useFirstLook();
  const at = useHour();
  const acts = useQuery(api.quilt.week, look || !at ? "skip" : { churchId, at });
  // The pieces already there when the room was drawn are never laid again.
  const [seen, setSeen] = useState<Set<string> | null>(null);
  if (acts && !seen) setSeen(new Set(acts.map((act) => act.id)));
  if (!acts?.length) return null;
  const count = (kind: (typeof acts)[number]["kind"]) => acts.filter((act) => act.kind === kind).length;
  const said = fill(words.week.quilt, {
    calls: words.week.quiltCalls(count("call")),
    visits: words.week.quiltVisits(count("visit")),
    yeses: words.week.quiltYeses(count("yes")),
  });
  return (
    <div className="week-quilt" role="img" aria-label={said}>
      {acts.map((act, index) => (
        <i
          key={act.id}
          data-kind={act.kind}
          data-laid={!seen || seen.has(act.id) ? undefined : ""}
          // A hand-cut piece: each leans its own small way, from its place in the week.
          style={{ "--lean": `${((index * 37) % 7) - 3}`, "--nudge": `${((index * 53) % 5) - 2}` } as CSSProperties}
        />
      ))}
    </div>
  );
}
