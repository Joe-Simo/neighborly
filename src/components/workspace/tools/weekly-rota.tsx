"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { weekLabel, weekRota, weekStart, type RotaDay } from "@/components/workspace/tools/rota";

export function WeeklyRotaView({ group, week, days, printed, sample, onEarlier, onLater, onPrint }: { group: string; week: string; days: RotaDay[]; printed: string; sample?: boolean; onEarlier: () => void; onLater: () => void; onPrint: () => void }) {
  const planned = days.some((day) => day.shifts.length > 0);
  return (
    <section className="live-section">
      <div className="live-section-head">
        <h2>The week on paper</h2>
      </div>
      <p className="live-deck">For the parish office wall, the sacristy door, or anyone who would rather hold it.</p>
      <div className="tools-week">
        <Button variant="outline" className="tools-week-step" aria-label="Earlier week" onClick={onEarlier}><ChevronLeft size={18} aria-hidden="true" /></Button>
        <Button variant="outline" className="tools-week-step" aria-label="Later week" onClick={onLater}><ChevronRight size={18} aria-hidden="true" /></Button>
        <Button disabled={!planned} onClick={onPrint}><Printer size={16} aria-hidden="true" /> Print this week</Button>
      </div>
      <div className="tools-rota" aria-live="polite">
        <header>
          <p>{group}</p>
          <h3>{week}</h3>
        </header>
        {planned ? (
          <div className="live-table-scroll">
            <table>
              <thead>
                <tr><th scope="col">Time</th><th scope="col">What</th><th scope="col">Where</th><th scope="col">Who</th></tr>
              </thead>
              {days.map((day) => (
                <tbody key={day.key}>
                  <tr className="tools-rota-day"><th scope="rowgroup" colSpan={4}>{day.label}</th></tr>
                  {!day.shifts.length && <tr className="tools-rota-none"><td colSpan={4}>Nothing planned</td></tr>}
                  {day.shifts.map((shift) => (
                    <tr key={shift.id}>
                      <td>{shift.time}</td>
                      <td>{shift.title}<small>{shift.team}</small></td>
                      <td>{shift.location}</td>
                      <td>{shift.who ?? <span className="tools-rota-open">Open</span>}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        ) : (
          <div className="help-empty">
            <div className="help-empty-art" style={{ backgroundImage: "url(/assets/threshold/courtyard-quiet-plate-v1.webp)" }} aria-hidden="true" />
            <div>
              <h3>A quiet week.</h3>
              <p>Nothing is planned for these days yet. Commitments appear here as soon as they are added.</p>
            </div>
          </div>
        )}
        <footer className="tools-rota-foot"><span>kind helps</span><span>{sample && "Sample · "}Printed {printed}</span></footer>
      </div>
    </section>
  );
}

export function WeeklyRota() {
  const { data, now, format, personName, teamName } = useWorkspace();
  const [weeksAhead, setWeeksAhead] = useState(0);
  const start = weekStart(now, data.church.timeZone, weeksAhead);
  const shifts = data.commitments
    .filter((item) => item.status !== "cancelled")
    .map((item) => ({ id: item.id, title: item.title, start: item.start, end: item.end, location: item.location, team: teamName(item.teamId), who: item.assigneeId ? personName(item.assigneeId) : null }));
  return (
    <WeeklyRotaView
      group={data.church.name}
      week={weekLabel(start)}
      days={weekRota(shifts, start)}
      printed={format(now, { dateStyle: "long" })}
      sample={data.church.sample}
      onEarlier={() => setWeeksAhead((value) => value - 1)}
      onLater={() => setWeeksAhead((value) => value + 1)}
      onPrint={() => window.print()}
    />
  );
}
