"use client";

import { useCallback, useDeferredValue, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@/components/workspace/query";
import { ArrowRight, Lock, Search } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace, type Workspace } from "@/components/workspace/context";
import { NeighborForm } from "@/components/workspace/help-line/forms";
import { LiveDialog } from "@/components/workspace/live-dialog";
import {
  household,
  initials,
  kindLabels,
  recordHref,
  shortMoney,
  type NeighborList,
} from "@/components/workspace/help-line/format";
import { NeighborRecord } from "@/components/workspace/help-line/neighbor-record";
import {
  HelpEmpty,
  HelpLoading,
  HelpRoom,
} from "@/components/workspace/help-line/room";

export function NeighborsSection() {
  const address = useSearchParams();
  const neighborId = address.get("neighbor");
  return (
    <HelpRoom>
      {neighborId ? (
        // The id comes from the address bar; the backend refuses anything that is not a record in this group.
        <NeighborRecord
          key={neighborId}
          neighborId={neighborId as Id<"neighbors">}
          requestId={address.get("request")}
        />
      ) : (
        <Neighbors />
      )}
    </HelpRoom>
  );
}

function Neighbors() {
  const { data, format, setHeadAction } = useWorkspace();
  const router = useRouter();
  const churchId = data.church.id;
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const add = useCallback(() => setAdding(true), []);
  useLayoutEffect(() => {
    setHeadAction({ label: "Add a neighbor", run: add, plus: true });
    return () => setHeadAction(null);
  }, [setHeadAction, add]);
  const list = useQuery(api.neighbors.list, {
    churchId,
    search: useDeferredValue(search).trim() || undefined,
    leading: true,
  });
  return (
    <>
      <div className="help-search">
        <Search size={20} aria-hidden="true" />
        <Input
          type="search"
          aria-label="Find a neighbor"
          placeholder="Find by name, phone or street"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {list ? (
        <NeighborListView
          list={list}
          searching={!!search.trim()}
          format={format}
          bring={data.canCoordinate}
          onAdd={add}
        />
      ) : (
        <HelpLoading />
      )}
      {adding && (
        <LiveDialog
          title="Add a neighbor"
          description="We check first that they are not already on file."
          onClose={() => setAdding(false)}
        >
          <NeighborForm
            churchId={churchId}
            onSaved={(id) => router.push(recordHref(id))}
          />
        </LiveDialog>
      )}
    </>
  );
}

/** How many households show before "Show more". */
const FIRST = 30;

type Row = NeighborList["rows"][number];

/** One household in the list. The whole row opens the record through its one link, the name. */
function NeighborRow({
  neighbor,
  format,
}: {
  neighbor: Row;
  format: Workspace["format"];
}) {
  // A row says the name and the street, never the phone: that is inside the record, where each opening is logged.
  return (
            <div className="help-row help-neighbor">
              <span className="help-avatar" aria-hidden="true">
                {initials(neighbor.name)}
              </span>
              <div>
                <h3>
                  <Link className="help-row-open" href={recordHref(neighbor.id)}>
                    {neighbor.name}
                  </Link>
                </h3>
                {/* Each fact brings its own dot before it; a fact that starts a line has its dot cut off (help-line.css). */}
                <p className="help-facts">
                  <span>
                    {neighbor.address && <span>{neighbor.address}</span>}
                    <span className="help-household">{household(neighbor.adults, neighbor.children)}</span>
                    <span className="help-last">
                      {neighbor.lastHelpedAt
                        ? `last helped ${format(neighbor.lastHelpedAt, { day: undefined, year: "numeric" })}`
                        : "not helped yet"}
                    </span>
                  </span>
                </p>
              </div>
              <div className="live-row-actions">
                {neighbor.openRequest && (
                  <span className="live-status help-asks" data-state="waiting">
                    {kindLabels[neighbor.openRequest.kind]}
                    {neighbor.openRequest.amount > 0 &&
                      `, ${shortMoney(neighbor.openRequest.amount)}`}
                  </span>
                )}
                {neighbor.visitAt && (
                  <span className="live-status">
                    Visit{" "}
                    {format(neighbor.visitAt, { weekday: "short" })}
                  </span>
                )}
                <ArrowRight className="help-row-arrow" size={20} aria-hidden="true" />
              </div>
            </div>
  );
}

export function NeighborListView({
  list,
  searching,
  format,
  bring = false,
  onAdd,
}: {
  list: NeighborList;
  searching: boolean;
  format: Workspace["format"];
  /** Whether to point to Your files, where records are brought in. */
  bring?: boolean;
  onAdd: () => void;
}) {
  const add = (
    <Button variant="outline" onClick={onAdd}>
      Add a neighbor
    </Button>
  );
  const shown = list.rows.length + list.waitingRows.length;
  const [open, setOpen] = useState(FIRST);
  // By name the list is in order, so it reads under letter heads; search results stay as found.
  // Those waiting for a decision come first, under their own head; the rest read under letter heads.
  const waiting = searching ? [] : list.waitingRows;
  const groups: [string, Row[]][] = waiting.length ? [["waiting", waiting]] : [];
  for (const neighbor of list.rows.slice(0, open)) {
    const letter = searching
      ? ""
      : neighbor.name.trim().charAt(0).toLocaleUpperCase();
    const last = groups.at(-1);
    if (last?.[0] === letter) last[1].push(neighbor);
    else groups.push([letter, [neighbor]]);
  }
  return (
    <>
      <div className="live-section-head">
        <h2>Neighbors</h2>
        <span className="live-count help-private">
            <Lock size={14} aria-hidden="true" />
            {(() => {
              // The whole conference, from its running figures; before they are first counted, what is shown.
              const households = list.households ?? shown;
              const waitingAll = list.waiting ?? waiting.length;
              return `${households} ${households === 1 ? "household" : "households"}${waitingAll ? ` · ${waitingAll} waiting for a decision` : ""}`;
            })()}{" "}
            · each opening is logged
        </span>
      </div>
      {shown ? (
        <>
          {groups.map(([letter, rows]) => (
            <section
              className="help-letter"
              key={letter}
              data-waiting={letter === "waiting" ? "" : undefined}
              aria-label={letter === "waiting" ? "Waiting for a decision" : letter || undefined}
            >
              {letter === "waiting" ? (
                <h3 className="help-waiting-head">Waiting for a decision</h3>
              ) : (
                letter && (
                  <h3 className="help-letter-head" aria-hidden="true">
                    {letter}
                  </h3>
                )
              )}
              <div className="live-list">
                {rows.map((neighbor) => (
                  <NeighborRow
                    key={neighbor.id}
                    neighbor={neighbor}
                    format={format}
                  />
                ))}
              </div>
            </section>
          ))}
          {shown > open && (
            <p className="help-more">
              <Button variant="outline" onClick={() => setOpen(open + FIRST)}>
                Show more
              </Button>
              <span>
                {open} of {shown}
              </span>
            </p>
          )}
        </>
      ) : searching ? (
        <HelpEmpty title="No one by that name." action={add}>
          Try the start of a name, a phone number or a street. If they are new
          to you, add them.
        </HelpEmpty>
      ) : (
        <HelpEmpty title="No neighbors yet." action={add}>
          The first person who calls the help line starts the list.
        </HelpEmpty>
      )}
      {list.more && (
        <p className="help-footnote">
          Showing the first {shown}. Search to find anyone else.
        </p>
      )}
      {bring && (
        <p className="help-bring">
          <Button asChild variant="link" className="help-text-action">
            <Link href="/app/tools">Bring in a file</Link>
          </Button>
        </p>
      )}
    </>
  );
}
