import type { RequestKind } from "./request-draft";
import type { UrgentReason } from "./urgency";

/**
 * Made-up home-visit notes with what a careful person would say each shows: one kind of help the visit was not for
 * (or none), and the urgent signs. Nobody here is real. Written from the notes alone before any run; notes marked
 * `heldOut` must never be used to set a line or a wording.
 */
interface VisitNote { id: string; note: string; kind: RequestKind | null; signs: UrgentReason[]; heldOut?: true }

export const visitSet: VisitNote[] = [
  { id: "empty-kitchen", note: "Kitchen was empty, no food in the house. Two kids at home.", kind: "food", signs: ["noFood", "child"] },
  { id: "all-well", note: "Rent was paid with our check. Family is doing well, nothing else needed.", kind: null, signs: [] },
  { id: "shutoff", note: "Gas bill is $120 and the company will shut it off on the 3rd.", kind: "utility", signs: ["shutoff"] },
  { id: "oxygen", note: "Her husband is on oxygen and they need help with the power bill.", kind: "utility", signs: ["medical"] },
  { id: "beds", note: "The children sleep on the floor. They need two beds.", kind: "voucher", signs: ["child"] },
  { id: "alone-elder", note: "She is 84 and lives alone. Fridge has food. No other need today.", kind: null, signs: ["elder", "alone"] },
  { id: "es-food", note: "No había comida en la casa. Tres niños.", kind: "food", signs: ["noFood", "child"] },
  { id: "es-none", note: "Pagamos la renta. La familia está bien.", kind: null, signs: [] },
  { id: "ho-insulin", note: "Ran out of insulin. Asked about a ride to the clinic. Lives alone.", kind: "other", signs: ["medical", "alone"], heldOut: true },
  { id: "ho-maybe", note: "Might need help with rent next month if hours are cut. Food is fine.", kind: null, signs: [], heldOut: true },
  { id: "ho-es-luz", note: "Le cortaron la luz ayer. Hay un bebé en la casa.", kind: "utility", signs: ["shutoff", "child"], heldOut: true },
  { id: "ho-hungry", note: "The kids had not eaten since yesterday. Mom asked about a coat too.", kind: null, signs: ["hungry", "child"], heldOut: true },
];


/** The last run of drafts:measureVisits (jev-1.14.0) on the held-out notes: the kind and each of eight signs, per note. */
export const visitsMeasured = { day: "2026-11-21", notes: 4, right: 33, missed: 3, wrong: 0 };
