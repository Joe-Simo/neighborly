import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/chrome";

export const metadata: Metadata = { title: "Limits and safeguards: Neighborly" };

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "What the AI does, and what it does not",
    items: [
      "Translations come from free open models on OpenRouter (for example Google Gemma and NVIDIA Nemotron). Each translation shows which model produced it.",
      "A second, separate call translates the result back into English without seeing the original. This catches some meaning changes. It does not prove a translation is right: two AI calls can make the same mistake.",
      "AI translations can be wrong, too formal, too casual, or wrong for a dialect. Haitian Creole, Tagalog and Vietnamese are weaker than Spanish in most models. That is why a fluent person approves every block.",
      "The AI is never asked to write sermons, theology or scripture. Scripture should come from a published Bible translation, not from AI. Scripture support is planned and will quote published translations only.",
    ],
  },
  {
    title: "Safeguards in the code",
    items: [
      "Every time, date, phone number, price, street address, email and link in the English is found by code, not AI, and checked in each translation. A missing or changed number is flagged in red.",
      "Weekdays and months are checked in the back-translation. Numbers that appear in a translation but not in the English are flagged.",
      "Words from your church glossary are checked, so a reviewer can see if \"small group\" or \"communion\" came out the way your church says it.",
      "Nothing can be exported until a named reviewer approves every block. An approval is tied to the exact text approved: edit one character and it goes back to waiting. Blocks with flags also need the reviewer to tick that they checked them.",
      "Each export ends with a line, translated and reviewed like the rest, telling readers it was translated with AI help and checked by a volunteer.",
    ],
  },
  {
    title: "Census numbers",
    items: [
      "Language counts are American Community Survey 2024 5-year estimates (2020 to 2024), table C16001, for ZIP code tabulation areas. They are read live from Census Reporter, which republishes Census Bureau data without needing an API key. With a Census API key the server reads api.census.gov directly.",
      "These are survey estimates with margins of error. Small groups can be off by a lot, and Neighborly marks groups where the margin is at least half the estimate.",
      "The Census groups some languages together. \"French, Haitian, or Cajun\" and \"Russian, Polish, or other Slavic\" do not tell you which one your neighbors read. Ask them.",
      "A ZIP code area is not your church's real neighborhood, and the people who live nearby are not the only people you serve.",
    ],
  },
  {
    title: "Privacy and data",
    items: [
      "There are no accounts. Your announcement, glossary, translations and approvals are kept in your own browser's storage.",
      "Text you translate is sent to OpenRouter and the model provider. Do not paste private information such as prayer requests, names of members or health details.",
      "The sample church, Grace Fellowship, is fictional. Its address, phone number, email and website are made up.",
    ],
  },
  {
    title: "Limits of this first version",
    items: [
      "The free AI tier allows a limited number of calls per day. When it is used up, the three sample announcements fall back to recorded AI output, clearly labelled with the model and date. Your own text cannot be translated until the next day.",
      "Translations are cached on the server by a hash of the text, language and glossary, and only for as long as that server instance runs.",
      "Fifteen languages are offered. Census groups with no matching language here (for example Other Asian and Pacific Island languages) are shown but cannot be translated yet.",
      "Still to come: a printable flyer, scripture from published translations, and sharing a review link with a volunteer on another device.",
    ],
  },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, "-");

export default function Limits() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Limits and safeguards</h1>
        <p className="mt-3 text-lg text-mute">
          Neighborly helps a church reach neighbors who read another language better than English. It is a drafting tool. People who speak the language are still the ones who decide what goes out.
        </p>
        <div className="mt-10 grid gap-8">
          {SECTIONS.map((s) => (
            <section key={s.title} className="card p-6" aria-labelledby={slug(s.title)}>
              <h2 id={slug(s.title)} className="font-display text-2xl font-semibold">
                {s.title}
              </h2>
              <ul className="mt-4 grid list-disc gap-2.5 pl-5 leading-relaxed marker:text-accent">
                {s.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
