"use client";

import { DateLeaf } from "@/components/workspace/primitives";

import "./visits.css";
import { useMutation } from "convex/react";
import { useHour, useQuery } from "@/components/workspace/query";
import { Check } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useWorkspace, type Workspace } from "@/components/workspace/context";
import { LiveFailure } from "@/components/workspace/states";
import { useSave } from "@/components/workspace/use-save";
import type { Words } from "@/lib/words";
import type { OwnVisit } from "@/components/workspace/visits/format";

/**
 * The home visits the signed-in person has been asked to make, with their yes or no.
 * For the My commitments page: it takes no props, and shows nothing when no visit is theirs.
 * It carries the time, the street and the other visitor only; the neighbor's name is on the
 * visit sheet the coordinator hands them.
 */
export function MyVisits() {
  const { data, format, words } = useWorkspace();
  const churchId = data.church.id;
  const at = useHour();
  const visits = useQuery(api.visits.mine, at ? { churchId, at } : "skip");
  const respond = useMutation(api.visits.respond);
  const { pending, error, save } = useSave();
  if (!visits?.length) return null;
  return (
    <MyVisitsView
      visits={visits}
      format={format}
      words={words.visits}
      busy={pending}
      error={error}
      onAnswer={(visit, response) =>
        void save(() => respond({ churchId, visitId: visit.id, response }))
      }
    />
  );
}

function MyVisitsView({
  visits,
  format,
  words,
  busy,
  error,
  onAnswer,
}: {
  visits: OwnVisit[];
  format: Workspace["format"];
  words: Words["visits"];
  busy: boolean;
  error: string;
  onAnswer: (visit: OwnVisit, response: "accepted" | "declined") => void;
}) {
  const part = (at: number, options: Intl.DateTimeFormatOptions) =>
    format(at, { month: undefined, day: undefined, ...options });
  return (
    <section className="live-section visits-mine" aria-labelledby="my-visits">
      <div className="live-section-head">
        <h2 id="my-visits">{words.title}</h2>
        <span className="live-count">
          {words.count(visits.length)}
        </span>
      </div>
      {error && (
        <LiveFailure message={error} kept={words.notSaved} />
      )}
      <div className="live-list">
        {visits.map((visit) => {
          const [time, half = ""] = part(visit.scheduledAt, {
            hour: "numeric",
            minute: "2-digit",
          }).split(/\s/);
          // For a reader, each answer says which visit it is for, as the row shows it.
          const subject = `${words.on(visit.street || words.nearby)}, ${format(visit.scheduledAt, { weekday: "long", month: "long", day: "numeric" })}`;
          return (
            <div className="help-row" key={visit.id}>
              <DateLeaf said={format(visit.scheduledAt, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}>
                <span>
                  {format(visit.scheduledAt, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <strong>{time}</strong>
                <span>{half}</span>
              </DateLeaf>
              <div>
                <h3>{words.on(visit.street || words.nearby)}</h3>
                <p>{visit.partner ? words.partner(visit.partner) : words.partnerOpen}</p>
              </div>
              <div className="live-row-actions">
                {visit.response === "pending" ? (
                  <>
                    <Button
                      disabled={busy}
                      aria-label={`${words.go}: ${subject}`}
                      onClick={() => onAnswer(visit, "accepted")}
                    >
                      <Check size={18} aria-hidden="true" /> {words.go}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      aria-label={`${words.cannot}: ${subject}`}
                      onClick={() => onAnswer(visit, "declined")}
                    >
                      {words.cannot}
                    </Button>
                  </>
                ) : (
                  <>
                    <span
                      className="live-status"
                      data-state={
                        visit.response === "declined" ? "declined" : undefined
                      }
                    >
                      {visit.response === "accepted"
                        ? words.going
                        : words.notGoing}
                    </span>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        onAnswer(
                          visit,
                          visit.response === "accepted"
                            ? "declined"
                            : "accepted",
                        )
                      }
                    >
                      {visit.response === "accepted"
                        ? words.cannotAfterAll
                        : words.canAfterAll}
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
