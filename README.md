# kind helps

Free software for the parish conferences of the Society of St. Vincent de Paul and groups like them: the help line, neighbor records, home visits in pairs, the treasury, the yearly report and the volunteers' own week, in English and Spanish. Live at [kindhelps.com](https://kindhelps.com), with a sample conference that anyone can open.

Kind Helps is independent. It is not affiliated with or endorsed by the Society of St. Vincent de Paul. "Neighbor" always means the person being helped. The internal project name is Neighborly.

## How it is built

- **Web:** Next.js 16 and React 19, with Tailwind CSS 4 and shadcn/ui, built with Bun. `src/app` holds the pages and `src/components/workspace` the signed-in rooms. The workspace's design rules are in `src/components/workspace/README.md`.
- **Backend:** Convex (`convex/`). Private data is served only after the backend checks the caller's Clerk token and their role in that conference (`convex/auth.config.ts`, `convex/access.ts`). A neighbor's record opens only for members whose role needs it.
- **Sign-in:** Clerk.
- **iPhone and iPad:** a Capacitor shell in `apple/`, which opens the signed-in site full screen. See `apple/README.md`.
- **Languages:** fixed word tables in `src/lib/words/`, with no machine translation at run time.

## The AI path

The only model is Jev (`jev-1.14.0`, pinned in `convex/drafts.ts`). It is reached through Typesafe from Convex actions, and the key (`TYPESAFE_API_KEY`) lives only in the Convex deployment's environment. Jev picks from fixed lists and answers yes or no. It writes no prose. It does four jobs: drafting a request from a call note, marking urgent calls with their reason, checking the year before the report, and reading a new team's name.

- **Privacy:** before any text leaves for the model, `withoutIdentity` in `src/lib/request-draft.ts` takes out the names, phones, emails and addresses the conference knows, along with anything shaped like them. Each draft offers a "What the assistant saw" link, which shows the note exactly as it was sent.
- **A person decides:** a draft is saved only when a volunteer presses save. Saving a request does not grant it. Without the key, or past the monthly allowance (`monthlyAllowance` in `src/lib/request-draft.ts`), the app works by fixed rules and says so.

## The evaluation

`src/lib/jev-set.ts` holds 38 made-up call notes, each with the answer written before any run. Twelve of them are held out and were never used to tune the rules. `eval/jev/run-6.json` is a run's raw output. On the 12 held-out notes it scored 42 of 48 fields right, 6 blank and 0 wrong, across 8 English, 2 Spanish and 2 Haitian Creole notes. `src/lib/jev-eval.test.ts` counts those figures from the file. `eval/jev/README.md` explains how to run it again.

## Run it locally

You need Bun, a Convex account and a Clerk development instance.

```sh
bun install
bunx convex dev          # creates your own development deployment and writes .env.local
bun run dev              # http://localhost:3000
```

Put these in `.env.local`: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` (from Clerk's development instance). Set these on the Convex deployment (`bunx convex env set …`): `CLERK_JWT_ISSUER_DOMAIN` (Clerk's Frontend API URL) and `SITE_URL`. `TYPESAFE_API_KEY` is optional. Without it, drafts are left for a person to write.

**Sample data.** Every person, phone (555-01xx) and household in the sample is made up. To open the sample conference as yourself, sign in once, then set your Clerk user id on the deployment and load the sample:

```sh
bunx convex env set DEMO_CLERK_USER_ID <your Clerk user id>
bunx convex env set SAMPLE_NIGHTLY off      # optional: skip the nightly reset on a development deployment
bunx convex run demo:refresh
```

## Checks

```sh
bun run lint
bun run typecheck
bun run test       # Bun unit tests (src) and Vitest with convex-test (convex)
bun run a11y       # axe and a Tab walk over sign-in and every room at 1440, 390 and 200% zoom, against bun run dev
```

The backend tests simulate sign-in. `convex/sampleYear.test.ts` builds the sample year and holds the figures on the public pages to the yearly report.

## Licenses

The fonts are under the SIL Open Font License. Their notices, and those for third-party art inputs, are in `licenses/`.
