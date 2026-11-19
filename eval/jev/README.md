# Jev measure runs

`run-6.json` is the raw output of measure run 6, saved as it came back. It is not edited or rebuilt.

- **Date:** run on 2026-11-15, Eastern (16 Nov, 00:22 UTC), after commit fd995f1.
- **Model:** `jev-1.14.0`, pinned in `convex/drafts.ts` (`model`).
- **Notes:** 38 made-up call notes from `src/lib/jev-set.ts`, with nobody real and only 555-01xx phones. Twelve of them, marked `fresh: true`, were written after the rules were set and were never used to set one. Those 12 give the honest figure.
- **Fields:** four per note: kind of help, amount, who is paid, urgent signs. Each is marked right, blank or wrong against the answer written before any run.
- **Result on the 12 held-out notes, the screens' way (`fresh.mix`):** 42 right, 6 blank, 0 wrong out of 48 fields. Each note's own marks are under `rows[].mix`.
- **Languages of the 12:** 8 English, 2 Spanish (`fresh-es-…`), 2 Haitian Creole (`fresh-ht-…`).

`src/lib/jev-eval.test.ts` counts the 42/6/0 and the 8/2/2 from this file, and checks that they match what the app quotes (`measured` in `src/lib/jev-set.ts`).

## Running it again

Run it against the dev deployment only, never production. The key stays in the deployment's environment:

```sh
npx convex run drafts:measure '{"churchId":"<the sample church id on dev>"}' > eval/jev/run-N.json
```

Save each run beside the earlier ones as a new file. Never overwrite a run.
