import { describe, expect, test } from "bun:test";
import { TYPED_KEY, typedFor } from "@/lib/kept-typing";

const shelf = () => {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
};

describe("kept typing", () => {
  test("is kept for the same member and conference, and gone once the form is emptied", () => {
    const tab = shelf();
    typedFor(tab, "ana:stx").set("call", { note: "Power bill" });
    expect(typedFor(tab, "ana:stx").get("call")).toEqual({ note: "Power bill" });
    typedFor(tab, "ana:stx").set("call", {});
    expect(tab.items.has(TYPED_KEY)).toBe(false);
  });

  test("is let go when another member, or the same member in another conference, opens the tab", () => {
    const tab = shelf();
    typedFor(tab, "ana:stx").set("call", { note: "Power bill" });
    expect(typedFor(tab, "ben:stx").get("call")).toBeUndefined();
    expect(tab.items.has(TYPED_KEY)).toBe(false);
    typedFor(tab, "ana:stx").set("call", { note: "Power bill" });
    expect(typedFor(tab, "ana:sty").get("call")).toBeUndefined();
    expect(typedFor(tab, "ana:stx").get("call")).toBeUndefined();
  });
});
