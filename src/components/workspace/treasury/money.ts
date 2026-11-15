const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** Whole cents as dollars and cents, "$1,875.60". */
export function formatCents(cents: number) {
  return dollars.format(cents / 100);
}

/** Whole cents as a plain amount for a form field, "1875.60". */
export function centsToInput(cents: number) {
  return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/**
 * Reads what a person typed, "1,875.60" or "$48" or "12.5", as whole cents.
 * The digits are read as text, never multiplied as a decimal, so no cent is
 * gained or lost. Anything else, including a third decimal place, is null.
 */
export function parseCents(text: string) {
  const match = /^\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(
    text.trim(),
  );
  if (!match) return null;
  const cents =
    Number(match[1].replaceAll(",", "")) * 100 +
    Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

/** For the large figures: whole dollars drop the ".00", "$2,150". */
export function formatFigure(cents: number) {
  return cents % 100 === 0 ? formatCents(cents).slice(0, -3) : formatCents(cents);
}
