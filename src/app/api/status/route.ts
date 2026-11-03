import { NextResponse } from "next/server";
import { llmStatus } from "@/lib/llm";

export const dynamic = "force-dynamic";

export function GET() {
  const s = llmStatus();
  return NextResponse.json({ live: s.enabled && !s.resting, enabled: s.enabled, resting: s.resting, callsToday: s.callsToday, cap: s.cap, models: s.models });
}
