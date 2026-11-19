import { describe, expect, test } from "bun:test";
import { sentencesOf } from "@/components/workspace/saved-words";
import { prepareDraft } from "./draft";
import { withoutIdentity } from "./request-draft";
import { urgentSigns } from "./urgency";

// These pin what the text rules gave while they were written with lookbehinds, which Safari before 16.4 cannot parse.
// The rewritten rules must give exactly the same.
const known = { names: ["Ana Lopez"], addresses: [], others: ["Marisol Vega", "Hope"] };
const notes = ["Call Ana at (555) 010-0142 or +1 555 010 0143, not $1234567.", "ana lopez called. Marisol Vega will visit, and Hope is high. Spoke with Daniel Whitcombe today.", "Rent is due Friday. She asked: can Pedro help? Lights cut off tomorrow!", "The landlord, Mr. Brown, said Teresa (her sister) moved in; Bill's water is off."];
const drafts = ["The pantry team meets Saturdays? We need two people.. Food bank team; Sort cans!", "Our visit team visits homes?.Every week"];

describe("text rules without lookbehind", () => {
  test("a note loses its phones and names exactly as before", () => {
    expect(notes.map((note) => withoutIdentity(note, known))).toEqual(["[name] at [phone] or [phone], not $1234567.", "[name] called. [name] will visit, and [name] is high. Spoke with [name] today.", "Rent is due Friday. She asked: can [name] help? Lights cut off tomorrow!", "The landlord, [name], said [name] (her sister) moved in; Bill's water is off."]);
  });
  test("a note parts into the same clauses for urgency", () => {
    expect(notes.map((note) => urgentSigns(note))).toEqual([[], [], [{"reason": "shutoff", "day": null}], []]);
  });
  test("a team description parts at the same stops, a question kept on its clause", () => {
    expect(drafts.map((draft) => prepareDraft(draft))).toEqual([{"teamName": "", "recurrence": "", "peopleCount": "2", "time": "", "notes": ["Not recognized: team name, recurrence, time. Enter these details yourself.", "First date, time zone, role description, and participants must be supplied. Names do not establish consent, availability, or acceptance."]}, {"teamName": "", "recurrence": "", "peopleCount": "", "time": "", "notes": ["Not recognized: team name, recurrence, number of people, time. Enter these details yourself.", "First date, time zone, role description, and participants must be supplied. Names do not establish consent, availability, or acceptance."]}]);
  });
  test("a saved line parts after a word of three letters and a stop", () => {
    expect(sentencesOf("Called back. Ana is ok.  Rent paid! Mr. Brown? yes")).toEqual(["Called back.", "Ana is ok.  Rent paid!", "Mr. Brown?", "yes"]);
    expect(sentencesOf("No stop here")).toEqual(["No stop here"]);
  });
});
