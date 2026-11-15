import type { Metadata } from "next";
import { LiveApp } from "@/components/live-app";

export const metadata: Metadata = {
  title: "Your workspace — Kind Helps",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    invite?: string | string[];
    intent?: string | string[];
  }>;
}) {
  const { invite, intent } = await searchParams;
  const entryIntent =
    intent === "start" || intent === "join" || intent === "signin"
      ? intent
      : typeof invite === "string" && invite
        ? "join"
        : "signin";
  const token = typeof invite === "string" ? invite : undefined;
  return (
    <LiveApp
      key={`${entryIntent}:${token ?? ""}`}
      invitationToken={token}
      intent={entryIntent}
    />
  );
}
