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
import { RoomAside, useFarScreen } from "@/components/workspace/aside";
import { fill } from "@/lib/words/fill";
import {
  initials,
  recordHref,
  shortMoney,
  type NeighborList,
} from "@/components/workspace/help-line/format";
import { NeighborRecord } from "@/components/workspace/help-line/neighbor-record";
import { RecordSlide } from "@/components/workspace/record-slide";
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
        <RecordSlide part="record">
          <NeighborRecord
            key={neighborId}
            neighborId={neighborId as Id<"neighbors">}
            requestId={address.get("request")}
          />
        </RecordSlide>
      ) : (
        <RecordSlide part="list">
          <Neighbors />
        </RecordSlide>
      )}
    </HelpRoom>
  );
}

function Neighbors() {
  const { data, format, setHeadAction, words } = useWorkspace();
  const text = words.rooms.neighbors;
  const router = useRouter();
  const churchId = data.church.id;
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const add = useCallback(() => setAdding(true), []);
  useLayoutEffect(() => {
    setHeadAction({ label: text.add, run: add, plus: true });
    return () => setHeadAction(null);
  }, [setHeadAction, add, text.add]);
  const asked = useDeferredValue(search).trim();
  const list = useQuery(api.neighbors.list, {
    churchId,
    search: asked || undefined,
    leading: true,
  });
  // Nothing was searched for and the conference has no household: there is nothing to search yet.
  const none = !!list && !search.trim() && !asked && noNeighbors(list);
  return (
    <>
      {!none && (
      <div className="help-search">
        <Search size={20} aria-hidden="true" />
        <Input
          type="search"
          aria-label={text.list.find}
          placeholder={text.list.findBy}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      )}
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
          title={text.add}
          description={text.list.addHelp}
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

/** True of a conference with no household on file at all, by its running figure and by what was found. */
function noNeighbors(list: NeighborList) {
  return list.rows.length + list.waitingRows.length === 0 && !list.households;
}

/** How many households show before "Show more". */
const FIRST = 30;

type Row = NeighborList["rows"][number];

/** One household in the list. The whole row opens the record through its one link, the name. */
/** What a household is waiting on: its open request, and the visit set for it. */
function Asks({ neighbor, format }: { neighbor: Row; format: Workspace["format"] }) {
  const { words } = useWorkspace();
  const text = words.rooms.neighbors;
  return (
    <>
      {neighbor.openRequest && (
        <span className="live-status help-asks" data-state="waiting">
          {neighbor.openRequest.amount > 0
            ? fill(text.request.amount, {
                kind: words.kinds[neighbor.openRequest.kind],
                amount: shortMoney(neighbor.openRequest.amount),
              })
            : words.kinds[neighbor.openRequest.kind]}
        </span>
      )}
      {neighbor.visitAt && (
        <span className="live-status">
          {text.list.visitOn(format(neighbor.visitAt, { weekday: "short" }))}
        </span>
      )}
    </>
  );
}

function NeighborRow({
  neighbor,
  format,
}: {
  neighbor: Row;
  format: Workspace["format"];
}) {
  const { words } = useWorkspace();
  const text = words.rooms.neighbors;
  const size = neighbor.adults + neighbor.children;
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
                    <span className="help-household">{size === 1 ? text.home.livesAlone : text.home.householdOf(size)}</span>
                    <span className="help-last">
                      {neighbor.lastHelpedAt
                        ? text.list.lastHelped(format(neighbor.lastHelpedAt, { day: undefined, year: "numeric" }))
                        : text.list.notHelped}
                    </span>
                  </span>
                </p>
              </div>
              <div className="live-row-actions">
                <Asks neighbor={neighbor} format={format} />
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
  const { words } = useWorkspace();
  const text = words.rooms.neighbors;
  const add = (
    <Button variant="outline" onClick={onAdd}>
      {text.add}
    </Button>
  );
  const shown = list.rows.length + list.waitingRows.length;
  const [open, setOpen] = useState(FIRST);
  // By name the list is in order, so it reads under letter heads; search results stay as found.
  // Those waiting for a decision come first, under their own head; the rest read under letter heads.
  const waiting = searching ? [] : list.waitingRows;
  // From 1728px those waiting stand in the room's side column, and the list beside them is by name alone.
  const beside = useFarScreen();
  const groups: [string, Row[]][] = waiting.length && !beside ? [["waiting", waiting]] : [];
  for (const neighbor of list.rows.slice(0, open)) {
    const letter = searching
      ? ""
      : neighbor.name.trim().charAt(0).toLocaleUpperCase();
    const last = groups.at(-1);
    if (last?.[0] === letter) last[1].push(neighbor);
    else groups.push([letter, [neighbor]]);
  }
  // A conference with no household yet: one empty state, no heading and no count. The head carries "Add a neighbor";
  // whoever may bring files in is shown the one quiet way to start from ServWare or paper.
  if (!searching && noNeighbors(list))
    return (
      <HelpEmpty
        first
        title={text.list.none.title}
        action={
          bring ? (
            <Button asChild variant="link" className="help-text-action whitespace-normal text-left">
              <Link href="/app/tools">{text.list.none.bring}</Link>
            </Button>
          ) : undefined
        }
      >
        {text.list.none.body}
      </HelpEmpty>
    );
  return (
    <>
      <div className="live-section-head">
        <h2>{text.list.title}</h2>
        <span className="live-count help-private">
            <Lock size={14} aria-hidden="true" />
            {(() => {
              // The whole conference, from its running figures; before they are first counted, what is shown.
              const households = list.households ?? shown;
              const waitingAll = list.waiting ?? waiting.length;
              // Three facts in a row, each whole, with a dot between them.
              return [text.list.households(households), waitingAll ? text.list.waitingCount(waitingAll) : "", text.list.logged]
                .filter(Boolean)
                .join(" · ");
            })()}
        </span>
      </div>
      {beside && waiting.length > 0 && (
        <RoomAside title={text.list.waiting}>
          <ul className="help-waiting-beside">
            {waiting.map((neighbor) => (
              <li key={neighbor.id}>
                <Link className="help-row-open" href={recordHref(neighbor.id)}>{neighbor.name}</Link>
                <Asks neighbor={neighbor} format={format} />
              </li>
            ))}
          </ul>
        </RoomAside>
      )}
      {shown ? (
        <>
          {groups.map(([letter, rows]) => (
            <section
              className="help-letter"
              key={letter}
              data-waiting={letter === "waiting" ? "" : undefined}
              aria-label={letter === "waiting" ? text.list.waiting : letter || undefined}
            >
              {letter === "waiting" ? (
                <h3 className="help-waiting-head">{text.list.waiting}</h3>
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
                {text.list.more}
              </Button>
              <span>{fill(text.list.shownOf, { shown: open, all: shown })}</span>
            </p>
          )}
        </>
      ) : searching ? (
        <HelpEmpty title={text.list.noMatch.title} action={add}>
          {text.list.noMatch.body}
        </HelpEmpty>
      ) : (
        // The running figure says households exist but none was found: the head still carries "Add a neighbor".
        <HelpEmpty title={text.list.none.title}>
          {text.list.none.body}
        </HelpEmpty>
      )}
      {list.more && (
        <p className="help-footnote">
          {text.list.first(shown)}
        </p>
      )}
      {bring && (
        <p className="help-bring">
          <Button asChild variant="link" className="help-text-action">
            <Link href="/app/tools">{text.list.bring}</Link>
          </Button>
        </p>
      )}
    </>
  );
}
