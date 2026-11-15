import { describe, expect, test } from "bun:test";
import {
  clearEntryContext,
  entryDestination,
  restoreEntryContext,
  saveEntryContext,
} from "./live-entry";

function memoryStore() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
const now = 1_800_000_000_000;
const token = "a".repeat(64);

describe("entry continuity across email validation", () => {
  test("a new tab restores the latest nonexpired shared intent and invitation", () => {
    const local = memoryStore();
    saveEntryContext(
      { intent: "join", invitationToken: token },
      { session: memoryStore(), local },
      now,
    );
    const restored = restoreEntryContext(
      { session: memoryStore(), local },
      now + 5000,
    );
    expect(restored).toEqual({ intent: "join", invitationToken: token });
    expect(entryDestination(restored)).toBe("/app?intent=join&invite=" + token);
    expect(
      Object.keys(JSON.parse(local.getItem("neighborly.entry")!)).sort(),
    ).toEqual(["expiresAt", "intent", "invitationToken"]);
  });
  test("an exact same-tab flow takes priority over another tab's newer flow", () => {
    const session = memoryStore(),
      local = memoryStore();
    saveEntryContext(
      { intent: "join", invitationToken: token },
      { session, local },
      now,
    );
    saveEntryContext(
      { intent: "start", invitationToken: "" },
      { session: memoryStore(), local },
      now + 100,
    );
    expect(restoreEntryContext({ session, local }, now + 500)).toEqual({
      intent: "join",
      invitationToken: token,
    });
  });
  test("expired and malformed data is ignored and removed", () => {
    const local = memoryStore();
    saveEntryContext({ intent: "start", invitationToken: "" }, { local }, now);
    expect(restoreEntryContext({ local }, now + 3_600_000)).toBeNull();
    expect(local.getItem("neighborly.entry")).toBeNull();
    for (const value of [
      "not json",
      '{"intent":"https://elsewhere","invitationToken":"","expiresAt":1800000010000}',
      '{"intent":"join","invitationToken":"bad-token","expiresAt":1800000010000}',
    ]) {
      local.setItem("neighborly.entry", value);
      expect(restoreEntryContext({ local }, now)).toBeNull();
    }
  });
  test("denied storage does not block the fallback, and completed flows clear both stores", () => {
    const denied = {
      getItem(): string | null {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("denied");
      },
      removeItem() {
        throw new Error("denied");
      },
    };
    const local = memoryStore();
    saveEntryContext(
      { intent: "start", invitationToken: "" },
      { session: denied, local },
      now,
    );
    expect(
      restoreEntryContext({ session: denied, local }, now + 1)?.intent,
    ).toBe("start");
    clearEntryContext({ session: denied, local });
    expect(restoreEntryContext({ local }, now + 2)).toBeNull();
    expect(entryDestination(null)).toBe("/app");
  });
});
