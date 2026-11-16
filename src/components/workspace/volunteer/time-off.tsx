"use client";

import { Button } from "@/components/ui/button";
import { LiveEmpty, LiveField } from "@/components/workspace/primitives";
import { DateField } from "@/components/workspace/date-field";
import { useWorkspace } from "@/components/workspace/context";
import { formatDate, type Words } from "@/lib/words";
import { MonthAway } from "@/components/workspace/volunteer/asides";
import type { LiveCommand, LiveWorkspaceData } from "@/components/workspace/types";

/** The one date pattern for whole days: "Thursday, November 19 to Saturday, November 21". The year is written only when it is not this one. */
function readDays(words: Words, start: string, end: string) {
  const read = (day: string) => {
    const time = Date.parse(`${day}T12:00:00Z`);
    if (!Number.isFinite(time)) return day;
    return formatDate(words.locale, time, { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: day.startsWith(String(new Date().getFullYear())) ? undefined : "numeric" });
  };
  const whole = start === end ? read(start) : `${read(start)} ${words.rota.through} ${read(end)}`;
  return whole.charAt(0).toUpperCase() + whole.slice(1);
}

export function TimeOffSection() {
  const { data, pending, ownPerson, perform, words, openAction } = useWorkspace();
  return (
    <>
      <MonthAway />
      <div className="live-note paper-rise">
        {words.timeOff.note}
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
                    {readDays(words, item.start, item.end)}
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
                      words.timeOff.removed,
                    )
                  }
                >
                  {words.timeOff.remove}
                </Button>
              </div>
            ))
        ) : (
          <LiveEmpty title={words.timeOff.emptyTitle} action={{ label: words.actions.timeOff, run: () => openAction("timeOff") }}>
            {words.timeOff.emptyDetail}
          </LiveEmpty>
        )}
      </div>
      <section className="live-section">
        <h2>{words.timeOff.coverTitle}</h2>
        <p className="live-deck">
          {words.timeOff.coverDeck}
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
            ? words.timeOff.coverStop
            : words.timeOff.coverStart}
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
  const { words } = useWorkspace();
  return (
    <section className="live-section">
      <h2>{words.timeOff.availableTitle}</h2>
      <p className="live-deck">
        {words.timeOff.availableDeck}
      </p>
      <div className="live-list" style={{ marginTop: 20 }}>
        {data.availability
          .filter((item) => item.personId === data.user.id)
          .map((item) => (
            <div className="live-row" key={item.id}>
              <span>
                {readDays(words, item.start, item.end)}
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
                {words.timeOff.remove}
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
          <LiveField label={words.timeOff.firstAvailable}>
            <DateField name="start" required />
          </LiveField>
          <LiveField label={words.timeOff.lastAvailable}>
            <DateField name="end" required />
          </LiveField>
        </div>
        <div>
          <Button type="submit" variant="outline">
            {words.timeOff.addAvailable}
          </Button>
        </div>
      </form>
    </section>
  );
}
