import { expect, test } from "bun:test";
import { privacyWords } from "./privacy-words";
import { accessibilityWords } from "./accessibility-words";

/** A paragraph is "p"; a list is its number of items. */
const shape = (language: keyof typeof privacyWords) =>
  privacyWords[language].sections.map(({ blocks }) => blocks.map((block) => (typeof block === "string" ? "p" : block.length)));

test("the Spanish privacy page has the English page's sections, paragraph for paragraph and item for item", () => {
  expect(shape("es")).toEqual(shape("en"));
});

test("the Spanish accessibility page has the English page's sections, paragraph for paragraph and item for item", () => {
  const of = (language: "en" | "es") => accessibilityWords[language].sections.map(({ blocks }) => blocks.map((block) => (typeof block === "string" ? "p" : block.length)));
  expect(of("es")).toEqual(of("en"));
});
