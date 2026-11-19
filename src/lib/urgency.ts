export const urgentReasons = ["shutoff", "eviction", "noFood", "hungry", "child", "elder", "alone", "medical"] as const;
export type UrgentReason = (typeof urgentReasons)[number];
/**
 * Each kind stands for one thing a note can say, so the reason shown to a person never says more
 * than the note does: living alone is not being elderly, and being hungry is not having no food.
 */
/** One sign that a call should be returned first, with the day of the month the note gives for it, if any. */
export type UrgentSign = { reason: UrgentReason; day: number | null };

const signs: Record<UrgentReason, RegExp> = {
  shutoff: /\b(?:shut[- ]?off|disconnect(?:ion|ed)?|cut[- ]?off|turned off|corte de (?:luz|agua))\b/i,
  eviction: /\b(?:evict(?:ion|ed)?|notice to vacate|three[- ]day notice|3[- ]day notice|desalojo)\b/i,
  noFood: /\b(?:no food|nothing to eat|out of food|sin comida)\b/i,
  hungry: /\b(?:hungry|hasn't eaten|haven't eaten|has not eaten|have not eaten|con hambre)\b/i,
  child: /\b(?:bab(?:y|ies)|infant|newborn|toddler|child(?:ren)?|kids?|ni[ñn]os?)\b/i,
  elder: /\b(?:elderly|8\d years old|9\d years old|in (?:her|his) (?:eighties|nineties))\b/i,
  alone: /\b(?:lives? alone|living alone|on (?:her|his|their) own|vive sola?)\b/i,
  medical: /\b(?:oxygen|insulin|dialysis|medication|medicine|wheelchair|hospital)\b/i,
};
const unsure = /\?|\b(?:not|no longer|never|n't|if|maybe|might|unless)\b/i;
const dayPattern = /\b(?:on|by|for|before)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/i;

/**
 * Signs a note states plainly. Code proposes them; nothing here decides who is helped.
 * "No food" and "hasn't eaten" are themselves negations, so they are read before the doubt check.
 */
export function urgentSigns(note: string): UrgentSign[] {
  const found = new Map<UrgentReason, number | null>();
  for (const clause of note.replace(/\?/g, "?\n").replace(/([.!;])\s+/g, "$1\n").split(/\n+/).map((part) => part.trim()).filter(Boolean)) {
    for (const reason of urgentReasons) {
      if (!signs[reason].test(clause)) continue;
      const negation = reason === "noFood" || reason === "hungry";
      if (!negation && unsure.test(clause)) continue;
      if (negation && /\?|\b(?:if|maybe|might|unless)\b/i.test(clause)) continue;
      const day = reason === "shutoff" || reason === "eviction" ? Number(dayPattern.exec(clause)?.[1] ?? 0) : 0;
      if (!found.has(reason) || (day && !found.get(reason))) found.set(reason, day >= 1 && day <= 31 ? day : null);
    }
  }
  return urgentReasons.flatMap((reason) => (found.has(reason) ? [{ reason, day: found.get(reason) ?? null }] : []));
}
