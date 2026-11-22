import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Language } from "@/lib/words";

/**
 * The month a date field opens (date-field.tsx): one month of day buttons in a grid, laid out and named as the
 * calendar library laid it (its rdp- class names, so paper.css draws it the same), without the library. Opening it
 * builds only the weeks in view: the library worked out every day's week number, matchers and focus target first.
 * Arrows move a day or a week, Home and End to the week's ends, Page Up and Page Down a month (with Shift, a year),
 * Enter or Space takes the day. The month's one Tab stop is the chosen day, else today, else the first day allowed.
 */

const said = {
  en: { locale: "en-US", weekStart: 0, previous: "Go to the Previous Month", next: "Go to the Next Month", nav: "Navigation bar" },
  es: { locale: "es", weekStart: 1, previous: "Ir al mes anterior", next: "Ir al mes siguiente", nav: "Barra de navegación" },
} satisfies Record<Language, unknown>;

const formats = new Map<string, Intl.DateTimeFormat>();
const format = (locale: string, options: Intl.DateTimeFormatOptions) => {
  const key = locale + JSON.stringify(options);
  let kept = formats.get(key);
  if (!kept) formats.set(key, (kept = new Intl.DateTimeFormat(locale, options)));
  return kept;
};

const dayOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const addMonths = (date: Date, months: number) => {
  const last = new Date(date.getFullYear(), date.getMonth() + months + 1, 0).getDate();
  return new Date(date.getFullYear(), date.getMonth() + months, Math.min(date.getDate(), last));
};
const sameDay = (a: Date | undefined, b: Date | undefined) => !!a && !!b && a.getTime() === b.getTime();
const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const chevron = { previous: "16 18.112 9.81111111 12 16 5.87733333 14.0888889 4 6 12 14.0888889 20", next: "8 18.112 14.18888889 12 8 5.87733333 9.91111111 4 18 12 9.91111111 20" };

const Day = memo(function Day({ date, label, chosen, today, allowed, stop, onPick }: { date: Date; label: string; chosen: boolean; today: boolean; allowed: boolean; stop: boolean; onPick: (date: Date) => void }) {
  const classes = ["rdp-day", stop && "rdp-focused", chosen && "rdp-selected", !allowed && "rdp-disabled", today && "rdp-today"].filter(Boolean).join(" ");
  return (
    <td className={classes} role="gridcell" aria-selected={chosen} data-day={key(date)}>
      {/* A day that cannot be taken is still read and still reached by the arrows, and said to be unavailable. */}
      <button className="rdp-day_button" type="button" aria-disabled={!allowed || undefined} aria-current={today ? "date" : undefined} tabIndex={stop ? 0 : -1} aria-label={label} onClick={() => allowed && onPick(date)}>
        {date.getDate()}
      </button>
    </td>
  );
});

export function DateMonth({ language, selected, defaultMonth, min, max, labelDay, onSelect }: {
  language: Language;
  selected?: Date;
  defaultMonth?: Date;
  min?: Date;
  max?: Date;
  labelDay: (day: Date) => string;
  onSelect: (day: Date) => void;
}) {
  const words = said[language];
  const today = useMemo(() => dayOf(new Date()), []);
  const allowed = (date: Date) => (!min || date >= dayOf(min)) && (!max || date <= dayOf(max));
  const first = () => {
    for (const date of [selected && dayOf(selected), today, min && dayOf(min)]) if (date && allowed(date)) return date;
    return dayOf(defaultMonth ?? today);
  };
  const [focus, setFocus] = useState(first);
  const [shown, setShown] = useState(() => { const at = selected ?? defaultMonth ?? today; return new Date(at.getFullYear(), at.getMonth(), 1); });
  const grid = useRef<HTMLTableElement>(null);
  const moved = useRef(false);

  const weeks = useMemo(() => {
    const start = addDays(shown, -((shown.getDay() - words.weekStart + 7) % 7));
    const rows: (Date | null)[][] = [];
    for (let day = start; day.getMonth() === shown.getMonth() || day < shown; ) {
      const row: (Date | null)[] = [];
      for (let i = 0; i < 7; i++, day = addDays(day, 1)) row.push(day.getMonth() === shown.getMonth() ? day : null);
      rows.push(row);
    }
    return rows;
  }, [shown, words.weekStart]);
  const weekdays = useMemo(() => weeks[0].map((_, i) => addDays(new Date(2026, 1, 1), (words.weekStart + i) % 7)), [weeks, words.weekStart]);

  // Focus follows a key into the day it moved to, once that day is drawn.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    grid.current?.querySelector<HTMLElement>('.rdp-day_button[tabindex="0"]')?.focus();
  }, [focus]);

  const go = (date: Date) => {
    if (!allowed(date)) return;
    moved.current = true;
    setFocus(date);
    if (date.getMonth() !== shown.getMonth() || date.getFullYear() !== shown.getFullYear()) setShown(new Date(date.getFullYear(), date.getMonth(), 1));
  };
  const turn = (months: number) => {
    const next = new Date(shown.getFullYear(), shown.getMonth() + months, 1);
    setShown(next);
    const day = addMonths(focus, months);
    if (allowed(day)) setFocus(day);
  };
  const keys = (event: KeyboardEvent) => {
    const step: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focus, -1), ArrowRight: () => addDays(focus, 1), ArrowUp: () => addDays(focus, -7), ArrowDown: () => addDays(focus, 7),
      Home: () => addDays(focus, -((focus.getDay() - words.weekStart + 7) % 7)), End: () => addDays(focus, 6 - ((focus.getDay() - words.weekStart + 7) % 7)),
      PageUp: () => addMonths(focus, event.shiftKey ? -12 : -1), PageDown: () => addMonths(focus, event.shiftKey ? 12 : 1),
    };
    const to = step[event.key];
    if (!to) return;
    event.preventDefault();
    go(to());
  };
  // The Tab stop is the focused day while it is in view; in another month, that month's first day that can be taken.
  const inView = (date: Date) => date.getMonth() === shown.getMonth() && date.getFullYear() === shown.getFullYear();
  const stop = inView(focus) ? focus : weeks.flat().find((date): date is Date => !!date && allowed(date));
  // The month and its year alone, as the library set them: "noviembre 2026", never "noviembre de 2026".
  const caption = `${format(words.locale, { month: "long" }).format(shown)} ${shown.getFullYear()}`;
  const span = format(words.locale, { month: "long", day: "numeric" });
  const weekdayShort = format(words.locale, { weekday: "short" });
  const weekdayLong = format(words.locale, { weekday: "long" });

  return (
    <div className="rdp-root" lang={words.locale} data-mode="single">
      <div className="rdp-months">
        <nav className="rdp-nav" aria-label={words.nav}>
          {/* As the library drew them: both ways always open; a month with no day to take simply has none. */}
          {(["previous", "next"] as const).map((way) => (
            <button key={way} type="button" className={`rdp-button_${way}`} aria-label={words[way]} onClick={() => turn(way === "previous" ? -1 : 1)}>
              <svg className="rdp-chevron" aria-hidden="true" width="24" height="24" viewBox="0 0 24 24"><polygon points={chevron[way]} /></svg>
            </button>
          ))}
        </nav>
        <div className="rdp-month">
          <div className="rdp-month_caption"><span className="rdp-caption_label" role="status" aria-live="polite">{caption}</span></div>
          <table role="grid" aria-multiselectable="false" aria-label={caption} className="rdp-month_grid" ref={grid} onKeyDown={keys}>
            <thead aria-hidden="true">
              <tr className="rdp-weekdays">
                {weekdays.map((day) => <th key={day.getDay()} aria-label={weekdayLong.format(day)} className="rdp-weekday" scope="col">{weekdayShort.format(day).replace(".", "").slice(0, 2)}</th>)}
              </tr>
            </thead>
            <tbody className="rdp-weeks">
              {weeks.map((row) => (
                <tr key={key(row.find(Boolean) as Date)} className="rdp-week" aria-label={span.formatRange(row.find(Boolean) as Date, [...row].reverse().find(Boolean) as Date)}>
                  {row.map((date, i) => date
                    ? <Day key={i} date={date} label={labelDay(date)} chosen={sameDay(date, selected && dayOf(selected))} today={sameDay(date, today)} allowed={allowed(date)} stop={sameDay(date, stop)} onPick={onSelect} />
                    : <td key={i} className="rdp-day rdp-outside rdp-hidden" role="gridcell" />)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
