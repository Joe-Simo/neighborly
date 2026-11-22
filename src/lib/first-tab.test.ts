import { describe, expect, test } from "bun:test";
import { authWords, giveTabBack } from "@/components/live-auth-words";
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

describe("a sheet giving the tab back as it leaves", () => {
  const at = (pathname: string, title: string, lang = "es") => {
    const page = { title, documentElement: { lang } };
    Object.assign(globalThis, { document: page, window: { location: { pathname } } });
    return page;
  };

  test("puts back what it found, in the page's language, while it still names the tab in the app", () => {
    const page = at("/app/help-line", "Iniciar sesión · Kind Helps");
    giveTabBack("Help line · Kind Helps", "Iniciar sesión · Kind Helps");
    expect(page.title).toBe("Línea de ayuda · Kind Helps");
  });

  test("leaves a tab another page or room has named since", () => {
    const home = at("/", "Kind Helps · Help line, visits and books for a conference");
    giveTabBack("Línea de ayuda · Kind Helps", "Kind Helps · Help line, visits and books for a conference");
    expect(home.title).toBe("Kind Helps · Help line, visits and books for a conference");
    const room = at("/app/help-line", "Línea de ayuda · Muestra · Kind Helps");
    giveTabBack("Help line · Kind Helps", "Iniciar sesión · Kind Helps");
    expect(room.title).toBe("Línea de ayuda · Muestra · Kind Helps");
  });
});
