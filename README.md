# Neighborly

**Live demo:** LIVE_URL

Neighborly helps a church invite its neighbors in the languages they speak at home. A volunteer enters the church's ZIP code and sees which languages people nearby speak, from US Census data. They write or paste an announcement. AI drafts each translation, a separate AI call turns it back into English, and code checks every time, date, number, phone and address. A fluent volunteer then approves each block. Only then can the church export a web snippet or email text.

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
4. **Publish.** Export stays locked until a named reviewer approves every block of every language. An approval is bound to a hash of the exact text approved, so any edit sends the block back to review. Blocks with flags need the reviewer to tick that they checked them. Exports are an HTML snippet with the right `lang` and `dir` for each language, and plain email text.

## AI use, disclosed

- Translation and back-translation use free open models through [OpenRouter](https://openrouter.ai): by default `google/gemma-4-31b-it:free`, then `nvidia/nemotron-3-ultra-550b-a55b:free`, then `google/gemma-4-26b-a4b-it:free`. The model used is shown on every translation.
- The free tier has a daily limit, and the server caps itself at 36 calls a day. When live AI is unavailable, the three sample announcements show **recorded examples**: real output from those models, captured on November 3, 2026 with `scripts/record-examples.mjs`, labelled "Recorded example" with the model and date. Your own text is never answered with recorded output.
- AI is not used for the Census numbers, the fact checks, the glossary checks or the approval rules. Those are plain code with tests.
- The AI is never asked to write scripture or theology.
- Parts of this codebase were written with an AI coding assistant and reviewed by the author.

## Safeguards

- Human approval of every block, bound to the exact text, before any export.
- Code checks for times, dates, numbers, phones, addresses, emails and links, shown as chips with text and icons, not color alone.
- An AI disclosure line in every export, reviewed like the rest.
- No accounts and no database. Work is saved in the browser's local storage. Only the text being translated leaves the browser, to OpenRouter.
- Inputs are validated with zod and limited in size. The OpenRouter key stays on the server.
- Sample data only: Grace Fellowship, its address on Grace Lane, its 555 phone number and its `.example` email and website are fictional.

## Limits

See the [Limits and safeguards page](LIVE_URL/limits). In short: AI translations can be wrong and back-translation does not prove they are right; Census estimates for small groups have wide margins; Census groups some languages together (for example French, Haitian, or Cajun); the free AI tier runs out; the server cache lasts only as long as a server instance. A printable flyer and scripture from published Bible translations are planned.

## Data sources

- US Census Bureau, American Community Survey 2024 5-year estimates (2020 to 2024), table C16001, by ZIP code tabulation area. The app reads it from [Census Reporter](https://censusreporter.org)'s public API, which republishes the Census Bureau's ACS tables and needs no key. If `CENSUS_API_KEY` is set, the server reads `api.census.gov` directly instead.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, zod, Vitest. Hosted on Vercel. No paid services.

## Run it

```bash
pnpm install
cp .env.example .env.local   # add a free OpenRouter key, or leave it empty to use recorded examples
pnpm dev
```

Checks:

```bash
pnpm test         # Census parsing, fact checker, approval gate
pnpm lint
pnpm typecheck
pnpm build
pnpm check:dashes
```

## License

MIT. See [LICENSE](LICENSE).
