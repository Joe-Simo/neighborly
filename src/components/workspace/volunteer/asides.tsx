"use client";

import "./asides.css";
import { DateTime } from "luxon";
import { RoomAside } from "@/components/workspace/aside";
import { useWorkspace } from "@/components/workspace/context";

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The seven days from a Sunday, as the shell writes them: "Sun", "dom", "dim". */
function useWeekdays(sunday: DateTime) {
  const { format } = useWorkspace();
  return Array.from({ length: 7 }, (_, index) => {
    const noon = sunday.plus({ days: index, hours: 12 }).toMillis();
    return {
      short: capital(format(noon, { weekday: "short", month: undefined, day: undefined })),
      long: capital(format(noon, { weekday: "long", month: undefined, day: undefined })),
    };
  });
}

/** Time off: this month, with the days you are away and the days you offered marked. */
export function MonthAway() {
  const { data, now, format, words } = useWorkspace();
  const text = words.timeOff;
  const today = DateTime.fromMillis(now, { zone: data.church.timeZone, locale: "en-US" });
  const first = today.startOf("month");
  const weekdays = useWeekdays(first.startOf("week", { useLocaleWeeks: true }));
  const mine = <T extends { personId: string }>(items: T[]) => items.filter((item) => item.personId === data.user.id);
  const within = (key: string, spans: { start: string; end: string }[]) => spans.some((span) => span.start <= key && key <= span.end);
  const away = mine(data.timeOff), offered = mine(data.availability);
  const cells = [
    ...Array.from({ length: first.weekday % 7 }, () => null),
    ...Array.from({ length: first.daysInMonth ?? 30 }, (_, index) => first.plus({ days: index })),
  ];
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, week) => cells.slice(week * 7, week * 7 + 7));
  return (
    <RoomAside title={text.thisMonth}>
      <table className="volunteer-month">
        <caption>{capital(format(first.plus({ hours: 12 }).toMillis(), { month: "long", year: "numeric", day: undefined }))}</caption>
        <thead>
          <tr>{weekdays.map((day) => <th key={day.long} scope="col" abbr={day.long}>{day.short}</th>)}</tr>
        </thead>
        <tbody>
          {weeks.map((week, index) => (
            <tr key={index}>
              {Array.from({ length: 7 }, (_, column) => {
                const day = week[column];
                if (!day) return <td key={column} />;
                const key = day.toFormat("yyyy-MM-dd");
                const mark = within(key, away) ? "away" : within(key, offered) ? "offered" : undefined;
                const offeredOn = (other: DateTime) => other.month === day.month && !within(other.toFormat("yyyy-MM-dd"), away) && within(other.toFormat("yyyy-MM-dd"), offered);
                const run = mark !== "offered" ? undefined : `${column > 0 && offeredOn(day.minus({ days: 1 })) ? "" : "first"} ${column < 6 && offeredOn(day.plus({ days: 1 })) ? "" : "last"}`.trim() || "middle";
                return (
                  <td key={column} data-mark={mark} data-run={run} data-today={day.hasSame(today, "day") || undefined} aria-current={day.hasSame(today, "day") ? "date" : undefined}>
                    <span>{day.day}</span>
                    {mark && <span className="sr-only"> {mark === "away" ? text.away : text.canHelp}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {/* A key only for marks that are on the calendar. */}
      {(away.length > 0 || offered.length > 0) && <ul className="volunteer-key">
        {away.length > 0 && <li><i data-mark="away" aria-hidden="true" />{text.away}</li>}
        {offered.length > 0 && <li><i data-mark="offered" aria-hidden="true" />{text.canHelp}</li>}
      </ul>}
    </RoomAside>
  );
}

/** Commitments: this week, one line for each team, a mark for every place that is covered or still open. */
export function WeekByTeam() {
  const { data, now, words, sampleSaid } = useWorkspace();
  const text = words.commitments;
  const today = DateTime.fromMillis(now, { zone: data.church.timeZone, locale: "en-US" });
  const sunday = today.startOf("week", { useLocaleWeeks: true });
  const weekdays = useWeekdays(sunday);
  const from = sunday.toMillis(), until = sunday.plus({ weeks: 1 }).toMillis();
  // Where each of the week's seven days begins, in the conference's own zone, worked out once; a commitment's day is the
  // last of them it starts on or after. (Asking the calendar for every commitment, for every team and day, held the room's
  // first frame back.)
  const dayStarts = Array.from({ length: 7 }, (_, day) => sunday.plus({ days: day }).toMillis());
  const dayOf = (time: number) => dayStarts.findLastIndex((start) => time >= start);
  const week = data.commitments.filter((item) => item.status !== "cancelled" && item.start >= from && item.start < until);
  const teams = data.teams
    .map((team) => {
      const own = week.filter((item) => item.teamId === team.id);
      return {
        team,
        open: own.filter((item) => !item.assigneeId).length,
        days: Array.from({ length: 7 }, (_, day) => {
          const here = own.filter((item) => dayOf(item.start) === day);
          return { covered: here.filter((item) => item.assigneeId).length, open: here.filter((item) => !item.assigneeId).length };
        }),
      };
    })
    .filter((row) => row.days.some((day) => day.covered || day.open))
    .slice(0, 8);
  if (!teams.length) return null;
  return (
    <RoomAside title={text.weekByTeam}>
      <table className="volunteer-teams-week">
        <thead>
          <tr>
            {weekdays.map((day, index) => <th key={day.long} scope="col" abbr={day.long} data-today={index === today.weekday % 7 || undefined}>{day.short}</th>)}
          </tr>
        </thead>
        {teams.map(({ team, open, days }) => (
          <tbody key={team.id}>
            <tr>
              <th scope="rowgroup" colSpan={7}>
                <span>{sampleSaid(team.name)}</span>
                {open > 0 && <small><i data-mark="open" aria-hidden="true" />{text.placesOpen(open)}</small>}
              </th>
            </tr>
            <tr>
              {days.map((day, index) => (
                <td key={index}>
                  {Array.from({ length: Math.min(day.covered, 3) }, (_, mark) => <i key={`c${mark}`} data-mark="covered" aria-hidden="true" />)}
                  {Array.from({ length: Math.min(day.open, 3) }, (_, mark) => <i key={`o${mark}`} data-mark="open" aria-hidden="true" />)}
                  {(day.covered > 0 || day.open > 0) && (
                    <span className="sr-only">
                      {[day.covered && `${day.covered} ${text.covered}`, day.open && text.placesOpen(day.open)].filter(Boolean).join(", ")}
                    </span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        ))}
      </table>
      <ul className="volunteer-key">
        <li><i data-mark="covered" aria-hidden="true" />{text.covered}</li>
        <li><i data-mark="open" aria-hidden="true" />{text.placeOpen}</li>
      </ul>
    </RoomAside>
  );
}

/** Tasks: the meeting that comes next, and what you answered. */
export function NextMeeting() {
  const { data, now, format, words, sampleSaid } = useWorkspace();
  const meeting = data.meetings.filter((item) => item.end > now).sort((a, b) => a.start - b.start)[0];
  if (!meeting) return null;
  const response = meeting.responses.find((item) => item.personId === data.user.id)?.response;
  const clock = (time: number) => format(time, { month: undefined, day: undefined, hour: "numeric", minute: "2-digit" });
  return (
    <RoomAside title={words.tasks.nextMeeting}>
      <div className="volunteer-next">
        <p className="volunteer-next-day">{capital(format(meeting.start, { weekday: "long", month: "long" }))}</p>
        <p className="volunteer-next-title">{sampleSaid(meeting.title)}</p>
        <p>{clock(meeting.start)}–{clock(meeting.end)}</p>
        {meeting.location && <p>{sampleSaid(meeting.location)}</p>}
        <p className="volunteer-next-reply" data-reply={response ?? "none"}>
          {response === "accepted" ? words.tasks.going : response ? words.tasks.notGoing : words.tasks.waiting}
        </p>
      </div>
    </RoomAside>
  );
}
