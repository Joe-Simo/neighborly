import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { forgetThisBrowser } from "./forget-browser";

beforeAll(() => GlobalRegistrator.register());
afterAll(() => GlobalRegistrator.unregister());

test("sign-out leaves nothing of a conference, a person or a note; the language and Clerk's keys stay", () => {
  for (const key of ["kindhelps.church", "week-note-put-away", "week-note-last", "kind-helps:language", "__clerk_environment"]) window.localStorage.setItem(key, "x");
  for (const key of ["kh-card-for", "kind-helps-arrived", "report-pile-laid", "kind-helps:left"]) window.sessionStorage.setItem(key, "x");
  forgetThisBrowser();
  expect(Object.keys(window.localStorage).sort()).toEqual(["__clerk_environment", "kind-helps:language"]);
  expect(Object.keys(window.sessionStorage)).toEqual(["kind-helps:left"]);
});
