/**
 * Made-up help-line notes, each marked with whether a careful person would say the caller needs Spanish, to measure
 * the Spanish question against the live model. Nobody here is real. The answers were written from the notes alone
 * before any run. Notes marked `heldOut` must never be used to set a line or a wording: their marks are the honest figure.
 */
interface SpanishNote { id: string; note: string; spanish: boolean; heldOut?: true }

export const spanishSet: SpanishNote[] = [
  { id: "es-luz", note: "Le van a cortar la luz el viernes. Debe $150.", spanish: true },
  { id: "en-says", note: "Caller speaks Spanish only. Needs help with rent.", spanish: true },
  { id: "en-power", note: "Behind on the power bill, $210, and nothing in the fridge this week.", spanish: false },
  { id: "es-comida", note: "No tiene comida en casa. Pide ayuda con la renta.", spanish: true },
  { id: "en-taco", note: "Asked about the taco night at the pantry. English is fine.", spanish: false },
  { id: "en-other", note: "Speaks Portuguese; her son will translate. Gas bill $90.", spanish: false },
  { id: "ho-mixed", note: "Left a voicemail mostly in Spanish, something about the water bill.", spanish: true, heldOut: true },
  { id: "ho-es-ropa", note: "Perdió la ropa en un incendio. Busca trabajo.", spanish: true, heldOut: true },
  { id: "ho-en-rent", note: "Rent is $500 short after hours were cut.", spanish: false, heldOut: true },
  { id: "ho-en-learning", note: "Says she is learning Spanish at night school; needs a coat for her son.", spanish: false, heldOut: true },
];

/** The last run of drafts:measureSpanish (jev-1.14.0) on the held-out notes. */
export const spanishMeasured = { notes: 4, right: 3, missed: 1, wrong: 0 };
