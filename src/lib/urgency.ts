export const urgentReasons = ["shutoff", "eviction", "noFood", "child", "elder", "medical"] as const;
export type UrgentReason = (typeof urgentReasons)[number];
/** One sign that a call should be returned first, with the day of the month the note gives for it, if any. */
export type UrgentSign = { reason: UrgentReason; day: number | null };

const signs: Record<UrgentReason, RegExp> = {
  shutoff: /\b(?:shut[- ]?off|disconnect(?:ion|ed)?|cut[- ]?off|turned off|corte de (?:luz|agua))\b/i,
  eviction: /\b(?:evict(?:ion|ed)?|notice to vacate|three[- ]day notice|3[- ]day notice|desalojo)\b/i,
  noFood: /\b(?:no food|nothing to eat|out of food|hungry|hasn't eaten|have not eaten|sin comida)\b/i,
  child: /\b(?:bab(?:y|ies)|infant|newborn|toddler|child(?:ren)?|kids?|ni[ñn]os?)\b/i,
  elder: /\b(?:elderly|lives alone|8\d years old|9\d years old|in (?:her|his) (?:eighties|nineties))\b/i,
  medical: /\b(?:oxygen|insulin|dialysis|medication|medicine|wheelchair|hospital)\b/i,
};
const unsure = /\?|\b(?:not|no longer|never|n't|if|maybe|might|unless)\b/i;
const dayPattern = /\b(?:on|by|for|before)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/i;

/**
 * Signs a note states plainly. Code proposes them; nothing here decides who is helped.
 * "No food" is itself a negation, so it is read before the doubt check.
 */
export function urgentSigns(note: string): UrgentSign[] {
  const found = new Map<UrgentReason, number | null>();
  for (const clause of note.split(/(?<=\?)|(?<=[.!;])\s+|\n+/).map((part) => part.trim()).filter(Boolean)) {
    for (const reason of urgentReasons) {
      if (!signs[reason].test(clause)) continue;
      if (reason !== "noFood" && unsure.test(clause)) continue;
      if (reason === "noFood" && /\?|\b(?:if|maybe|might|unless)\b/i.test(clause)) continue;
      const day = reason === "shutoff" || reason === "eviction" ? Number(dayPattern.exec(clause)?.[1] ?? 0) : 0;
      if (!found.has(reason) || (day && !found.get(reason))) found.set(reason, day >= 1 && day <= 31 ? day : null);
    }
  }
  return urgentReasons.flatMap((reason) => (found.has(reason) ? [{ reason, day: found.get(reason) ?? null }] : []));
}
