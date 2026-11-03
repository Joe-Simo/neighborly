# Neighborly

**Live demo:** https://neighborly-church.vercel.app

**Demo video (2.5 minutes):** https://vimeo.com/1242902319

Neighborly helps a church invite its neighbors in the languages they speak at home. A volunteer enters the church's ZIP code and sees which languages people nearby speak, from US Census data. They write or paste an announcement. AI drafts each translation, a separate AI call turns it back into English, and code checks every time, date, number, phone and address. A fluent volunteer then approves each block. Only then can the church export a web snippet, email text or a printable one-page flyer per language. When the announcement cites a Bible verse, Neighborly inserts the verse from a public-domain Bible in that language, never from AI.

Built for the [AI for Church Hackathon 2026](https://aiforchurch.com/hackathon), Outreach and Evangelism track.

## Why

Many churches want to welcome neighbors who read Spanish, Haitian Creole, Vietnamese or Chinese better than English, but they have no translator on staff. Machine translation is fast, but a wrong time or address on an invitation means a family shows up at the wrong hour. Neighborly keeps the speed of AI and adds the checks a careful volunteer would make.

## How it works

1. **Neighbors.** The church's ZIP code is looked up in American Community Survey 2024 5-year table C16001 (language spoken at home by ability to speak English). Neighborly shows each language group, its margin of error, and how many speak English less than "very well". It pre-selects up to three languages by that number and marks small, unreliable estimates.
2. **Announcement.** Start from a sample for the fictional church Grace Fellowship or paste your own. Each paragraph is a block. A line saying the message was translated with AI help and checked by a volunteer is added and translated too. A church glossary (for example "small group", "communion", "kids check-in") is sent with every request.
3. **Translate and review.** For each language:
   - one AI call translates the blocks using the glossary;
   - a second AI call translates the result back into English without seeing the original;
   - code (no AI) extracts every time, date, phone, price, street address, email, link and number from the English and checks it in the translation, including full-width and Arabic-Indic digits and afternoon words for PM times;
   - weekdays and months are checked in the back-translation, and numbers that appear only in the translation are flagged;
   - glossary terms are checked, and English words that did not come back are underlined as hints.
   The reviewer can edit any block and back-translate the edit.
4. **Publish.** Export stays locked until a named reviewer approves every block of every language. An approval is bound to a hash of the exact text approved, so any edit sends the block back to review. Blocks with flags need the reviewer to tick that they checked them. Exports are an HTML snippet with the right `lang` and `dir` for each language, plain email text, and a printable letter-size flyer for each language at `/flyer?lang=xx`. The flyer page rebuilds the same gate from the saved workspace, so it shows a locked message until every block is approved.

Translation streams its progress (translating, then back-translating) so the page can show which step is running, how long it has taken and an estimate, since free models can take close to a minute.

## AI use, disclosed

- Translation and back-translation use free open models through [OpenRouter](https://openrouter.ai): by default `google/gemma-4-31b-it:free`, then `nvidia/nemotron-3-ultra-550b-a55b:free`, then `google/gemma-4-26b-a4b-it:free`. The model used is shown on every translation.
- The free tier has a daily limit, and the server caps itself at 36 calls a day. When live AI is unavailable, the sample announcements show **recorded examples**: real output from those models, captured on November 3, 2026 with `scripts/record-examples.mjs`, labelled "Recorded example" with the model and date. Your own text is never answered with recorded output.
- AI is not used for the Census numbers, the fact checks, the glossary checks or the approval rules. Those are plain code with tests.
- The AI is never asked to write scripture or theology. The prompt tells it to keep Bible references as references and never write out a verse. Verse text is inserted by code from the bundled public-domain Bibles below.
- Parts of this codebase were written with an AI coding assistant and reviewed by the author.

## Scripture sources

When an English block cites a verse such as "Hebrews 13:2", code finds the reference and looks it up in `src/data/scripture.json`. That file was built by `scripts/fetch-scripture.mjs` from the eBible.org HTML editions listed here. The script refuses a translation whose eBible copyright page does not say "Public Domain", and it stores that page's statement next to the text.

| Language | Translation | eBible.org id | Public-domain status | Evidence |
| --- | --- | --- | --- | --- |
| English | King James Version (1769 text) | eng-kjv2006 | Public domain outside the United Kingdom. In the UK the Crown holds rights by letters patent. | https://ebible.org/eng-kjv2006/copyright.htm |
| Spanish | Reina-Valera 1909 | spaRV1909 | Public domain, published 1909 | https://ebible.org/spaRV1909/copyright.htm |
| French | Louis Segond 1910 | fraLSG | Public domain, published 1910 | https://ebible.org/fraLSG/copyright.htm |
| German | Lutherbibel 1912 | deu1912 | Public domain, published 1912 | https://ebible.org/deu1912/copyright.htm |
| Russian | Synodal Translation (1876) | russyn | Public domain, published 1876 | https://ebible.org/russyn/copyright.htm |
| Vietnamese | Kinh Thánh, Cadman (NT 1923, OT 1925) | vie1934 | Public domain. eBible.org reports the copyright expired on January 1, 2019 (NT) and January 1, 2021 (OT). | https://ebible.org/vie1934/copyright.htm |
| Korean | Korean Bible 1910 | kor | Public domain, 1910 translation | https://ebible.org/kor/copyright.htm |
| Arabic | Smith and Van Dyck (1865) | arb-vd | Public domain, published 1865 | https://ebible.org/arb-vd/copyright.htm |

Left out on purpose, so these languages show the reference with a plain note instead of verse text:

- **Chinese:** the Chinese Union Version on eBible.org is the 1989 punctuated revision, whose copyright status we could not confirm.
- **Haitian Creole:** the 1985 Bib La public-domain claim rests on publication without a copyright notice, which we could not verify.
- **Portuguese, Tagalog, Hindi:** the eBible.org editions are recent or copyrighted.
- **Ukrainian, Polish:** not checked yet.

Only a short list of verses often used in invitations is bundled (Leviticus 19:34, Matthew 11:28, Matthew 25:35, Luke 14:13, John 3:16, Romans 15:7, Hebrews 13:2). Any other reference is kept as a reference with a note. If the English quotes a verse in full, translation stays off until only the reference is left, and a translation that comes back much longer than a paragraph citing a verse is flagged for the reviewer.

## Safeguards

- Human approval of every block, bound to the exact text, before any export.
- Code checks for times, dates, numbers, phones, addresses, emails and links, shown as chips with text and icons, not color alone.
- An AI disclosure line in every export, reviewed like the rest.
- No accounts. Work is saved in the browser's local storage. Only the text being translated leaves the browser, to OpenRouter.
- The daily AI call cap and the translation cache are shared by all server instances through a private Vercel Blob store on the free Hobby plan (hard limits, no card, nothing billed). Updates use ETag compare-and-swap so two servers cannot both spend the last call. If Blob is unavailable, each instance falls back to its own memory and the status line says so.
- Inputs are validated with zod and limited in size. The OpenRouter key stays on the server.
- Sample data only: Grace Fellowship, its address on Grace Lane, its 555 phone number and its `.example` email and website are fictional.

## Limits

See the [Limits and safeguards page](https://neighborly-church.vercel.app/limits). In short: AI translations can be wrong and back-translation does not prove they are right; Census estimates for small groups have wide margins; Census groups some languages together (for example French, Haitian, or Cajun); the free AI tier runs out; verse text exists only for the bundled languages and verses.

## Data sources

- US Census Bureau, American Community Survey 2024 5-year estimates (2020 to 2024), table C16001, by ZIP code tabulation area. The app reads it from [Census Reporter](https://censusreporter.org)'s public API, which republishes the Census Bureau's ACS tables and needs no key. If `CENSUS_API_KEY` is set, the server reads `api.census.gov` directly instead.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, zod, Vitest, Vercel Blob (free Hobby plan). Hosted on Vercel. No paid services.

## Run it

```bash
pnpm install
cp .env.example .env.local   # add a free OpenRouter key, or leave it empty to use recorded examples
pnpm dev
```

Checks:

```bash
pnpm test         # Census parsing, fact checker, approval gate, export gating, scripture, shared cap
pnpm lint
pnpm typecheck
pnpm build
pnpm check:dashes
```

## License

MIT. See [LICENSE](LICENSE).
