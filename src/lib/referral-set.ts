/**
 * Made-up request notes and made-up places, each note with the places a careful person would offer, to measure the
 * referral question against the live model. Nobody and nothing here is real. The answers were written from the notes
 * alone before any run. Notes marked `heldOut` must never be used to set a line or a wording: their marks are the honest figure.
 */
export const referralPlaces = {
  food: "Groceries on Tuesdays and Thursdays, no appointment",
  energy: "Electric and gas bills, once a year for each household",
  legal: "Eviction notices and tenant questions",
  nurse: "Prescriptions, blood pressure checks, rides to the clinic",
  clothes: "Coats, shoes and clothing for children and adults",
  jobs: "Help finding work and writing a résumé",
} as const;
export type ReferralPlace = keyof typeof referralPlaces;

interface ReferralNote { id: string; note: string; fits: ReferralPlace[]; heldOut?: true }

export const referralSet: ReferralNote[] = [
  { id: "power-food", note: "Behind on the power bill, $210, and nothing in the fridge this week.", fits: ["energy", "food"] },
  { id: "eviction", note: "Landlord gave an eviction notice for the 30th. Owes $650 rent.", fits: ["legal"] },
  { id: "insulin", note: "Can't afford insulin this month. Also asked about the water bill.", fits: ["nurse"] },
  { id: "coat", note: "Two kids need winter coats and shoes.", fits: ["clothes"] },
  { id: "rent-only", note: "Rent is $500 short after hours were cut.", fits: [] },
  { id: "denial", note: "Has food. Only calling about the gas bill, $80.", fits: ["energy"] },
  { id: "es-food", note: "No tiene comida en casa. Pide ayuda con la renta.", fits: ["food"] },
  { id: "es-eviction", note: "Recibió aviso de desalojo. Debe $700 de renta.", fits: ["legal"] },
  { id: "es-power", note: "Le van a cortar la luz el viernes. Debe $150.", fits: ["energy"] },
  { id: "maybe-job", note: "Lost his job last week; rent due Friday.", fits: ["jobs"] },
  { id: "ho-clinic", note: "Needs a ride to dialysis on Monday and help with groceries.", fits: ["nurse", "food"], heldOut: true },
  { id: "ho-maybe", note: "Might need help with the electric bill next month. Asking about a pantry for now.", fits: ["food"], heldOut: true },
  { id: "ho-es-ropa", note: "Perdió la ropa en un incendio. Busca trabajo.", fits: ["clothes", "jobs"], heldOut: true },
  { id: "ho-es-none", note: "Pregunta a qué hora abre la oficina.", fits: [], heldOut: true },
  { id: "ho-tenant", note: "Landlord won't fix the heat and threatens to evict. Kids are cold.", fits: ["legal"], heldOut: true },
];

