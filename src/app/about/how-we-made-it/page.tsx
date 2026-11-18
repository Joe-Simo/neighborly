import { MadePage, madeMetadata, madeViewport } from "@/components/made-page";

export const viewport = madeViewport;
export const metadata = madeMetadata("en");

export default function HowWeMadeIt() {
  return <MadePage language="en" />;
}
