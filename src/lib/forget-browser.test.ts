import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { forgetThisBrowser, forgetWhoWasHere } from "./forget-browser";

beforeAll(() => GlobalRegistrator.register());
afterAll(() => GlobalRegistrator.unregister());

test("sign-out leaves nothing of a conference, a person or a note; the language and Clerk's keys stay", () => {
  for (const key of ["kindhelps.church", "week-note-put-away", "week-note-last", "kind-helps-entered", "kind-helps:language", "__clerk_environment"]) window.localStorage.setItem(key, "x");
  for (const key of ["kh-card-for", "kind-helps-arrived", "report-pile-laid", "kind-helps:left"]) window.sessionStorage.setItem(key, "x");
  forgetThisBrowser();
  expect(Object.keys(window.localStorage).sort()).toEqual(["__clerk_environment", "kind-helps:language"]);
  expect(Object.keys(window.sessionStorage)).toEqual(["kind-helps:left"]);
});

test("a session that ended by itself is cleared too, and a visitor who never signed in keeps the name on their card", () => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.sessionStorage.setItem("kh-card-for", "Ana");
  forgetWhoWasHere();
  expect(window.sessionStorage.getItem("kh-card-for")).toBe("Ana");
  window.localStorage.setItem("kindhelps.church", "x");
  window.localStorage.setItem("kind-helps:language", "es");
  forgetWhoWasHere();
  expect(Object.keys(window.localStorage)).toEqual(["kind-helps:language"]);
  expect(window.sessionStorage.getItem("kh-card-for")).toBeNull();
});
