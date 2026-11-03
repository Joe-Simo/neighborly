# Neighborly: submission form fields (draft)

AI for Church Hackathon 2026, Outreach and Evangelism track. Draft only, not submitted.

## Tagline

Invite your neighbors in the languages they speak at home, with a volunteer checking every word.

## Description

Neighborly helps a church invite the neighbors who read another language better than English. A volunteer types the church's ZIP code and sees which languages people nearby speak at home, from US Census table C16001, with margins of error and how many speak English less than "very well". They write or paste an announcement, such as a neighbors dinner or a Sunday service.

AI drafts each translation using the church's glossary. A second, separate AI call turns it back into English without seeing the original. Plain code then checks every time, date, phone, price, address, email and link. A fluent volunteer reviews each block, can edit it, and approves it under their name.

Exports stay locked until every block in every language is approved for the exact wording on screen. Any later edit sends that block back to review. The church then gets an HTML snippet with the right language and direction tags, email text, and a printable one-page flyer per language.

When the announcement cites a Bible verse, Neighborly inserts the verse from a public-domain Bible in that language, such as the King James Version or Reina-Valera 1909. AI never writes verse text. If there is no verified public-domain Bible for a language, the reference stays with a plain note.

Each translation carries a line saying it was made with AI help and checked by a volunteer. The demo uses the fictional Grace Fellowship and sample data only.

## Problem it solves

Many churches sit in neighborhoods where thousands of people speak Spanish, Haitian Creole, Vietnamese, Chinese or Arabic at home, and they have no translator on staff. Free machine translation is fast, but one wrong time or address on an invitation means a family arrives at the wrong hour or the wrong building, and a church can lose trust it worked hard to build. Volunteers who are fluent often have little time and no simple way to check a draft. Neighborly shows a church who its neighbors are, gets a usable draft in under a minute, and turns the volunteer's review into a short, clear task with the risky details already checked.

## How AI is used

- One AI call per language translates the announcement block by block, with the church glossary in the prompt (for example "small group", "communion", "kids check-in").
- A second AI call, with no access to the original, translates the result back into English so an English-only staff member can see what the translation says.
- Models are free open models through OpenRouter: Gemma 4 31B, then Nemotron 3 Ultra, then Gemma 4 26B as fallbacks. The model name is shown on every translation.
- AI is not used for the Census numbers, the fact checks, the glossary checks, the approval rules or scripture text. Those are plain code with tests.
- Parts of the code were written with an AI coding assistant and reviewed by the author.

## Responsible AI and safeguards

- Human approval gate: nothing can be exported until a named, fluent reviewer approves every block. Each approval is tied to a hash of the exact approved text, so any edit reopens review.
- Fact checks in code: times (including PM words and non-Latin digits), dates, weekdays, months, phones, prices, street addresses, emails, links and numbers are compared between the English and the translation. Flagged blocks need the reviewer to confirm they checked them.
- Back-translation by a separate call, so the check does not depend on the model grading its own work.
- Scripture is never generated. Verse text comes only from bundled public-domain Bibles (eBible.org editions whose copyright page says Public Domain), with the source and status listed in the README. Announcements that paste in a quoted verse are blocked from translation until the quote is replaced by the reference. Languages without a verified public-domain Bible get the reference and a note.
- Disclosure: every translation includes a translated line saying AI helped and a volunteer checked it. Recorded examples are labelled as recorded, with model and date.
- Limits: a hard daily cap on AI calls, shared across servers through a free store, so the free tier is never exceeded. A public /limits page explains what Neighborly does not do.
- Privacy: no accounts, no tracking. Drafts stay in the visitor's browser. Only the announcement text is sent to the AI service.

## Tech stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, zod, Vitest. OpenRouter free models for translation and back-translation. US Census Bureau ACS 2024 5-year API for language data. Public-domain Bible text from eBible.org, bundled at build time. Vercel Hobby for hosting and Vercel Blob (free tier) for the shared cache and daily cap. Print CSS for the flyers.

## Live demo link

https://neighborly-church.vercel.app

## Repo link

https://github.com/Joe-Simo/neighborly (private; judges need to be given read access before submission)
