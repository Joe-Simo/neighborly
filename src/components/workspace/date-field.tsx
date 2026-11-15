"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import { wrongControl } from "@/components/workspace/failure";
import { DayPicker } from "react-day-picker";
import { es, ht } from "react-day-picker/locale";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useWorkspace } from "@/components/workspace/context";
import { formatDate, type Language } from "@/lib/words";

const calendars = { en: undefined, es, ht };

/** "2026-11-20" and the local day it names, each way. */
const toDay = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const toValue = (day: Date) =>
  `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;

/** A typed day: 2026-11-19, or numbers in the order the language writes them (11/19 in English, 19/11 in Spanish and Creole). */
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
}) {
  const { words } = useWorkspace();
  const sheet = useSyncExternalStore(watchNarrow, () => matchMedia(narrow).matches, () => false);
  const [open, setOpen] = useState(false);
  const [own, setOwn] = useState(defaultValue);
  const [typed, setTyped] = useState<string>();
  const [label, setLabel] = useState("");
  const [beside, setBeside] = useState(false);
  const chosen = value ?? own;
  const allowed = (day: string) => (!min || day >= min) && (!max || day <= max);
  // A needed day left empty: said under the field in our own words, never the browser's bubble.
  const [missing, setMissing] = useState(false);
  const missingId = useId();
  const choose = (day: string) => {
    setMissing(false);
    setOwn(day);
    setTyped(undefined);
    onChange?.(day);
  };
  const said = chosen
    ? formatDate(words.locale, toDay(chosen).getTime(), {
        weekday: "long",
        month: "long",
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
    <DayPicker
      mode="single"
      autoFocus
      locale={calendars[words.locale]}
      selected={chosen ? toDay(chosen) : undefined}
      defaultMonth={chosen ? toDay(chosen) : min ? toDay(min) : undefined}
      disabled={[...(min ? [{ before: toDay(min) }] : []), ...(max ? [{ after: toDay(max) }] : [])]}
      // A day's name starts with the number it shows, then says the rest: "1, Sunday, November 2026".
      labels={{
        labelDayButton: (day) =>
          `${day.getDate()}, ${formatDate(words.locale, day.getTime(), { weekday: "long" })}, ${formatDate(words.locale, day.getTime(), { month: "long", year: "numeric" })}`,
      }}
      onSelect={(day) => {
        if (!day) return;
        choose(toValue(day));
        setOpen(false);
      }}
    />
  );
  return (
    <Popover open={open && !sheet} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <span className="live-date" data-open={open || undefined} data-missing={missing || undefined}>
          <input
            className="live-date-words"
            type="text"
            autoComplete="off"
            disabled={disabled}
            readOnly={sheet}
            aria-haspopup="dialog"
            aria-required={required || undefined}
            aria-invalid={missing || undefined}
            aria-describedby={missing ? missingId : undefined}
            placeholder={words.dateField.choose}
            value={typed ?? said}
            onChange={(event) => setTyped(event.target.value)}
            onBlur={keep}
            ref={(input) => setLabel(input?.labels?.[0]?.querySelector("span")?.textContent ?? "")}
            onClick={() => sheet && setOpen(true)}
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
          <button type="button" className="live-date-open" disabled={disabled} tabIndex={sheet ? -1 : 0} aria-label={words.dateField.choose} onClick={(event) => {
            // The month opens below. A field low on the screen is brought up first; where the page ends
            // and there is still no room, the month opens beside the field, so it never covers what is being read above.
            const field = event.currentTarget.parentElement;
            const room = () => (field ? innerHeight - field.getBoundingClientRect().bottom : 0);
            if (!open && !sheet && field) {
              if (room() < 380) field.scrollIntoView({ block: "center" });
              setBeside(room() < 380);
            }
            setOpen(!open);
          }}>
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
              setMissing(true);
              const hidden = event.currentTarget;
              if (hidden.form?.querySelector(wrongControl) === hidden)
                hidden.parentElement?.querySelector<HTMLInputElement>(".live-date-words")?.focus();
            }}
            onChange={(event) => setOwn(event.target.value)}
            ref={(input) => {
              const form = input?.form;
              if (!form) return;
              const clear = () => setOwn("");
              form.addEventListener("reset", clear);
              return () => form.removeEventListener("reset", clear);
            }}
          />
        </span>
      </PopoverAnchor>
      {missing && (
        <small id={missingId} className="live-date-missing" role="alert">
          {words.dateField.choose}.
        </small>
      )}
      <PopoverContent className="live-date-sheet" aria-label={label || words.dateField.choose} collisionPadding={12} side={beside ? "right" : "bottom"} align={beside ? "end" : "start"}>
        {month}
      </PopoverContent>
      <Dialog open={open && sheet} onOpenChange={setOpen}>
        <DialogContent className="live-date-sheet live-date-bottom" showCloseButton={false}>
          <div className="live-date-bar">
            <DialogTitle>{label || words.dateField.choose}</DialogTitle>
            <DialogClose className="live-date-done">{words.dateField.done}</DialogClose>
          </div>
          {month}
        </DialogContent>
      </Dialog>
    </Popover>
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
  const choices = !own || halfHours.includes(own) ? halfHours : [...halfHours, own].sort();
  return (
    <NativeSelect className="live-time w-full" {...select} {...(value === undefined ? { defaultValue: defaultValue ?? "" } : { value })}>
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
