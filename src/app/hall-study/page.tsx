import type { Metadata } from "next";
import { HallInteriorStudy } from "@/components/hall-interior-study";
export const metadata: Metadata = { title: "Hall interior study · Neighborly", robots: { index: false, follow: false } };
export default function Page() { return <HallInteriorStudy />; }
