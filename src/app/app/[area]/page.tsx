import { notFound } from "next/navigation";
import { LiveApp } from "@/components/live-app";
import { liveAreas } from "@/components/workspace/areas";

export default async function Page({
  params,
}: {
  params: Promise<{ area: string }>;
}) {
  const { area } = await params;
  const matched = liveAreas.find((candidate) => candidate === area);
  if (!matched) notFound();
  return <LiveApp area={matched} />;
}
