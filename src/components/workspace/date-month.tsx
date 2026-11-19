import { DayPicker, type PropsBase, type PropsSingle } from "react-day-picker";
import { es } from "react-day-picker/locale";
import type { Language } from "@/lib/words";

const calendars = { en: undefined, es };

/** The month a date field opens: the calendar library, kept out of every room's first load (date-field.tsx). */
export function DateMonth({ language, ...month }: Omit<PropsBase, "locale"> & PropsSingle & { language: Language }) {
  return <DayPicker {...month} locale={calendars[language]} />;
}
