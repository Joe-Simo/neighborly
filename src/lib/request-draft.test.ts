import { describe, expect, test } from "bun:test";
import { draftNotes, prepareRequestDraft, withoutIdentity } from "./request-draft";

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

  test("reads who is paid from the payee's own name, and nothing from a name that does not say", () => {
    expect(prepareRequestDraft("Water bill is $72 and due on the 28th. Paid to County Water Authority.")).toMatchObject({ kind: "utility", amountRequested: 7200, payeeKind: "utility", payeeName: "County Water Authority", notes: [] });
    expect(prepareRequestDraft("Car repair, $380, paid to Sample Auto Shop.")).toMatchObject({ payeeKind: "vendor", payeeName: "Sample Auto Shop" });
    expect(prepareRequestDraft("Power bill, $140 to Sample Power Company, the utility company.")).toMatchObject({ kind: "utility", amountRequested: 14000, payeeKind: "utility", payeeName: "Sample Power Company", notes: [] });
    expect(prepareRequestDraft("Owes $315.20 to Sample Gas Company for gas.")).toMatchObject({ payeeKind: "utility", payeeName: "Sample Gas Company" });
    expect(prepareRequestDraft("Rent is $500. She gave $50 to Jordan Ellis.")).toMatchObject({ payeeKind: null, payeeName: "" });
    expect(prepareRequestDraft("Owes $90, paid to Jordan Ellis.")).toMatchObject({ payeeKind: null, payeeName: "Jordan Ellis" });
    expect(prepareRequestDraft("Rent of $500 might be paid to Sample Court Apartments.").payeeKind).toBeNull();
    expect(prepareRequestDraft("Missed work due to illness. Rent is $500.").payeeName).toBe("");
  });
  test("copies a payee's name only from a plain statement", () => {
    expect(prepareRequestDraft("Rent is late, 600 dollars. The landlord is Sample Property Co.").payeeName).toBe("Sample Property Co");
    expect(prepareRequestDraft("Rent is late, 600 dollars. She thinks the landlord might be Sample Property Co.").payeeName).toBe("");
  });

  test("reads who is paid from the ways a volunteer writes it, and shows that sentence beside the draft", () => {
    for (const note of ["Needs $450 for rent. Pay Mill Road Rentals.", "Rent $450, landlord Mill Road Rentals.", "Rent is $450. Her landlord's name is Mill Road Rentals.", "Rent is $450. Make the check out to Mill Road Rentals."]) {
      const draft = prepareRequestDraft(note);
      expect(draft).toMatchObject({ payeeKind: "landlord", payeeName: "Mill Road Rentals", quote: note });
      expect(draft.notes).not.toContain(draftNotes.payee);
    }
    // "Pay Jordan" may be the neighbor: nothing is proposed, and the quote stays the sentence with the amount.
    expect(prepareRequestDraft("Rent is $450. Pay Jordan.")).toMatchObject({ payeeKind: null, payeeName: "", quote: "Rent is $450." });
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

  test("a sentence after an address keeps its full stop and its first word", () => {
    expect(withoutIdentity("Lives at 14 Example Lane. Email marisol@kindhelps.example.", known)).toBe("Lives at [address]. Email [email].");
    expect(withoutIdentity("Moved to 8 Sample St. Apt 4 last week. Owes $60.", known)).toBe("Moved to [address] last week. Owes $60.");
  });

  test("days and months stay in three languages, and a month that is somebody's first name still goes", () => {
    expect(withoutIdentity("Our food pantry team sorts donations on Tuesdays. Ask Jordan Ellis, (239) 555-0142.", known)).toBe("Our food pantry team sorts donations on Tuesdays. [name], [phone].");
    expect(withoutIdentity("Shut-off is set for Friday, November 20. Rent was due in October.", known)).toBe("Shut-off is set for Friday, November 20. Rent was due in October.");
    expect(withoutIdentity("Le cortan la luz el Viernes. Debe la renta de Noviembre y los Sábados no trabaja.", known)).toBe("Le cortan la luz el Viernes. Debe la renta de Noviembre y los Sábados no trabaja.");
    expect(withoutIdentity("Y ap koupe kouran an Vandredi. Li dwe lwaye Novanm nan.", known)).toBe("Y ap koupe kouran an Vandredi. Li dwe lwaye Novanm nan.");
    expect(withoutIdentity("Her neighbor April Johnson and her uncle Julio Reyes can drive her on Monday.", known)).toBe("Her neighbor [name] and her uncle [name] can drive her on Monday.");
    expect(withoutIdentity("Her daughter Wednesday Addams called.", known)).not.toContain("Addams");
  });

  test("what the check needs stays", () => {
    expect(withoutIdentity(rosa, known)).toBe(rosa);
  });
});

test("a free-text call note leaves without the caller's name, phone or street", () => {
  const sent = withoutIdentity("Rosa at 555-0142 on Mill Road. Rosa Fontaine says rent is $450.", { names: ["Rosa Fontaine"], addresses: [] });
  expect(sent).not.toMatch(/Rosa|Fontaine|555|0142|Mill/);
  expect(sent).toContain("$450");
});

test("another neighbor the conference knows is taken out too, and an ordinary word that is also a name stays", () => {
  const sent = withoutIdentity("Behind on rent. Her neighbor Marisol Vega drove her here. Hope is short, will pay what she can.", { names: [], addresses: [], others: ["Marisol Vega", "Will Hope"] });
  expect(sent).not.toMatch(/Marisol|Vega/);
  expect(sent).toContain("will pay");
});

describe("near-miss names", () => {
  test("a misspelled household name goes; other words stay", async () => {
    const { withoutNearNames } = await import("./request-draft");
    const names = ["Rosa Delgado", "Darnell Okafor"];
    expect(withoutNearNames("Delgadoo called. Rent is due Friday.", names)).toBe("[name] called. Rent is due Friday.");
    expect(withoutNearNames("rossa delagdo and darnel okafur came by.", names, true)).toBe("[name] [name] and [name] [name] came by.");
    // Lowercase words are left in text for the model; a different first letter never matches.
    expect(withoutNearNames("rent rose and the hose broke.", names)).toBe("rent rose and the hose broke.");
    expect(withoutNearNames("Nosa and Kosa.", names, true)).toBe("Nosa and Kosa.");
  });
  test("the scrub for the model also takes a misspelled name at a sentence's start", () => {
    expect(withoutIdentity("Delgadoo is behind on rent.", { names: ["Rosa Delgado"], addresses: [] })).toBe("[name] is behind on rent.");
  });
  test("a Spanish note with no food names two kinds, and the landlord as who is paid", () => {
    const draft = prepareRequestDraft("Recibió aviso de desalojo. Debe $600 de renta al dueño. Tiene dos niños y no tienen comida.");
    expect(draft.kind).toBeNull();
    expect(draft.notes).toContain(draftNotes.kindSeveral);
    expect(draft.notes).not.toContain(draftNotes.doubtful);
    expect(draft.payeeKind).toBe("landlord");
    expect(draft.amountRequested).toBe(60000);
  });
});
