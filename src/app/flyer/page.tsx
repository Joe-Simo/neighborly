import type { Metadata } from "next";
import { Suspense } from "react";
import { ClientOnly } from "@/components/client-only";
import { FlyerView } from "@/components/flyer-view";

export const metadata: Metadata = { title: "Printable flyer · Neighborly", robots: { index: false } };

export default function FlyerPage() {
  return (
    <ClientOnly fallback={<div className="mx-auto mt-10 h-[80vh] max-w-3xl rounded-2xl shimmer" aria-label="Loading the flyer" />}>
      <Suspense>
        <FlyerView />
      </Suspense>
    </ClientOnly>
  );
}
