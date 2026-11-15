import { describe, expect, test } from "bun:test";
import { readRequestRows } from "./request-rows";

describe("reading a file of past requests", () => {
  test("takes ServWare's column names as they come and keeps each line as text", () => {
    expect(readRequestRows("First Name,Last Name,Mobile Phone,Request Date,Request Status,Assistance Type,Value,Payee,Request Notes\nGloria,Ibarra,555-555-0101,03/14/2026,Completed,Rent,\"$1,250.00\",Sample Street Apartments,Behind after reduced hours\n")).toEqual({ rows: [
      { line: 2, name: "Gloria Ibarra", phone: "555-555-0101", date: "03/14/2026", status: "Completed", type: "Rent", amount: "$1,250.00", payee: "Sample Street Apartments", notes: "Behind after reduced hours" },
    ] });
  });
  test("says plainly what is missing", () => {
    expect(readRequestRows("Name,Value\nGloria Ibarra,40")).toEqual({ error: expect.stringContaining("Request Date") });
    expect(readRequestRows("Request Date,Value\n03/14/2026,40")).toEqual({ error: expect.stringContaining("Name column") });
    expect(readRequestRows("Name,Request Date\n")).toEqual({ error: expect.stringContaining("no requests") });
  });
});
