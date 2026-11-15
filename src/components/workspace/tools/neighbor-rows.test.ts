import { describe, expect, test } from "bun:test";
import { readNeighborRows } from "./neighbor-rows";

describe("reading a neighbors spreadsheet", () => {
  test("takes the columns it knows, under the names other systems give them, and ignores the rest", () => {
    expect(readNeighborRows('Client Name,Telephone,Street Address,Kids,Case Number,Comments\r\n"Almonte, Alma",(555) 0100,"12 Sample St, Apt 3",3,A-17,Prefers a call after 5.\r\n\r\nBenito Castellanos,,,,,\r\n')).toEqual({ rows: [
      { line: 2, name: "Almonte, Alma", phone: "(555) 0100", email: "", address: "12 Sample St, Apt 3", adults: "", children: "3", language: "", notes: "Prefers a call after 5." },
      { line: 4, name: "Benito Castellanos", phone: "", email: "", address: "", adults: "", children: "", language: "", notes: "" },
    ] });
  });
  test("joins first and last names, and says plainly when there is no name column or nobody in the file", () => {
    expect(readNeighborRows("First,Last,Language\nFabrice,Greenhalgh,Creole")).toMatchObject({ rows: [{ line: 2, name: "Fabrice Greenhalgh", language: "Creole" }] });
    expect(readNeighborRows("Phone,Address\n(555) 0100,12 Sample St")).toEqual({ error: expect.stringContaining("Name column") });
    expect(readNeighborRows("Name,Phone\n")).toEqual({ error: expect.stringContaining("nobody") });
  });
});
