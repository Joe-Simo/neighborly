import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { ConvexError } from "convex/values";
import { use } from "react";
import { AskedTooSoon, NoteTrusted } from "./asked-too-soon";

beforeAll(() => GlobalRegistrator.register());
afterAll(async () => {
  cleanup();
  await GlobalRegistrator.unregister();
});

test("rooms asked for on a note whose row is gone start over in the first-visit order, with no error shown", () => {
  function Room() {
    if (use(NoteTrusted)) throw new ConvexError("Sign in required.");
    return "waiting";
  }
  const { container } = render(<AskedTooSoon><Room /></AskedTooSoon>);
  expect(container.textContent).toBe("waiting");
});

test("a failure that is not the note's doing still reaches the error page", () => {
  function Room(): never {
    throw new ConvexError("Workspace access required.");
  }
  expect(() => render(<AskedTooSoon><Room /></AskedTooSoon>)).toThrow("Workspace access required.");
});
