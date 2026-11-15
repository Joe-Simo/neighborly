"use client";

import "./tools.css";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { weekLabel, weekRota, weekStart, type RotaDay } from "@/components/workspace/tools/rota";

export function WeeklyRotaView({ group, week, days, printed, sample, titled = true, onEarlier, onLater, onPrint }: { group: string; week: string; days: RotaDay[]; printed: string; sample?: boolean; titled?: boolean; onEarlier: () => void; onLater: () => void; onPrint: () => void }) {
  const planned = days.some((day) => day.shifts.length > 0);
  const text = useWorkspace().words.rota;
  return (
    <section className={titled ? "live-section" : undefined}>
      {titled && (
        <div className="live-section-head">
          <h2>{text.title}</h2>
        </div>
      )}
      <p className="live-deck">{text.deck}</p>
      <div className="tools-week">
        <Button variant="outline" className="tools-week-step" aria-label={text.before} onClick={onEarlier}><ChevronLeft size={18} aria-hidden="true" /></Button>
        <Button variant="outline" className="tools-week-step" aria-label={text.after} onClick={onLater}><ChevronRight size={18} aria-hidden="true" /></Button>
        <Button disabled={!planned} onClick={onPrint}><Printer size={16} aria-hidden="true" /> {text.print}</Button>
      </div>
      <div className="tools-rota paper-settle" key={week}>
        <header>
          <p>{group}</p>
          <h3 aria-live="polite">{week}</h3>
        </header>
        {planned ? (
          <div className="live-table-scroll">
            <table className="paper-rows">
              <thead>
                <tr><th scope="col">{text.time}</th><th scope="col">{text.what}</th><th scope="col">{text.where}</th><th scope="col">{text.who}</th></tr>
              </thead>
              {days.map((day) => (
                <tbody key={day.key}>
                  <tr className="tools-rota-day"><th scope="rowgroup" colSpan={4}>{day.label}</th></tr>
                  {!day.shifts.length && <tr className="tools-rota-none"><td colSpan={4}>{text.none}</td></tr>}
                  {day.shifts.map((shift) => (
                    <tr key={shift.id}>
                      <td>{shift.time}</td>
                      <td>{shift.title}<small>{shift.team}</small></td>
                      <td>{shift.location}</td>
                      <td>{shift.who ?? <span className="tools-rota-open">{text.open}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        ) : (
          <div className="help-empty">
            <div className="help-empty-art" aria-hidden="true" />
            <div>
              <h3>{text.quietTitle}</h3>
              <p>{text.quietDetail}</p>
            </div>
          </div>
        )}
        <footer className="tools-rota-foot"><span>kind helps</span><span>{sample && `${text.sample} · `}{text.printed} {printed}</span></footer>
      </div>
    </section>
  );
}

/** titled is false inside a dialog, where the dialog carries the heading. */
export function WeeklyRota({ titled = true }: { titled?: boolean }) {
  const { data, now, format, personName, teamName, words } = useWorkspace();
  const [weeksAhead, setWeeksAhead] = useState(0);
  const start = weekStart(now, data.church.timeZone, weeksAhead);
  const shifts = data.commitments
    .filter((item) => item.status !== "cancelled")
    .map((item) => ({ id: item.id, title: item.title, start: item.start, end: item.end, location: item.location, team: teamName(item.teamId), who: item.assigneeId ? personName(item.assigneeId) : null }));
  return (
    <WeeklyRotaView
      group={data.church.name}
      week={weekLabel(start, words.locale, words.rota)}
      days={weekRota(shifts, start, words.locale, words.rota)}
      printed={format(now, { year: "numeric", month: "long" })}
      sample={data.church.sample}
      titled={titled}
      onEarlier={() => setWeeksAhead((value) => value - 1)}
      onLater={() => setWeeksAhead((value) => value + 1)}
      onPrint={() => window.print()}
    />
  );
}
