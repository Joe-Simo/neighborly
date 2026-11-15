import { describe, expect, test } from "bun:test";
import { prepareDraft } from "./draft";

describe("explicit draft preparation", () => {
  test("extracts the supplied example without inventing morning", () => {
    const draft = prepareDraft(
      "Our welcome team serves every other Sunday. We need two people from 9:30 to 11.",
    );
    expect(draft).toMatchObject({
      teamName: "welcome team",
      recurrence: "Every other Sunday",
      peopleCount: "2",
      time: "9:30 to 11",
    });
    expect(draft.notes.join(" ")).toContain("Confirm AM/PM");
    expect(Object.keys(draft).sort()).toEqual([
      "notes",
      "peopleCount",
      "recurrence",
      "teamName",
      "time",
    ]);
  });
  test("leaves the team name blank when the description is uncertain or names multiple teams", () => {
    expect(prepareDraft("Our welcome team serves every Sunday?").teamName).toBe("");
    expect(prepareDraft("Our welcome team might serve every Sunday.").teamName).toBe("");
    expect(
      prepareDraft("Our welcome team serves every Sunday. Our greeting team serves every Sunday.").teamName,
    ).toBe("");
  });
  test("unrecognized prose leaves fields blank", () => {
    const draft = prepareDraft(
      "Please help us coordinate neighbors, perhaps next weekend.",
    );
    expect(draft).toMatchObject({
      teamName: "",
      recurrence: "",
      peopleCount: "",
      time: "",
    });
    expect(draft.notes.join(" ")).toContain("Not recognized");
  });
  test("case and explicit AM/PM are supported", () => {
    expect(
      prepareDraft(
        "OUR Greeting TEAM serves EVERY SUNDAY. 2 PEOPLE from 9:30 AM to 11 AM.",
      ),
    ).toMatchObject({
      teamName: "Greeting TEAM",
      recurrence: "Every Sunday",
      peopleCount: "2",
      time: "09:30–11:00",
    });
  });
  test("explicit 24 hour ranges normalize, ambiguous noon crossings do not", () => {
    expect(prepareDraft("from 13:00 to 14:30").time).toBe("13:00–14:30");
    expect(prepareDraft("from 09:30 to 11:00").time).toBe("09:30–11:00");
    expect(prepareDraft("from 11 to 1").time).toBe("11 to 1");
    expect(prepareDraft("from 9 to 11 pm").time).toBe("9 to 11 pm");
  });
  test("an explicit overnight interval is flagged for date review", () => {
    const draft = prepareDraft("from 11 pm to 1 am");
    expect(draft.time).toBe("23:00–01:00");
    expect(draft.notes.join(" ")).toContain("crosses midnight");
  });
  test("invalid clocks are not silently corrected", () => {
    expect(prepareDraft("from 25:00 to 26:00").time).toBe("");
    expect(prepareDraft("from 9:99 to 11").time).toBe("");
  });
  test("does not turn negated, conditional, or qualified statements into facts", () => {
    const draft = prepareDraft(
      "Our welcome team never serves every Sunday. We do not need two people from 9:30 to 11. If we need three people from 13:00 to 14:00, we will ask later.",
    );
    expect(draft).toMatchObject({ recurrence: "", peopleCount: "", time: "" });
    expect(prepareDraft("We need two people from 9 to 11 except holidays")).toMatchObject({
      peopleCount: "",
      time: "",
    });
  });
  test("leaves conflicting explicit clauses for the user to resolve", () => {
    const draft = prepareDraft(
      "Every Sunday. Every other Sunday. We need two people. We need three people. From 09:00 to 10:00. From 11:00 to 12:00.",
    );
    expect(draft).toMatchObject({ recurrence: "", peopleCount: "", time: "" });
  });
  test("does not ignore a later negation of an otherwise supported clause", () => {
    const draft = prepareDraft(
      "We serve every Sunday. Not every Sunday. We need two people. Not two people. From 09:00 to 10:00. Not from 09:00 to 10:00.",
    );
    expect(draft).toMatchObject({ recurrence: "", peopleCount: "", time: "" });
  });
  test("does not turn questions into confirmed schedule or staffing facts", () => {
    expect(
      prepareDraft("Every Sunday? We need two people from 9 to 11?"),
    ).toMatchObject({ recurrence: "", peopleCount: "", time: "" });
    expect(
      prepareDraft("Every Sunday. Every Sunday? We need two people. Two people? From 09:00 to 10:00. From 09:00 to 10:00?"),
    ).toMatchObject({ recurrence: "", peopleCount: "", time: "" });
  });
});
