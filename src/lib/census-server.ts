import "server-only";
import { CensusError, type NeighborhoodLanguages, parseCensusGov, parseCensusReporter } from "./census";

const RELEASE = "acs2024_5yr";
const cache = new Map<string, { at: number; value: NeighborhoodLanguages }>();
const DAY = 24 * 60 * 60 * 1000;

/**
 * Real ACS 5-year data for one ZIP code tabulation area. With CENSUS_API_KEY set we ask api.census.gov directly
 * (it now requires a free key); otherwise we use Census Reporter's keyless mirror of the same ACS release.
 */
export async function fetchNeighborhood(zip: string): Promise<NeighborhoodLanguages> {
  const hit = cache.get(zip);
  if (hit && Date.now() - hit.at < DAY) return hit.value;
  const key = process.env.CENSUS_API_KEY?.trim();
  let value: NeighborhoodLanguages;
  if (key) {
    const vars = Array.from({ length: 38 }, (_, i) => `C16001_${String(i + 1).padStart(3, "0")}E,C16001_${String(i + 1).padStart(3, "0")}M`).join(",");
    const url = `https://api.census.gov/data/2024/acs/acs5?get=${vars}&for=zip%20code%20tabulation%20area:${zip}&key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: "manual" });
    if (res.status === 204 || res.status === 400) throw new CensusError("not-found", `No Census data for ZIP ${zip}.`);
    if (!res.ok) throw new CensusError("unavailable", "The Census API did not answer. Try again in a minute.");
    value = parseCensusGov(zip, await res.json());
  } else {
    const url = `https://api.censusreporter.org/1.0/data/show/${RELEASE}?table_ids=C16001&geo_ids=86000US${zip}`;
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { Accept: "application/json", "User-Agent": "Neighborly/0.1 (church translation helper; https://github.com/Joe-Simo/neighborly)" } });
    } catch {
      throw new CensusError("unavailable", "The Census data service did not answer. Try again in a minute.");
    }
    const body = await res.json().catch(() => null);
    if (res.status === 403 || res.status === 429 || res.status >= 500) throw new CensusError("unavailable", "The Census data service is busy. Try again in a minute.");
    if (body && typeof body === "object" && "error" in body) throw new CensusError("not-found", `No Census data for ZIP ${zip}. It may not be a residential ZIP code.`);
    if (!res.ok) throw new CensusError("unavailable", "The Census data service did not answer. Try again in a minute.");
    value = parseCensusReporter(zip, body);
  }
  cache.set(zip, { at: Date.now(), value });
  return value;
}
