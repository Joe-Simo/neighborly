import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatJson, LLM_MODELS, LlmUnavailable, rotated } from "@/lib/llm";
import { translate } from "@/lib/translate";

const ok = (content: string, model = "m") => new Response(JSON.stringify({ model, choices: [{ message: { content } }] }), { status: 200 });

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "test-key";
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  process.env.OPENROUTER_API_KEY = "";
  vi.restoreAllMocks();
});

describe("chatJson", () => {
  it("turns a timeout while reading the body into LlmUnavailable", async () => {
    const res = new Response("x", { status: 200 });
    vi.spyOn(res, "text").mockRejectedValue(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(res);
    const e = await chatJson("s", "u").catch((x) => x);
    expect(e).toBeInstanceOf(LlmUnavailable);
    expect(e.reason).toBe("timeout");
  });

  it("accepts keep-alive padding before the JSON", async () => {
    const body = "\n\n   " + JSON.stringify({ model: "m", choices: [{ message: { content: '{"blocks":["a"]}' } }] });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body, { status: 200 }));
    expect((await chatJson("s", "u")).json).toEqual({ blocks: ["a"] });
  });

  it("rotates the model order for the second try", () => {
    expect(rotated(["a", "b", "c"])).toEqual(["b", "c", "a"]);
    expect(rotated(LLM_MODELS)[0]).toBe(LLM_MODELS[1]);
  });
});

describe("translate retry", () => {
  it("retries a timed-out step once on a different first model and stays live", async () => {
    const firstModels: string[] = [];
    let n = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      firstModels.push(JSON.parse(String(init?.body)).models[0]);
      if (n++ === 0) throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
      return ok('{"blocks":["Bonjou"]}');
    });
    const r = await translate("ht", ["Hello retry test"], []);
    expect(r.origin).toBe("live");
    expect(firstModels.slice(0, 2)).toEqual([LLM_MODELS[0], LLM_MODELS[1]]);
  });
});
