import { describe, expect, test } from "bun:test";
import { paperEmail } from "./paper-email";

describe("paper email", () => {
  test("the plain text says what the page says, with the link written out", () => {
    const email = paperEmail({ kind: "invitation", language: "en", set: "vincentian", place: "St. Example", link: "https://kindhelps.com/app?invite=abc" });
    expect(email.text).toContain("Your conference, St. Example, keeps its help line");
    expect(email.text).toContain("See the invitation: https://kindhelps.com/app?invite=abc");
    expect(email.html).toContain('href="https://kindhelps.com/app?invite=abc"');
  });
  test("a group's name is escaped, never read as markup", () => {
    const email = paperEmail({ kind: "meeting", language: "es", set: "general", place: "<b>A&B</b>", link: "https://kindhelps.com/app" });
    expect(email.html).not.toContain("<b>A&B</b>");
    expect(email.html).toContain("&#60;b&#62;A&#38;B&#60;/b&#62;");
    expect(email.html).toContain('lang="es"');
  });
  test("nothing needs a picture", () => {
    for (const kind of ["invitation", "cover_request", "meeting"] as const) expect(paperEmail({ kind, language: "en", set: "general", place: "Hope Pantry", link: "https://kindhelps.com/app" }).html).not.toContain("<img");
  });
});
