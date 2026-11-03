import { describe, expect, it } from "vitest";
import { checkCalendarWords, checkFacts, driftWords, extractFacts, flagBlock, numbersIn } from "@/lib/checks";
import { checkGlossary, STARTER_GLOSSARY } from "@/lib/glossary";

const EN = "Everyone is welcome this Sunday, November 15. Worship starts at 10:30 AM at 250 Grace Lane. Small groups meet at 7 PM. Call (239) 555-0142 or email hello@gracefellowship.example. Bring $5.";

describe("extractFacts", () => {
  it("finds times, dates, addresses, phones, emails and money without double counting", () => {
    const f = extractFacts(EN);
    const kinds = f.map((x) => `${x.kind}:${x.raw.trim()}`);
    expect(kinds).toEqual([
      "date:November 15",
      "time:10:30 AM",
      "address:250 Grace Lane",
      "time:7 PM",
      "phone:(239) 555-0142",
      "email:hello@gracefellowship.example.",
      "money:$5",
    ].map((k) => k.replace("example.", "example")));
    expect(f.find((x) => x.raw === "7 PM")?.time).toEqual({ h24: 19, h12: 7, m: 0, meridiem: "pm" });
  });

  it("reads plain numbers with thousands separators and 12 PM correctly", () => {
    const f = extractFacts("About 1,200 meals at 12:00 PM, and 15 volunteers.");
    expect(f.map((x) => x.digits)).toEqual([["1200"], ["12"], ["15"]]);
    expect(f[1].time).toMatchObject({ h24: 12, h12: 12 });
  });
});

describe("checkFacts", () => {
  it("passes a faithful Spanish translation", () => {
    const es = "Todos son bienvenidos este domingo 15 de noviembre. El culto empieza a las 10:30 a.m. en 250 Grace Lane. Los grupos pequeños se reúnen a las 7 p.m. Llame al (239) 555-0142 o escriba a hello@gracefellowship.example. Traiga $5.";
    const { checks, extras } = checkFacts(EN, es);
    expect(checks.filter((c) => c.status !== "ok")).toEqual([]);
    expect(extras).toEqual([]);
  });

  it("accepts 24-hour time and CJK hour markers", () => {
    expect(checkFacts("Meet at 7 PM.", "Treffen um 19 Uhr.").checks[0].status).toBe("ok");
    expect(checkFacts("Starts at 10:30 AM.", "上午10点30分开始。").checks[0].status).toBe("ok");
    expect(checkFacts("Starts at 6:30 PM.", "Commence à 18h30.").checks[0].status).toBe("ok");
  });

  it("flags a changed time, a dropped address name and an added number", () => {
    const bad = "Todos bienvenidos el domingo 15 de noviembre. El culto empieza a las 11:30 a.m. en 250 Calle Gracia. Grupos a las 7 p.m. Llame al (239) 555-0142 o hello@gracefellowship.example. Traiga $5 y 2 amigos.";
    const { checks, extras } = checkFacts(EN, bad);
    const byRaw = Object.fromEntries(checks.map((c) => [c.fact.raw.trim(), c.status]));
    expect(byRaw["10:30 AM"]).toBe("missing");
    expect(byRaw["250 Grace Lane"]).toBe("missing");
    // 11 is allowed because November is month 11; the changed time is caught above.
    expect(extras.map((e) => e.value)).toEqual(["2"]);
  });

  it("flags a PM hour with no evening word for a human check", () => {
    expect(checkFacts("Dinner at 7 PM.", "Cena a las 7.").checks[0].status).toBe("check");
    expect(checkFacts("Dinner at 7 PM.", "Cena a las 7 de la noche.").checks[0].status).toBe("ok");
  });

  it("catches a changed phone digit and reads Arabic-Indic digits", () => {
    expect(checkFacts("Call 555-0142.", "Llame al 555-0124.").checks[0].status).toBe("missing");
    expect(numbersIn("الساعة ١٠:٣٠")).toEqual(["10", "30"]);
    expect(checkFacts("At 10:30 AM.", "الساعة ١٠:٣٠ صباحا").checks[0].status).toBe("ok");
  });
});

describe("back-translation checks", () => {
  it("catches a weekday that changed", () => {
    const c = checkCalendarWords("Join us Sunday, November 15.", "Join us Saturday, November 15.");
    expect(c).toEqual([
      { word: "Sunday", status: "missing" },
      { word: "November", status: "ok" },
      { word: "Saturday", status: "added" },
    ]);
  });

  it("lists English content words that did not come back", () => {
    expect(driftWords("Kids check-in opens at 10:15 in the Family Room.", "The registration of children opens at 10:15 in the family room.")).toEqual(["kids", "check-in"]);
  });

  it("counts problems for a block", () => {
    const f = flagBlock("Worship at 10:30 AM on Sunday.", "Culto a las 11:30 el sábado.", "Worship at 11:30 on Saturday.");
    expect(f.problems).toBe(4);
  });
});

describe("glossary", () => {
  it("checks the church's chosen words", () => {
    const hits = checkGlossary("Communion is offered at Grace Fellowship. Small groups meet Friday.", "La comunión se ofrece en Grace Fellowship. Los grupos pequeños se reúnen el viernes.", "es", STARTER_GLOSSARY);
    expect(hits).toEqual([
      { term: "small group", expected: "grupo pequeño", used: true },
      { term: "communion", expected: "Santa Cena", used: false },
      { term: "Grace Fellowship", expected: "Grace Fellowship", used: true },
    ]);
  });
});
