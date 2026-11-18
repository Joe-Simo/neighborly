import { WeekPage, weekMetadata, weekViewport } from "@/components/week-page";

export const viewport = weekViewport;
export const metadata = weekMetadata("es");

/** The made-up week, in Spanish, at its own address. */
export default function UnaSemana() {
  return <WeekPage language="es" />;
}
