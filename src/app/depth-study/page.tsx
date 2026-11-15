import { Suspense } from "react";
import type { Metadata } from "next";
import { DepthExperienceCandidate } from "@/components/depth-experience-candidate";

export const metadata: Metadata = { title: "Doorway depth study · Kind Helps", robots: { index: false, follow: false } };

async function Study({ searchParams }: { searchParams: Promise<{ chair?: string }> }) {
  const { chair } = await searchParams;
  return <DepthExperienceCandidate architecture spatialChair={chair === "3d"} />;
}

export default function DepthStudyPage(props: { searchParams: Promise<{ chair?: string }> }) {
  return <Suspense fallback={<DepthExperienceCandidate architecture />}><Study {...props} /></Suspense>;
}
