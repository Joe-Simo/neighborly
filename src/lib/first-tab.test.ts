import { describe, expect, test } from "bun:test";
import { authWords } from "@/components/live-auth-words";
import { areaTitles, areaTitlesEs, liveAreas } from "@/components/workspace/areas";
import { firstTab, tabs } from "@/lib/first-tab";
import { words } from "@/lib/words";

describe("the tab the head names", () => {
  test("the rooms' Spanish tabs are the menu's words", () => {
    for (const area of liveAreas) {
      expect(areaTitlesEs[area]).toBe(words("es").menu[area]);
      expect(areaTitles[area]).toBe(words("en").menu[area]);
    }
  });

  test("the workspace's tab is the sheet's own", () => {
    expect(tabs["/app"]).toEqual([authWords.en.workspaceTab, authWords.es.workspaceTab]);
  });

  const run = (lang: string, pathname: string) => {
    const document = { documentElement: { lang }, title: "" };
    new Function("document", "location", firstTab)(document, { pathname });
    return document.title;
  };

  test("in the reader's language, from the address", () => {
    expect(run("es", "/app/help-line")).toBe("Línea de ayuda · Kind Helps");
    expect(run("en", "/app/help-line")).toBe("Help line · Kind Helps");
    expect(run("es", "/app")).toBe("Tu espacio · Kind Helps");
    expect(run("es", "/app/")).toBe("Tu espacio · Kind Helps");
    expect(run("es", "/offline")).toBe("Sin conexión · Kind Helps");
    expect(run("en", "/offline")).toBe("No connection · Kind Helps");
  });

  test("a page that names its own tab is left alone", () => {
    expect(run("es", "/help")).toBe("");
    expect(run("es", "/privacidad")).toBe("");
  });
});
