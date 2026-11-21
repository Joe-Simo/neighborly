/**
 * The one next step the assistant may suggest from a returned call's outcome. "none" is there so it never has to force one,
 * and it is never shown.
 */
export const nextSteps = ["resolved", "request", "refer", "callAgain", "none"] as const;
export type NextStep = (typeof nextSteps)[number];

/**
 * Made-up outcomes of returned calls, each with the one next step a careful person would take from it. Nobody here is real.
 * Written from the outcomes alone before any run; outcomes marked `heldOut` must never be used to set a line or a wording.
 */
export const nextStepSet: { id: string; outcome: string; step: NextStep; heldOut?: true }[] = [
  { id: "paid-up", outcome: "Spoke with her. The pantry already helped and the bill is paid. Nothing else needed.", step: "resolved" },
  { id: "rent-short", outcome: "He is $300 short on rent due the 1st and asked us for help with it.", step: "request" },
  { id: "tenant", outcome: "Landlord is refusing repairs. Gave her the tenant legal aid number; that is the right place.", step: "refer" },
  { id: "no-answer", outcome: "No answer. Left a voicemail, will try again tomorrow.", step: "callAgain" },
  { id: "unclear", outcome: "Talked for a while.", step: "none" },
  { id: "es-done", outcome: "Ya recibió la ayuda de la parroquia. No necesita nada más.", step: "resolved" },
  { id: "es-power", outcome: "Debe $150 de luz y nos pide ayuda para pagarla.", step: "request" },
  { id: "es-later", outcome: "Estaba en el trabajo. Pidió que la llamemos el lunes por la tarde.", step: "callAgain" },
  { id: "ho-food", outcome: "Family has no food until payday and asked if we can help with groceries this week.", step: "request", heldOut: true },
  { id: "ho-county", outcome: "Needs a wheelchair ramp, which we don't do. The county disability office handles ramps.", step: "refer", heldOut: true },
  { id: "ho-es-bien", outcome: "Encontró trabajo y ya pagó la renta. Está bien.", step: "resolved", heldOut: true },
  { id: "ho-busy", outcome: "Line was busy twice. Try again after 5.", step: "callAgain", heldOut: true },
];

/** The last run of drafts:measureNextStep (jev-1.14.0) on the held-out outcomes. */
export const nextStepMeasured = { notes: 4, right: 4, missed: 0, wrong: 0 };
