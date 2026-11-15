"use client";

import "./visits.css";
import { useMutation, useQuery } from "convex/react";
import { Check } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useWorkspace, type Workspace } from "@/components/workspace/context";
import { count } from "@/components/workspace/help-line/format";
import { useSave } from "@/components/workspace/help-line/use-save";
import type { OwnVisit } from "@/components/workspace/visits/format";

/**
 * The home visits the signed-in person has been asked to make, with their yes or no.
 * For the My commitments page: it takes no props, and shows nothing when no visit is theirs.
 * It carries the time, the street and the other visitor only; the neighbor's name is on the
 * visit sheet the coordinator hands them.
 */
export function MyVisits() {
  const { data, format } = useWorkspace();
  const churchId = data.church.id;
  const visits = useQuery(api.visits.mine, { churchId });
  const respond = useMutation(api.visits.respond);
  const { pending, error, save } = useSave();
  if (!visits?.length) return null;
  return (
    <MyVisitsView
      visits={visits}
      format={format}
      busy={pending}
      error={error}
      onAnswer={(visit, response) =>
        void save(() => respond({ churchId, visitId: visit.id, response }))
      }
    />
  );
}

export function MyVisitsView({
  visits,
  format,
  busy,
  error,
  onAnswer,
}: {
  visits: OwnVisit[];
  format: Workspace["format"];
  busy: boolean;
  error: string;
  onAnswer: (visit: OwnVisit, response: "accepted" | "declined") => void;
}) {
  const part = (at: number, options: Intl.DateTimeFormatOptions) =>
    format(at, { month: undefined, day: undefined, ...options });
  return (
    <section className="live-section visits-mine" aria-labelledby="my-visits">
      <div className="live-section-head">
        <h2 id="my-visits">Home visits</h2>
        <span className="live-count">
          {count(visits.length, "visit", "visits")}, always with a partner
        </span>
      </div>
      {error && (
        <div className="live-error" role="alert">
          <p>{error}</p>
          <p className="live-error-recovery">
            Your answer was not saved. Try again.
          </p>
        </div>
      )}
      <div className="live-list">
        {visits.map((visit) => {
          const [time, half = ""] = part(visit.scheduledAt, {
            hour: "numeric",
            minute: "2-digit",
          }).split(/\s/);
          return (
            <div className="help-row" key={visit.id}>
              <div className="live-date-leaf">
                <span>
                  {format(visit.scheduledAt, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <strong>{time}</strong>
                <span>{half}</span>
              </div>
              <div>
                <h3>A visit on {visit.street || "a street nearby"}</h3>
                <p>
                  With {visit.partner}. Your coordinator has the visit sheet.
                </p>
              </div>
              <div className="live-row-actions">
                {visit.response === "pending" ? (
                  <>
                    <Button
                      disabled={busy}
                      onClick={() => onAnswer(visit, "accepted")}
                    >
                      <Check size={18} aria-hidden="true" /> I’ll go
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => onAnswer(visit, "declined")}
                    >
                      I can’t go
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
                        ? "You’re going"
                        : "You can’t go"}
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
                        ? "I can’t go after all"
                        : "I can go after all"}
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
