import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { WorkspaceProvider, type Workspace } from "./context";
import { DateField } from "./date-field";
import { words } from "@/lib/words";

beforeAll(() => GlobalRegistrator.register());
afterAll(() => {
  cleanup();
  GlobalRegistrator.unregister();
});

// The field reads the person's words, and the conference's zone and the moment, for its today.
const workspace = { words: words("en"), data: { church: { timeZone: "America/Chicago" } }, now: Date.now() } as unknown as Workspace;
const frames = () => act(() => new Promise((done) => setTimeout(done, 60)));

describe("the date field on a desktop", () => {
  test("a click in the words opens the month and leaves the caret there to type; Escape puts it away", async () => {
    const seen = render(<WorkspaceProvider value={workspace}><DateField name="day" /></WorkspaceProvider>);
    const words = seen.container.querySelector<HTMLInputElement>(".live-date-words")!;
    words.focus();
    fireEvent.click(words);
    await frames();
    expect(seen.container.querySelector(".live-date-inline")).not.toBeNull();
    expect(document.activeElement).toBe(words);
    fireEvent.change(words, { target: { value: "Nov 21" } });
    expect(words.value).toBe("Nov 21");
    // A second click while it is open keeps it open.
    fireEvent.click(words);
    expect(seen.container.querySelector(".live-date-inline")).not.toBeNull();
    fireEvent.keyDown(words, { key: "Escape" });
    await frames();
    expect(seen.container.querySelector(".live-date-inline")).toBeNull();
    seen.unmount();
  });

  test("ArrowDown still opens the month on its day", async () => {
    const seen = render(<WorkspaceProvider value={workspace}><DateField name="day" /></WorkspaceProvider>);
    const words = seen.container.querySelector<HTMLInputElement>(".live-date-words")!;
    words.focus();
    fireEvent.keyDown(words, { key: "ArrowDown" });
    await frames();
    expect(seen.container.querySelector(".live-date-inline")).not.toBeNull();
    seen.unmount();
  });
});
