"use client";

import { Suspense, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { fetchedCode } from "@/components/workspace/fetched-code";
import { ChevronDown } from "lucide-react";
import { wrongControl } from "@/components/workspace/failure";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useWorkspace } from "@/components/workspace/context";
import { formatDate, type Language } from "@/lib/words";

// The calendar library is needed only once a month is opened. It is fetched when the page is idle after the first
// room (fetchMonthAhead, with the rooms ahead), and marked as React marks a promise it has read, so a month opened
// after that is drawn in its first frame; one opened sooner waits a moment for it, inside the open sheet.
const monthCode = fetchedCode(() => import("@/components/workspace/date-month").then((code) => code.DateMonth));
export const fetchMonthAhead = monthCode.fetch;
const Month = monthCode.Code;

/** "2026-11-20" and the local day it names, each way. */
const toDay = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const toValue = (day: Date) =>
  `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;

/** A typed day: 2026-11-19, or numbers in the order the language writes them (11/19 in English, 19/11 in Spanish). */
function readTyped(text: string, language: Language): string | undefined {
  const parts = text.trim().split(/[^0-9]+/).filter(Boolean).map(Number);
  if (parts.length < 2 || parts.length > 3) return undefined;
  const thisYear = new Date().getFullYear();
  const [year, month, day] =
    parts[0] > 31 ? parts : language === "en" ? [parts[2] ?? thisYear, parts[0], parts[1]] : [parts[2] ?? thisYear, parts[1], parts[0]];
  const read = new Date(year < 100 ? year + 2000 : year, month - 1, day);
  return read.getMonth() === month - 1 && read.getDate() === day ? toValue(read) : undefined;
}

const narrow = "(max-width: 699px)";
const watchNarrow = (change: () => void) => {
  const query = matchMedia(narrow);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
};

/**
 * The one date field of every room. It takes and gives the same "YYYY-MM-DD"
 * a date input does: give `name` and read FormData, or give `value` and `onChange`.
 * Closed it reads "Thursday, November 19"; open it is a month, in a popover on a
 * desk and a sheet from the bottom under 700px. On a desk a day can also be typed.
 * Put it inside a LiveField for its label.
 */
export function DateField({
  name,
  value,
  defaultValue = "",
  onChange,
  required,
  min,
  max,
  disabled,
  short,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  /** The first and last days that can be chosen, as "YYYY-MM-DD". */
  min?: string;
  max?: string;
  disabled?: boolean;
  /** The day said short ("Wed, Sep 30" / "mié, 30 sept"; "Sep 29, 2027" in another year), for a field that shares its row, so the whole date always shows. */
  short?: boolean;
}) {
  const { words } = useWorkspace();
  const sheet = useSyncExternalStore(watchNarrow, () => matchMedia(narrow).matches, () => false);
  const [open, setOpen] = useState(false);
  const [own, setOwn] = useState(defaultValue);
  const [typed, setTyped] = useState<string>();
  const [label, setLabel] = useState("");
  const chosen = value ?? own;
  const allowed = (day: string) => (!min || day >= min) && (!max || day <= max);
  // A needed day left empty, or one the form says is wrong (markWrong): said under the field in our own words,
  // never the browser's bubble. A new day takes the line away.
  const [missing, setMissing] = useState("");
  // Only the first wrong field of a submit speaks (as LiveField).
  const [first, setFirst] = useState(false);
  const missingId = useId();
  const hidden = useRef<HTMLInputElement | null>(null);
  const choose = (day: string) => {
    setMissing("");
    hidden.current?.setCustomValidity("");
    setOwn(day);
    setTyped(undefined);
    onChange?.(day);
  };
  const said = chosen
    ? formatDate(words.locale, toDay(chosen).getTime(), {
        // Said short, a day in another year gives up its weekday for the year, so the whole date still fits.
        ...(short && toDay(chosen).getFullYear() !== new Date().getFullYear() ? {} : { weekday: short ? "short" : "long" }),
        month: short ? "short" : "long",
        day: "numeric",
        ...(toDay(chosen).getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }),
      })
    : "";
  const keep = () => {
    const read = typed === undefined ? undefined : readTyped(typed, words.locale);
    if (read && allowed(read)) choose(read);
    else setTyped(undefined);
  };
  const month = (
    <Suspense fallback={null}>
    <Month
      language={words.locale}
      selected={chosen ? toDay(chosen) : undefined}
      defaultMonth={chosen ? toDay(chosen) : min ? toDay(min) : undefined}
      min={min ? toDay(min) : undefined}
      max={max ? toDay(max) : undefined}
      // A day's name starts with the number it shows, then says the rest: "1, Sunday, November 2026".
      labelDay={(day) =>
        `${day.getDate()}, ${formatDate(words.locale, day.getTime(), { weekday: "long" })}, ${formatDate(words.locale, day.getTime(), { month: "long", year: "numeric" })}`}
      onSelect={(day) => {
        choose(toValue(day));
        close();
      }}
    />
    </Suspense>
  );
  // Whichever way the month closes (a day chosen, Escape, Done), focus goes back to the field, where the keys are:
  // a day is typed there, or Down opens the month. The button beside it is for a pointer and is no Tab stop.
  const field = useRef<HTMLSpanElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const monthId = useId();
  const close = () => {
    setOpen(false);
    field.current?.querySelector<HTMLElement>(".live-date-words")?.focus({ preventScroll: true });
  };
  // The month opens on its day, not on its arrows: the chosen day, else today, else the first day that can be chosen,
  // which the month itself keeps as its one Tab stop. Arrows move between days and Enter takes one. In the month's
  // first frame, not inside the press: focusing there made the browser work out the page's styles before it drew.
  // A month opened by a click in the words leaves the caret there, so the day can still be typed.
  const caretStays = useRef(false);
  useEffect(() => {
    if (!open) return;
    const typing = caretStays.current;
    caretStays.current = false;
    let frame = typing ? 0 : requestAnimationFrame(function find() {
      const day = grid.current?.querySelector<HTMLElement>('.rdp-day_button[tabindex="0"]');
      if (day) day.focus({ preventScroll: true });
      else frame = requestAnimationFrame(find);
    });
    // Escape closes the month alone, not the sheet the form lies in: it is caught before the sheet hears it.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !(event.target instanceof Node) || !(grid.current?.contains(event.target) || field.current?.contains(event.target))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    };
    window.addEventListener("keydown", escape, { capture: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", escape, { capture: true }); };
  }, [open]);
  return (
    <>
        <span ref={field} className="live-date" data-open={open || undefined} data-missing={missing || undefined}>
          <input
            className="live-date-words"
            type="text"
            autoComplete="off"
            disabled={disabled}
            readOnly={sheet}
            aria-controls={open ? monthId : undefined}
            aria-required={required || undefined}
            aria-invalid={missing ? true : undefined}
            aria-describedby={missing ? missingId : undefined}
            // Named by its field's own label alone ("Starts"), not by every word inside the label, the hour's included.
            aria-label={label || undefined}
            placeholder={words.dateField.choose}
            value={typed ?? said}
            onChange={(event) => setTyped(event.target.value)}
            onBlur={keep}
            ref={(input) => setLabel(input?.labels?.[0]?.querySelector("span")?.textContent ?? "")}
            onClick={() => {
              if (sheet) return setOpen(true);
              // On a desktop a click in the words opens the month too, as ArrowDown does; the caret stays to type.
              if (open) return;
              caretStays.current = true;
              setOpen(true);
            }}
            onKeyDown={(event) => {
              const opener = event.currentTarget.nextElementSibling;
              if (event.key === "ArrowDown" || (sheet && (event.key === "Enter" || event.key === " "))) {
                event.preventDefault();
                if (sheet) setOpen(true);
                else if (opener instanceof HTMLElement) opener.click();
              } else if (event.key === "Enter") {
                event.preventDefault();
                keep();
              }
            }}
          />
          <button type="button" className="live-date-open" disabled={disabled} tabIndex={-1} aria-label={label ? `${label}, ${words.dateField.choose.toLowerCase()}` : words.dateField.choose} aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>
            <ChevronDown aria-hidden="true" />
          </button>
          {/* What the form reads and checks. A form's reset empties it, and the field with it. */}
          <input
            className="live-date-value"
            name={name}
            value={chosen}
            required={required}
            tabIndex={-1}
            aria-hidden="true"
            // The form's own check finds the empty day here; the answer goes to the field the person sees.
            onInvalid={(event) => {
              event.preventDefault();
              const control = event.currentTarget;
              setMissing(control.validity.customError ? control.validationMessage : `${words.dateField.choose}.`);
              const lead = control.form?.querySelector(wrongControl) === control;
              setFirst(lead);
              if (lead)
                control.parentElement?.querySelector<HTMLInputElement>(".live-date-words")?.focus();
            }}
            onChange={(event) => setOwn(event.target.value)}
            ref={(input) => {
              hidden.current = input;
              const form = input?.form;
              if (!form) return;
              const clear = () => setOwn("");
              form.addEventListener("reset", clear);
              return () => form.removeEventListener("reset", clear);
            }}
          />
        </span>
      {missing && (
        <small id={missingId} className="live-date-missing" role={first ? "alert" : undefined}>
          {missing}
        </small>
      )}
      {/* The month opens in the form itself, under its field, and the form makes room for it: nothing is laid over the page. */}
      {open && (
        <div ref={grid} id={monthId} role="group" aria-label={label || words.dateField.choose} className="live-date-sheet live-date-inline"
>
          {/* The field above already names the day; the bar holds only the way to put the month away. */}
          <div className="live-date-bar">
            <button type="button" className="live-date-done" onClick={close}>{words.dateField.done}</button>
          </div>
          {month}
        </div>
      )}
    </>
  );
}

/**
 * The one time field: a list of half hours, in the reader's own clock words.
 * It takes and gives "HH:mm". `from` and `to` are the first and last half hours offered.
 */
export function TimeField({
  from = "07:00",
  to = "20:30",
  value,
  defaultValue,
  ...select
}: Omit<React.ComponentProps<typeof NativeSelect>, "children" | "value" | "defaultValue"> & {
  from?: string;
  to?: string;
  value?: string;
  defaultValue?: string;
}) {
  const { words } = useWorkspace();
  const halfHours = Array.from({ length: 48 }, (_, index) => `${String(index >> 1).padStart(2, "0")}:${index % 2 ? "30" : "00"}`).filter(
    (time) => time >= from && time <= to,
  );
  // A time already set outside the list keeps its own choice.
  const own = value ?? defaultValue;
  // Beside a day in one field (WhenField), the hour is not the label's own control: it is named "Starts, time".
  const [named, setNamed] = useState<string>();
  const choices = !own || halfHours.includes(own) ? halfHours : [...halfHours, own].sort();
  return (
    <NativeSelect
      className="live-time w-full"
      aria-label={named}
      ref={(control: HTMLSelectElement | null) => {
        const field = control?.closest("label");
        if (control && field && field.control !== control) setNamed(`${field.querySelector("span")?.textContent ?? ""}, ${words.dateField.time}`);
      }}
      {...select} {...(value === undefined ? { defaultValue: defaultValue ?? "" } : { value })}>
      <NativeSelectOption value="" disabled>
        {words.dateField.chooseTime}
      </NativeSelectOption>
      {choices.map((time) => (
        <NativeSelectOption key={time} value={time}>
          {formatDate(words.locale, new Date(2026, 0, 1, Number(time.slice(0, 2)), Number(time.slice(3))).getTime(), { hour: "numeric", minute: "2-digit" })}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

/**
 * A day and a time together, for a start, an end or a due moment. It takes and gives the same
 * "YYYY-MM-DDTHH:mm" a datetime-local input does, under one `name`. Choosing a day first sets `firstTime`.
 */
export function WhenField({
  name,
  defaultValue = "",
  required,
  min,
  from = "00:00",
  to = "23:30",
  firstTime = "09:00",
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  min?: string;
  from?: string;
  to?: string;
  firstTime?: string;
}) {
  const [startDay = "", startTime = ""] = defaultValue.split("T");
  const [day, setDay] = useState(startDay);
  const [time, setTime] = useState(startTime.slice(0, 5));
  return (
    <span className="live-when">
      <input type="hidden" name={name} value={day && time ? `${day}T${time}` : ""} />
      <DateField
        short
        value={day}
        min={min}
        required={required}
        onChange={(next) => {
          setDay(next);
          if (!time) setTime(firstTime);
        }}
      />
      <TimeField value={time} from={from} to={to} required={required} onChange={(event) => setTime(event.target.value)} />
    </span>
  );
}
