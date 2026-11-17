import { expect, test } from "bun:test";
import { fill } from "./fill";

test("a sentence's named places are filled, and one given no value is left as written", () => {
  expect(fill("Saved on {name}’s record, {count} waiting.", { name: "Rosa Fontaine", count: 2 })).toBe("Saved on Rosa Fontaine’s record, 2 waiting.");
  expect(fill("Guardado en el registro de {name}.", {})).toBe("Guardado en el registro de {name}.");
});
