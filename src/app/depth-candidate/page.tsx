import type { Metadata } from "next";
import { DepthExperienceCandidate } from "@/components/depth-experience-candidate";

export const metadata: Metadata = { title: "Spatial experience candidate — Neighborly", robots: { index: false, follow: false } };
export default function DepthCandidatePage() { return <DepthExperienceCandidate />; }
