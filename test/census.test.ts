import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CensusError, parseCensusGov, parseCensusReporter, suggestedLanguages, zipSchema } from "@/lib/census";

const fixture = (zip: string) => JSON.parse(readFileSync(new URL(`./fixtures/censusreporter-${zip}.json`, import.meta.url), "utf8"));

describe("Census C16001 parsing (real ACS 2024 5-year responses)", () => {
  it("reads totals and ranks languages for 33919, Fort Myers FL", () => {
    const n = parseCensusReporter("33919", fixture("33919"));
    expect(n.release.id).toBe("acs2024_5yr");
    expect(n.total).toBe(29585);
    expect(n.englishOnly).toBe(25642);
    expect(n.otherLanguages).toBe(3943);
    expect(n.groups[0]).toMatchObject({ id: "spanish", speakers: 1823, limitedEnglish: 517, speakersMoe: 437 });
    expect(n.groups[0].share).toBeCloseTo(1823 / 29585);
    expect(n.groups[0].limitedShare).toBeCloseTo(517 / 1823);
    expect(n.groups.map((g) => g.speakers)).toEqual([...n.groups.map((g) => g.speakers)].sort((a, b) => b - a));
    expect(n.limitedEnglish).toBe(n.groups.reduce((s, g) => s + g.limitedEnglish, 0));
  });

  it("marks groups with zero speakers or wide margins as low reliability", () => {
    const n = parseCensusReporter("33919", fixture("33919"));
    const korean = n.groups.find((g) => g.id === "korean")!;
    expect(korean.speakers).toBe(0);
    expect(korean.lowReliability).toBe(true);
    const vietnamese = n.groups.find((g) => g.id === "vietnamese")!;
    expect(vietnamese.lowReliability).toBe(true);
  });

  it("reads 66044, Lawrence KS", () => {
    const n = parseCensusReporter("66044", fixture("66044"));
    expect(n.total).toBe(27910);
    expect(n.groups[0].id).toBe("spanish");
    expect(n.groups.find((g) => g.id === "korean")).toMatchObject({ speakers: 137, limitedEnglish: 0 });
  });

  it("suggests languages ranked by people who speak English less than very well", () => {
    const n = parseCensusReporter("33908", fixture("33908"));
    const s = suggestedLanguages(n);
    expect(s[0]).toBe("es");
    expect(s).not.toContain("ko");
    expect(s.length).toBeLessThanOrEqual(3);
  });

  it("pre-selects by limited-English neighbors, not by total speakers", () => {
    // 33919: Chinese has 328 neighbors with limited English, German only 41.
    const s = suggestedLanguages(parseCensusReporter("33919", fixture("33919")));
    expect(s.slice(0, 2)).toEqual(["es", "zh-Hans"]);
    expect(s).not.toContain("de");
  });

  it("throws a not-found error for a ZIP that is missing from the response", () => {
    expect(() => parseCensusReporter("99999", fixture("33919"))).toThrow(CensusError);
    expect(() => parseCensusReporter("33919", { error: "nope" })).toThrow(/shape/);
  });

  it("parses the api.census.gov row format to the same result", () => {
    const est = fixture("33919").data["86000US33919"].C16001.estimate as Record<string, number>;
    const err = fixture("33919").data["86000US33919"].C16001.error as Record<string, number>;
    const header: string[] = [];
    const values: string[] = [];
    for (let i = 1; i <= 38; i++) {
      const id = String(i).padStart(3, "0");
      header.push(`C16001_${id}E`, `C16001_${id}M`);
      values.push(String(est[`C16001${id}`]), String(err[`C16001${id}`]));
    }
    header.push("zip code tabulation area");
    values.push("33919");
    const a = parseCensusGov("33919", [header, values]);
    const b = parseCensusReporter("33919", fixture("33919"));
    expect(a.groups).toEqual(b.groups);
    expect(a.source).toBe("census.gov");
  });

  it("validates ZIP codes", () => {
    expect(zipSchema.safeParse("33908").success).toBe(true);
    expect(zipSchema.safeParse(" 66044 ").success).toBe(true);
    expect(zipSchema.safeParse("3390").success).toBe(false);
    expect(zipSchema.safeParse("abcde").success).toBe(false);
  });
});
