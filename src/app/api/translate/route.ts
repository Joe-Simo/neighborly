import { NextResponse } from "next/server";
import { z } from "zod";
import { LANGUAGE_CODES } from "@/lib/languages";
import { LlmUnavailable } from "@/lib/llm";
import { quotesScripture } from "@/lib/scripture-ref";
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
  if (parsed.data.blocks.some(quotesScripture)) {
    return NextResponse.json(
      { error: "A paragraph quotes a Bible verse. Keep only the reference (for example Hebrews 13:2). Neighborly adds verse text from a public-domain Bible; the AI never translates or writes it." },
      { status: 400 },
    );
  }
  const { lang, blocks, glossary } = parsed.data;

  // Newline-delimited JSON, so the page can show which step is running during a slow free-tier call.
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: object) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      send({ phase: "queued" });
      try {
        const result = await translate(lang, blocks, glossary, (phase) => send({ phase }));
        send({ result });
      } catch (e) {
        send(errorBody(e));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}

function errorBody(e: unknown) {
  if (e instanceof LlmUnavailable) {
    const error =
      e.code === "quota"
        ? "The free AI tier is used up or busy right now. Try again later, or load one of the sample announcements to see a recorded example."
        : e.code === "no-key"
          ? "Live AI is off on this server. Load a sample announcement to see a recorded example."
          : `${e.message} Try again, or load a sample announcement to see a recorded example.`;
    return { error, code: e.code };
  }
  return { error: "Translation failed." };
}
