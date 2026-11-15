import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { areaTitles, liveAreas } from "@/components/workspace/areas";

export async function generateMetadata({ params }: { params: Promise<{ area: string }> }): Promise<Metadata> {
  const { area } = await params;
  const matched = liveAreas.find((candidate) => candidate === area);
  return matched ? { title: `${areaTitles[matched]} · Kind Helps` } : {};
}

export default async function Page({
  params,
}: {
  params: Promise<{ area: string }>;
}) {
  const { area } = await params;
  const matched = liveAreas.find((candidate) => candidate === area);
  if (!matched) notFound();
  // The room itself is drawn by the frame in the layout (LiveFrame), which stays mounted between rooms.
  return null;
}
