"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LiveEmpty, LiveField } from "@/components/workspace/primitives";
import { useWorkspace } from "@/components/workspace/context";
import type { LiveCommand, LiveWorkspaceData } from "@/components/workspace/types";

export function TimeOffSection() {
  const { data, pending, ownPerson, perform } = useWorkspace();
  return (
    <>
      <div className="live-note">
        Time off does not remove you from your teams. Existing
        commitments need a separate change so everyone knows what is
        covered.
      </div>
      <div className="live-list">
        {data.timeOff.filter((item) => item.personId === data.user.id)
          .length ? (
          data.timeOff
            .filter((item) => item.personId === data.user.id)
            .map((item) => (
              <div className="live-row" key={item.id}>
                <div>
                  <h3>
                    {item.start} — {item.end}
                  </h3>
                  {item.note && <p>{item.note}</p>}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    void perform(
                      { type: "removeTimeOff", timeOffId: item.id },
                      "Time off removed.",
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            ))
        ) : (
          <LiveEmpty title="No time away planned.">
            Add dates when you won’t be available. Your place on the
            team stays the same.
          </LiveEmpty>
        )}
      </div>
      <section className="live-section">
        <h2>Cover requests</h2>
        <p className="live-deck">
          Choose whether coordinators may ask you to cover an open
          commitment. Every request still needs your acceptance.
        </p>
        <Button
          style={{ marginTop: 20 }}
          variant="outline"
          disabled={pending || !ownPerson}
          onClick={() =>
            void perform({
              type: "setCoverOptIn",
              optedIn: !ownPerson?.coverOptIn,
            })
          }
        >
          {ownPerson?.coverOptIn
            ? "Stop receiving cover requests"
            : "Receive cover requests"}
        </Button>
      </section>
      <LiveAvailability data={data} run={perform} />
    </>
  );
}

function LiveAvailability({
  data,
  run,
}: {
  data: LiveWorkspaceData;
  run: (command: LiveCommand) => Promise<boolean>;
}) {
  return (
    <section className="live-section">
      <h2>When you can help</h2>
      <p className="live-deck">
        Volunteer dates when you’re available for cover. Availability is not an
        accepted commitment.
      </p>
      <div className="live-list" style={{ marginTop: 20 }}>
        {data.availability
          .filter((item) => item.personId === data.user.id)
          .map((item) => (
            <div className="live-row" key={item.id}>
              <span>
                {item.start} — {item.end}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void run({
                    type: "removeAvailability",
                    availabilityId: item.id,
                  })
                }
              >
                Remove
              </Button>
            </div>
          ))}
      </div>
      <form
        className="live-form live-inline-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const f = new FormData(form);
          if (
            await run({
              type: "addAvailability",
              start: String(f.get("start")),
              end: String(f.get("end")),
            })
          )
            form.reset();
        }}
      >
        <div className="live-form-grid">
          <LiveField label="First available day">
            <Input type="date" name="start" required />
          </LiveField>
          <LiveField label="Last available day">
            <Input type="date" name="end" required />
          </LiveField>
        </div>
        <Button type="submit" variant="outline">
          Add available dates
        </Button>
      </form>
    </section>
  );
}
