import { NextResponse } from "next/server";
import { z } from "zod";
import { LANGUAGE_CODES } from "@/lib/languages";
import { LlmUnavailable } from "@/lib/llm";
import { translate } from "@/lib/translate";

export const maxDuration = 120;

const body = z.object({
  lang: z.enum(LANGUAGE_CODES),
  blocks: z.array(z.string().trim().min(1).max(1200)).min(1).max(12),
  glossary: z
    .array(z.object({ term: z.string().min(1).max(60), note: z.string().max(200).optional(), preferred: z.record(z.string(), z.string().max(80)) }))
    .max(40)
    .default([]),
});

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the announcement: up to 12 blocks of 1,200 characters each." }, { status: 400 });
  const total = parsed.data.blocks.join("").length;
  if (total > 4000) return NextResponse.json({ error: "Keep the announcement under 4,000 characters." }, { status: 400 });
  try {
    return NextResponse.json(await translate(parsed.data.lang, parsed.data.blocks, parsed.data.glossary));
  } catch (e) {
    if (e instanceof LlmUnavailable) {
      const message =
        e.code === "quota"
          ? "The free AI tier is used up or busy right now. Try again later, or load one of the sample announcements to see a recorded example."
          : e.code === "no-key"
            ? "Live AI is off on this server. Load a sample announcement to see a recorded example."
            : `${e.message} Try again, or load a sample announcement to see a recorded example.`;
      return NextResponse.json({ error: message, code: e.code }, { status: 503 });
    }
    return NextResponse.json({ error: "Translation failed." }, { status: 500 });
  }
}
