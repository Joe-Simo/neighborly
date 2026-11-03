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

export type FailReason = "timeout" | "network" | "http" | "refused" | "no-json" | "bad-json" | "shape";

export class LlmUnavailable extends Error {
  constructor(
    public code: "no-key" | "quota" | "error",
    message: string,
    public reason?: FailReason,
  ) {
    super(message);
  }
}

const isTimeout = (e: unknown) => e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");

/**
 * One chat call that always fails with LlmUnavailable, never a raw error. OpenRouter sends response headers
 * early and holds the body open while a free model works, so the timeout must also cover reading the body.
 */
export async function chatJson(
  system: string,
  user: string,
  { maxTokens = 1800, timeoutMs = 45_000, models = LLM_MODELS }: { maxTokens?: number; timeoutMs?: number; models?: string[] } = {},
): Promise<{ json: unknown; model: string }> {
  if (!process.env.OPENROUTER_API_KEY?.trim()) throw new LlmUnavailable("no-key", "No model key on this server.");
  const signal = AbortSignal.timeout(timeoutMs);
  let res: Response;
  let text: string;
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
        model: models[0],
        models: models.slice(0, 3),
        temperature: 0.1,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal,
    });
    text = await res.text();
  } catch (e) {
    if (isTimeout(e)) throw new LlmUnavailable("error", "The AI service did not answer in time.", "timeout");
    throw new LlmUnavailable("error", "Could not reach the AI service.", "network");
  }
  if (!res.ok) {
    if (res.status === 429) {
      if (/per-day|daily|free-models-per-day/i.test(text)) await withStore((l) => l.exhausted(nextUtcMidnight())).catch(() => {});
      throw new LlmUnavailable("quota", "The free AI tier is busy or used up.", "http");
    }
    throw new LlmUnavailable("error", `The AI service returned ${res.status}.`, "http");
  }
  let data: { model?: string; error?: { message?: string }; choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[] };
  try {
    // Keep-alive padding before the JSON is allowed.
    data = JSON.parse(text.trim());
  } catch {
    throw new LlmUnavailable("error", "The AI service sent an unreadable answer.", "bad-json");
  }
  if (data.error) throw new LlmUnavailable("error", "The AI service reported an error.", "http");
  const choice = data.choices?.[0];
  if (choice?.message?.refusal) throw new LlmUnavailable("error", "The model declined the request.", "refused");
  const raw = (choice?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "");
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new LlmUnavailable("error", "The model did not return JSON.", "no-json");
  try {
    return { json: JSON.parse(json), model: data.model ?? models[0] };
  } catch {
    throw new LlmUnavailable("error", "The model returned broken JSON.", "bad-json");
  }
}

/** The same list with the first model moved to the end, for a second try that starts somewhere else. */
export const rotated = (models: string[] = LLM_MODELS) => (models.length > 1 ? [...models.slice(1), models[0]] : models);
