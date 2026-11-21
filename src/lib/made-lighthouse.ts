import file from "../../eval/lighthouse/freeze.json";

type Run = { form: "mobile" | "desktop"; url: string; at: string; version: string; scores: [number, number, number, number]; lcpMs: number };

/**
 * Lighthouse at the freeze, run by run, from eval/lighthouse/freeze.json, which scripts/lighthouse-freeze.mts writes from Lighthouse's
 * own reports. The page prints only what is in that file: until the freeze's runs are in it, the page shows no Lighthouse numbers at all.
 */
export const madeLighthouse = { commit: file.commit, runs: file.runs as Run[] };
