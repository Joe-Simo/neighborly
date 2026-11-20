/**
 * The kind of help each of the year's requests asked for, month by month (October first), one letter a request: r rent, u utility, f food,
 * v voucher, o other. In the order they came in, with a month's still-waiting requests last, as the year in paper lays its slips
 * (year-paper.ts). Checked against the sample's own requests by convex/sampleYear.test.ts, like every figure in sample-year.ts.
 * Kept apart from it so the home page's first load does not carry it: only the year's canvas reads it, once it is near.
 */
export const kindsByMonth: readonly string[] = [
  "ruoufurouorvurur",
  "ururuuuufuuu",
  "ufruurovfruvffvufuurrfououurour",
  "vfouuufffouuffvuurrurufouvrvvu",
  "rvfuoouvuofvfrruruforo",
  "roruuvrururruufufruufvrrrrufuuffrffu",
  "ouruvfffvrvooffrrrouuuuuurvruff",
  "ruourrfurfrvrfuruufrvfrouurfuuuuuuvfofurf",
  "frrrvrfoorfoouffurufrfuuruof",
  "ofuuruuufofffurforuffuurvufrfrrfururfufruvrr",
  "urruffvuuufufufrfuurruourrfffffuuuvfffu",
  "vufuuuuuvuvfrurvruuufvvuouofrfuuforuufru",
];

/** The kinds' names, as the Reports room says them (words/rooms/reports.ts), said under the year's title when a slip is pointed at. */
export const kindNames = {
  en: { r: "Rent", u: "Utilities", f: "Food", v: "Thrift store vouchers", o: "Other help" },
  es: { r: "Alquiler", u: "Servicios", f: "Comida", v: "Vales para la tienda de segunda mano", o: "Otra ayuda" },
} satisfies Record<"en" | "es", Record<string, string>>;
