import { describe, expect, test } from "bun:test";
import { prepareRequestDraft, withoutIdentity } from "./request-draft";

const rosa = "I’m behind on November rent. The landlord says four hundred fifty by Friday.";

describe("a call note becomes a proposed request", () => {
  test("copies the kind, amount and who is paid when the note states them", () => {
    const draft = prepareRequestDraft(rosa);
    expect(draft.kind).toBe("rent");
    expect(draft.amountRequested).toBe(45000);
    expect(draft.payeeKind).toBe("landlord");
    expect(draft.quote).toBe("The landlord says four hundred fifty by Friday.");
  });

  test("reads written money in whole cents and names a utility written by its initials", () => {
    const draft = prepareRequestDraft("Power shut-off notice for the 21st. She owes FPL $1,187.42.");
    expect(draft.kind).toBe("utility");
    expect(draft.amountRequested).toBe(118742);
    expect(draft.payeeKind).toBe("utility");
    expect(draft.payeeName).toBe("FPL");
  });

  test("copies a payee's name only from a plain statement", () => {
    expect(prepareRequestDraft("Rent is late, 600 dollars. The landlord is Sample Property Co.").payeeName).toBe("Sample Property Co");
    expect(prepareRequestDraft("Rent is late, 600 dollars. She thinks the landlord might be Sample Property Co.").payeeName).toBe("");
  });

  test("a count of people is not money", () => {
    const draft = prepareRequestDraft("Asked about food for a family of five. No name given.");
    expect(draft.kind).toBe("food");
    expect(draft.amountRequested).toBeNull();
  });

  test("questions, negations and conditions state nothing", () => {
    const draft = prepareRequestDraft("Could we help with $300 of rent? She does not need food.");
    expect(draft.kind).toBeNull();
    expect(draft.amountRequested).toBeNull();
    expect(draft.notes.join(" ")).toContain("left out");
  });

  test("two kinds or two amounts are left for the person", () => {
    const draft = prepareRequestDraft("Behind on rent, $450. The electric bill is $120.");
    expect(draft.kind).toBeNull();
    expect(draft.amountRequested).toBeNull();
    expect(draft.notes.join(" ")).toContain("more than one kind");
  });

  test("never proposes paying the neighbor", () => {
    const draft = prepareRequestDraft("She asked for $200 cash for rent, paid to her.");
    expect(draft.payeeKind).toBeNull();
    expect(draft.notes.join(" ")).toContain("never to the neighbor");
  });
});

describe("what the model may see", () => {
  const known = { names: ["Rosa Delgado"], addresses: ["14 Sample St, Apt 2"] };

  test("known names and addresses go, in any letter case", () => {
    const sent = withoutIdentity("rosa delgado at 14 sample st, apt 2 is behind on rent. ROSA owes $450.", known);
    expect(sent).not.toMatch(/rosa|delgado|sample/i);
    expect(sent).toContain("$450");
    expect(sent).toContain("rent");
  });

  test("phones, emails, other addresses and birth dates go", () => {
    const sent = withoutIdentity("Call (239) 555-0142 or 239.555.0178, rosa@example.org. Moved to 8 Example Ave. Born 03/14/1961. Owes $1,187.42.", known);
    expect(sent).not.toMatch(/555|example|1961/i);
    expect(sent).toContain("[phone]");
    expect(sent).toContain("[address]");
    expect(sent).toContain("$1,187.42");
  });

  test("names nobody told us about go too", () => {
    const sent = withoutIdentity("Her mother Lucia Marquez lives with her. Mrs. Okafor called. This is earl jennings. Landlord is Sample Property Co. Tomas Rivera will be home Friday.", known);
    expect(sent).not.toMatch(/lucia|marquez|okafor|earl|jennings|property|tomas|rivera/i);
    expect(sent).toContain("Friday");
  });

  test("what the check needs stays", () => {
    expect(withoutIdentity(rosa, known)).toBe(rosa);
  });
});
