import { WeekPage, weekMetadata, weekViewport } from "@/components/week-page";

export const viewport = weekViewport;
export const metadata = weekMetadata("en");

/** A made-up week at a made-up conference, in four steps. */
export default function AWeek() {
  return <WeekPage language="en" />;
}
