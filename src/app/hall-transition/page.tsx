import type { Metadata } from "next";
import { HallTransitionStudy } from "@/components/hall-transition-study";

export const metadata: Metadata = { title: "Hall transition study · Neighborly", robots: { index: false, follow: false } };
export default function HallTransitionPage() { return <HallTransitionStudy />; }
