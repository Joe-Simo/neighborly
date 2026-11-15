import { describe, expect, test } from "bun:test";
import { validateDraft, type DraftFields } from "./draft-validation";

const valid: DraftFields = {
  teamName: "Welcome team",
  firstDate: "2026-11-22",
  time: "09:30–11:00",
  recurrence: "Every other Sunday",
  peopleCount: "2",
  timeZone: "America/New_York",
  role: "Welcome arriving people at the main entrance.",
  participants: "Grace, Noor, Ellis",
};

describe("local draft validation", () => {
  test("accepts explicit 24-hour or AM/PM intervals without assigning anyone", () => {
    expect(validateDraft(valid)).toEqual({});
    for (const time of [
      "09:30 to 11:00",
      "09:30-11:00",
      "9:30 AM to 11 AM",
      "12 pm – 1:30 pm",
      "from 9 a.m. to 11 a.m.",
    ]) {
      expect(validateDraft({ ...valid, time })).toEqual({});
    }
    expect(
      validateDraft({ ...valid, recurrence: "Once", timeZone: "UTC" }),
    ).toEqual({});
  });

  test("whitespace-only required values remain errors", () => {
    const fields = Object.fromEntries(
      Object.keys(valid).map((key) => [key, " \n "]),
    ) as DraftFields;
    expect(Object.keys(validateDraft(fields)).sort()).toEqual(
      Object.keys(valid).sort(),
    );
    expect(validateDraft({ ...valid, teamName: "  Welcome team  " })).toEqual(
      {},
    );
  });

  test("ambiguous, invalid and overnight ranges cannot become reviewed drafts", () => {
    for (const time of [
      "banana",
      "9:30 to 11",
      "9:30 to 11 AM",
      "09:30 to 11 AM",
      "25:00–26:00",
      "09:70–11:00",
      "11 PM to 1 AM",
      "11:00–09:30",
      "09:30–09:30",
    ]) {
      expect(validateDraft({ ...valid, time }).time).toBeDefined();
    }
    expect(validateDraft({ ...valid, time: "9:30 to 11" }).time).toContain(
      "AM/PM",
    );
  });

  test("validates actual calendar dates including leap days", () => {
    expect(validateDraft({ ...valid, firstDate: "2028-02-29" })).toEqual({});
    for (const firstDate of [
      "2026-02-29",
      "2026-04-31",
      "2026-13-01",
      "0000-01-01",
      "22 November",
      "2026-1-2",
    ]) {
      expect(validateDraft({ ...valid, firstDate }).firstDate).toBeDefined();
    }
  });

  test("requires named zones and integer participant capacity", () => {
    for (const timeZone of [
      "banana",
      "PST",
      "EST",
      "-05:00",
      "America/Banana",
    ]) {
      expect(validateDraft({ ...valid, timeZone }).timeZone).toBeDefined();
    }
    for (const peopleCount of ["0", "101", "2.5", "2 people", "NaN", "-1"]) {
      expect(
        validateDraft({ ...valid, peopleCount }).peopleCount,
      ).toBeDefined();
    }
  });
});
