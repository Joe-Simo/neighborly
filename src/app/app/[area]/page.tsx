import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import { headings } from "@/components/workspace/navigation";
import { reliefSources } from "@/components/workspace/relief";
import { SIZES } from "@/components/workspace/relief-ahead";
import { areaTitles, liveAreas } from "@/components/workspace/areas";
import { linkCardIn, linkPreview } from "@/lib/link-preview";

/** Every room is known ahead of time, so its page is built once and never waits on a function. */
export function generateStaticParams() {
  return liveAreas.map((area) => ({ area }));
}

export async function generateMetadata({ params }: { params: Promise<{ area: string }> }): Promise<Metadata> {
  const { area } = await params;
  const matched = liveAreas.find((candidate) => candidate === area);
  if (!matched) return {};
  // The room's own deck is its description; signed in, the tab then follows the person's language (shell.tsx).
  const title = `${areaTitles[matched]} · Kind Helps`, description = headings[matched].deck;
  return { title, description, openGraph: { ...linkPreview, url: `/app/${matched}`, title, description }, twitter: { ...linkCardIn("en"), title, description } };
}

export default async function Page({
  params,
}: {
  params: Promise<{ area: string }>;
}) {
  const { area } = await params;
  const matched = liveAreas.find((candidate) => candidate === area);
  if (!matched) notFound();
  // The room is shown only once its head picture can be painted, and the room is drawn only after the app's scripts
  // have run: so the picture is asked for with the page itself, in the cut a page's own load always lays (the flat one).
  const picture = headings[matched].art.picture;
  preload(`/assets/relief/relief-${picture}-1536.avif`, { as: "image", type: "image/avif", imageSrcSet: reliefSources(picture, "avif"), imageSizes: SIZES, fetchPriority: "high" });
  // The room itself is drawn by the frame in the layout (LiveFrame), which stays mounted between rooms.
  return null;
}
