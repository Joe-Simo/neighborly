"use client";

import { useState, type CSSProperties } from "react";
import { useHour, useQuery } from "@/components/workspace/query";
import { api } from "../../../../convex/_generated/api";
import { useWorkspace } from "@/components/workspace/context";
import { useFirstLook } from "@/components/workspace/first-look";
import { fill } from "@/lib/words/fill";

import type { FunctionReturnType } from "convex/server";

type Act = FunctionReturnType<typeof api.quilt.week>[number];

/** A small number from a piece's id, so its cut and its lean are its own and the same on every visit. */
function seeded(id: string, salt: number) {
  let hash = 2166136261 ^ salt;
  for (let at = 0; at < id.length; at++) hash = Math.imul(hash ^ id.charCodeAt(at), 16777619);
  return ((hash >>> 0) % 1000) / 1000;
}

/** The piece's own cut: four corners each a little in from square. */
function cut(id: string) {
  const in_ = (salt: number) => `${(seeded(id, salt) * 9).toFixed(1)}%`;
  return `polygon(${in_(1)} ${in_(2)}, calc(100% - ${in_(3)}) ${in_(4)}, calc(100% - ${in_(5)}) calc(100% - ${in_(6)}), ${in_(7)} calc(100% - ${in_(8)}))`;
}

/**
 * The week as a paper quilt along the foot of This week's head: seven days from Monday at the left, and in each
 * day one cut piece of paper for every call called back (cream), home visit written up (sage) and yes given
 * (green), in the order it was done. It comes from the records alone, so a piece is laid only once its act is
 * saved; one laid while the room is open is pressed into its place, and nothing else moves. Under it, one caption.
 */
export function WeekQuilt() {
  const { data, words } = useWorkspace();
  const churchId = data.church.id;
  const look = useFirstLook();
  const at = useHour();
  const acts = useQuery(api.quilt.week, look || !at ? "skip" : { churchId, at });
  // The pieces already there when the room was drawn are never pressed in again.
  const [seen, setSeen] = useState<Set<string> | null>(null);
  if (acts && !seen) setSeen(new Set(acts.map((act) => act.id)));
  if (!acts) return null;
  const count = (kind: Act["kind"]) => acts.filter((act) => act.kind === kind).length;
  const caption = acts.length
    ? fill(words.week.quilt, { calls: words.week.quiltCalls(count("call")), visits: words.week.quiltVisits(count("visit")), yeses: words.week.quiltYeses(count("yes")) })
    : words.week.quiltNone;
  return (
    <figure className="week-quilt">
      <div className="week-quilt-band" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6].map((day) => (
          <span key={day} className="week-quilt-day">
            {acts
              .filter((act) => act.day === day)
              .map((act) => (
                <span
                  key={act.id}
                  className="week-quilt-piece"
                  data-kind={act.kind}
                  data-laid={!seen || seen.has(act.id) ? undefined : ""}
                  style={{ "--lean": `${((seeded(act.id, 9) - 0.5) * 5).toFixed(2)}deg`, "--rise": `${((seeded(act.id, 10) - 0.5) * 3).toFixed(1)}px` } as CSSProperties}
                >
                  <i style={{ clipPath: cut(act.id) }} />
                </span>
              ))}
          </span>
        ))}
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
