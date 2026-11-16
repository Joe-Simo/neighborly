"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { askSampleTicket, warmSignIn } from "@/lib/sample-ticket";

/** The link into the sample conference. Pointing at it fetches sign-in; pressing it asks for the ticket. */
export function SampleLink(props: Omit<ComponentProps<typeof Link>, "href">) {
  return <Link
    {...props}
    href="/app?intent=sample"
    onPointerEnter={warmSignIn}
    onFocus={warmSignIn}
    onPointerDown={(event) => { if (event.button === 0) { warmSignIn(); askSampleTicket(); } }}
    onClick={(event) => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) askSampleTicket(); }}
  />;
}
