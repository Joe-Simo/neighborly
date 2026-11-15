import { describe, expect, test } from "bun:test";
import { readPayeeRows } from "./payee-rows";

describe("reading a list of payees", () => {
  test("takes a vendor list under the names other systems give its columns", () => {
    expect(readPayeeRows("Vendor Name,Type,Contact Address,City,State,Zip,Phone,Notes\nSample Street Apartments,Landlord,10 Sample St,Sampleton,FL,00000,(100) 555-0150,Ask for the office\n\nDemo Power & Light,Utility,,,,,,\n")).toEqual({ rows: [
      { line: 2, name: "Sample Street Apartments", type: "Landlord", address: "10 Sample St, Sampleton, FL 00000", phone: "(100) 555-0150", email: "", notes: "Ask for the office" },
      { line: 4, name: "Demo Power & Light", type: "Utility", address: "", phone: "", email: "", notes: "" },
    ] });
  });
  test("says plainly when there is no name column or nothing in the file", () => {
    expect(readPayeeRows("Type,Phone\nUtility,(100) 555-0150")).toEqual({ error: expect.stringContaining("Name column") });
    expect(readPayeeRows("Name,Type\n")).toEqual({ error: expect.stringContaining("no payees") });
  });
});
