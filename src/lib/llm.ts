import "server-only";
import { withStore } from "./store";

/**
 * Free open models on OpenRouter. The free tier allows about 50 requests a day for the whole account,
 * so the server caps its own calls in a shared store (callers reserve with reserveCalls first), caches by hash,
 * and falls back to labelled recorded examples.
 */
export const LLM_MODELS = (process.env.NEIGHBORLY_LLM_MODELS ?? "google/gemma-4-31b-it:free,nvidia/nemotron-3-ultra-550b-a55b:free,google/gemma-4-26b-a4b-it:free")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export { DAILY_CAP } from "./store";

const nextUtcMidnight = () => {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
};

/** Live AI state, read from the shared store so every server instance reports the same count. */
export async function llmStatus() {
  const enabled = !!process.env.OPENROUTER_API_KEY?.trim();
  const { value, mode } = await withStore((l) => l.usage());
  return { enabled, resting: value.resting, callsToday: value.calls, cap: value.cap, models: LLM_MODELS, store: mode };
}

/** Claim n calls against the shared daily cap before making them. */
export async function reserveCalls(n: number) {
  if (!process.env.OPENROUTER_API_KEY?.trim()) throw new LlmUnavailable("no-key", "No model key on this server.");
  const { value } = await withStore((l) => l.reserve(n));
  if (!value.ok) throw new LlmUnavailable("quota", "The free AI tier is used up for today.");
}

/** House style: no em or en dashes in anything we show. */
export function tidy(s: string) {
  return s.replace(/\s*\u2014\s*/g, ", ").replace(/\s*\u2013\s*/g, " to ").replace(/[\u2010-\u2012]/g, "-").trim();
}

export class LlmUnavailable extends Error {
  constructor(public code: "no-key" | "quota" | "error", message: string) {
    super(message);
  }
}

export async function chatJson(system: string, user: string, maxTokens = 1800, timeoutMs = 55_000): Promise<{ json: unknown; model: string }> {
  if (!process.env.OPENROUTER_API_KEY?.trim()) throw new LlmUnavailable("no-key", "No model key on this server.");
  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/Joe-Simo/neighborly",
        "X-Title": "Neighborly",
      },
      body: JSON.stringify({
        model: LLM_MODELS[0],
        models: LLM_MODELS.slice(0, 3),
        temperature: 0.1,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new LlmUnavailable("error", "The AI service did not answer in time.");
  }
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 429) {
      if (/per-day|daily|free-models-per-day/i.test(text)) await withStore((l) => l.exhausted(nextUtcMidnight())).catch(() => {});
      throw new LlmUnavailable("quota", "The free AI tier is busy or used up.");
    }
    throw new LlmUnavailable("error", `The AI service returned ${res.status}.`);
  }
  let data: { model?: string; error?: { message?: string }; choices?: { message?: { content?: string | null } }[] };
  try {
    data = JSON.parse(text);
  } catch {
    throw new LlmUnavailable("error", "The AI service sent an unreadable answer.");
  }
  if (data.error) throw new LlmUnavailable("error", "The AI service reported an error.");
  const raw = (data.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "");
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new LlmUnavailable("error", "The model did not return JSON.");
  try {
    return { json: JSON.parse(json), model: data.model ?? LLM_MODELS[0] };
  } catch {
    throw new LlmUnavailable("error", "The model returned broken JSON.");
  }
}
