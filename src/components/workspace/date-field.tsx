"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { es, ht } from "react-day-picker/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspace } from "@/components/workspace/context";
import { formatDate } from "@/lib/words";

const calendars = { en: undefined, es, ht };

/** "2026-11-20" and the local day it names, each way. */
const toDay = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const toValue = (day: Date) =>
  `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;

/**
 * The one date field of every room. It takes and gives the same "YYYY-MM-DD"
 * a date input does, so it drops into any form: give `name` and read FormData,
 * or give `value` and `onChange`. Put it inside a LiveField for its label.
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
  const [open, setOpen] = useState(false);
  const [own, setOwn] = useState(defaultValue);
  const chosen = value ?? own;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <span className="live-date">
        <PopoverTrigger type="button" className="live-date-trigger" disabled={disabled} data-empty={!chosen || undefined}>
          <span>
            {chosen
              ? formatDate(words.locale, toDay(chosen).getTime(), { weekday: "short", month: "short", day: "numeric", year: "numeric" })
              : words.dateField.choose}
          </span>
          <CalendarDays aria-hidden="true" />
        </PopoverTrigger>
        {/* What the form reads and checks. A form's reset empties it, and the field with it. */}
        <input
          className="live-date-value"
          name={name}
          value={chosen}
          required={required}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => setOwn(event.target.value)}
          onFocus={(event) => event.target.previousElementSibling instanceof HTMLElement && event.target.previousElementSibling.focus()}
          ref={(input) => {
            const form = input?.form;
            if (!form) return;
            const clear = () => setOwn("");
            form.addEventListener("reset", clear);
            return () => form.removeEventListener("reset", clear);
          }}
        />
      </span>
      <PopoverContent className="live-date-sheet" collisionPadding={12}>
        <DayPicker
          mode="single"
          autoFocus
          locale={calendars[words.locale]}
          selected={chosen ? toDay(chosen) : undefined}
          defaultMonth={chosen ? toDay(chosen) : min ? toDay(min) : undefined}
          disabled={[...(min ? [{ before: toDay(min) }] : []), ...(max ? [{ after: toDay(max) }] : [])]}
          onSelect={(day) => {
            if (!day) return;
            setOwn(toValue(day));
            onChange?.(toValue(day));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
