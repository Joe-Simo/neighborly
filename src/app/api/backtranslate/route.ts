import { NextResponse } from "next/server";
import { z } from "zod";
import { LANGUAGE_CODES } from "@/lib/languages";
import { LlmUnavailable } from "@/lib/llm";
import { backTranslate } from "@/lib/translate";

export const maxDuration = 60;

const body = z.object({ lang: z.enum(LANGUAGE_CODES), blocks: z.array(z.string().trim().min(1).max(1500)).min(1).max(12) });

/** Re-run the English back-translation after a reviewer edits a block. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nothing to check." }, { status: 400 });
  try {
    const r = await backTranslate(parsed.data.lang, parsed.data.blocks);
    return NextResponse.json({ ...r, generatedAt: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof LlmUnavailable ? e.message : "Back-translation failed.";
    return NextResponse.json({ error: `${msg} The reviewer can still approve after reading the edit carefully.` }, { status: 503 });
  }
}
