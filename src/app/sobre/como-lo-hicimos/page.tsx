import { MadePage, madeMetadata, madeViewport } from "@/components/made-page";

export const viewport = madeViewport;
export const metadata = madeMetadata("es");

/** How Kind Helps was made, in Spanish, at its own address. */
export default function ComoLoHicimos() {
  return <MadePage language="es" />;
}
