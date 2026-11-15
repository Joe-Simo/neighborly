import type { Metadata } from "next";
import { ChairDepthStudy } from "@/components/chair-depth-study";
export const metadata: Metadata = { title: "Chair depth study · Kind Helps", robots: { index: false, follow: false } };
export default function Page() { return <ChairDepthStudy />; }
