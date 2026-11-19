"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CircleCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { useFirstLook } from "@/components/workspace/first-look";
import { isBrandNew } from "@/lib/first-days";
import { firstWeekSlips, isNewMember, readFirstWeek, writeFirstWeek, type FirstWeek, type SlipId } from "./first-week-state";
import "./first-week.css";

/**
 * A new member's first week: three paper slips at the top of This week, each a link to the real control it names.
 * A slip turns green once followed and the three leave once all are done or put away; neither comes back on this device.
 * Never in the sample (its visitor has Start here), never for the owner still alone (the week says so itself).
 */
export function FirstWeekSlips() {
  const { data, now, words } = useWorkspace();
  const look = useFirstLook();
  const leads = data.people.some((person) => person.id === data.user.id && (person.role === "owner" || person.role === "coordinator"));
  const eligible = !look && !data.church.sample && !isBrandNew(data) && isNewMember(data.user.joinedAt, now);
  const [state, setState] = useState<FirstWeek>(() => (eligible ? readFirstWeek(data.user.id) : { done: [], closed: true }));
  const slips = firstWeekSlips(leads);
  if (!eligible || state.closed || slips.every((slip) => state.done.includes(slip.id))) return null;
  const said = words.rooms.firstDays.firstWeek;
  const lines = leads ? said.leads : said.members;
  const keep = (next: FirstWeek) => {
    writeFirstWeek(data.user.id, next);
    setState(next);
  };
  const follow = (id: SlipId) => {
    if (!state.done.includes(id)) keep({ ...state, done: [...state.done, id] });
  };
  return (
    <section className="first-week" aria-labelledby="first-week-title">
      <div className="first-week-head">
        <h2 id="first-week-title">{said.title}</h2>
        <Button variant="ghost" size="icon" className="first-week-away" aria-label={said.putAway} title={said.putAway} onClick={() => keep({ ...state, closed: true })}>
          <X size={18} aria-hidden="true" />
        </Button>
      </div>
      <ol className="first-week-slips paper-rows">
        {slips.map(({ id, href }) => {
          const done = state.done.includes(id);
          const line = (lines as Record<SlipId, { lead: string; rest: string }>)[id];
          return (
            <li key={id} className="first-week-slip paper-corner" data-done={done ? "" : undefined}>
              <Link href={href} onClick={() => follow(id)}>
                <strong>{line.lead}</strong>
                <span>{line.rest}</span>
                {done ? (
                  <span className="first-week-mark">
                    <CircleCheck size={16} aria-hidden="true" />
                    {said.done}
                  </span>
                ) : (
                  <ArrowRight className="first-week-arrow" size={16} aria-hidden="true" />
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
