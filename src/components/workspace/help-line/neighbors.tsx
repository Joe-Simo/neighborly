"use client";

import { useCallback, useDeferredValue, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { Lock, Search } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace, type Workspace } from "@/components/workspace/context";
import "@/components/workspace/tools/tools.css";
import { NeighborsImport } from "@/components/workspace/tools/neighbors-import";
import { RequestsImport } from "@/components/workspace/tools/requests-import";
import { HelpDialog, NeighborForm } from "@/components/workspace/help-line/forms";
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
  const neighborId = useSearchParams().get("neighbor");
  return (
    <HelpRoom loading="Opening neighbor records">
      {neighborId ? (
        // The id comes from the address bar; the backend refuses anything that is not a record in this group.
        <NeighborRecord
          key={neighborId}
          neighborId={neighborId as Id<"neighbors">}
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
  const [importing, setImporting] = useState<false | "neighbors" | "requests">(false);
  const add = useCallback(() => setAdding(true), []);
  useLayoutEffect(() => {
    setHeadAction({ label: "Add a neighbor", run: add });
    return () => setHeadAction(null);
  }, [setHeadAction, add]);
  const list = useQuery(api.neighbors.list, {
    churchId,
    search: useDeferredValue(search).trim() || undefined,
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
          onAdd={add}
        />
      ) : (
        <HelpLoading label="Finding neighbors" />
      )}
      {importing && (
        <section className="live-section">
          <NeighborsImport />
          {importing === "requests" ? (
            <RequestsImport />
          ) : (
            <p className="help-form-note">
              <Button
                type="button"
                variant="link"
                className="help-text-action"
                onClick={() => setImporting("requests")}
              >
                then bring in their past requests
              </Button>
            </p>
          )}
        </section>
      )}
      {adding && (
        <HelpDialog
          title="Add a neighbor"
          description="We check first that they are not already on file."
          onClose={() => setAdding(false)}
        >
          <NeighborForm
            churchId={churchId}
            onSaved={(id) => router.push(recordHref(id))}
            aside={
              <Button
                type="button"
                variant="link"
                className="help-text-action"
                onClick={() => {
                  setAdding(false);
                  setImporting("neighbors");
                }}
              >
                or bring in a spreadsheet
              </Button>
            }
          />
        </HelpDialog>
      )}
    </>
  );
}

export function NeighborListView({
  list,
  searching,
  format,
  onAdd,
}: {
  list: NeighborList;
  searching: boolean;
  format: Workspace["format"];
  onAdd: () => void;
}) {
  const add = (
    <Button variant="outline" onClick={onAdd}>
      Add a neighbor
    </Button>
  );
  const shown = list.rows.length;
  return (
    <>
      <div className="live-section-head">
        <h2>Neighbors</h2>
        <span className="live-count help-private">
            <Lock size={14} aria-hidden="true" />
            {list.more
              ? `First ${shown} households`
              : `${shown} ${shown === 1 ? "household" : "households"}`}{" "}
            · each opening is logged
        </span>
      </div>
      {shown ? (
        <div className="live-list">
          {list.rows.map((neighbor) => (
            <div className="help-row" key={neighbor.id}>
              <span className="help-avatar" aria-hidden="true">
                {initials(neighbor.name)}
              </span>
              <div>
                <h3>{neighbor.name}</h3>
                <p>
                  {[
                    neighbor.address || neighbor.phone,
                    household(neighbor.adults, neighbor.children),
                    neighbor.lastHelpedAt
                      ? `last helped ${format(neighbor.lastHelpedAt, { day: undefined, year: "numeric" })}`
                      : "not helped yet",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="live-row-actions">
                {neighbor.openRequest && (
                  <span className="live-status" data-state="waiting">
                    {kindLabels[neighbor.openRequest.kind]},{" "}
                    {shortMoney(neighbor.openRequest.amount)}
                  </span>
                )}
                {neighbor.visitAt && (
                  <span className="live-status">
                    Visit{" "}
                    {format(neighbor.visitAt, { weekday: "short" })}
                  </span>
                )}
                <Button variant="outline" asChild>
                  <Link href={recordHref(neighbor.id)}>Open record</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
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
    </>
  );
}
