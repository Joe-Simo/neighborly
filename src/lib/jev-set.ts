import type { DraftPayeeKind, RequestKind } from "./request-draft";
import type { UrgentSign } from "./urgency";

/**
 * Made-up call notes with the answer a careful person would accept for each, used to measure the
 * assistant against the live model. Nobody here is real, and every phone is a 555-01xx number.
 * The answers were written from the notes alone, before any run, and are not adjusted to make a run pass.
 */
export interface SetNote {
  id: string;
  /** What the note is there to try. */
  tries: string;
  note: string;
  kind: RequestKind | null;
  /** In cents. */
  amount: number | null;
  payeeKind: DraftPayeeKind | null;
  signs: UrgentSign[];
}

const sign = (reason: UrgentSign["reason"], day: number | null = null): UrgentSign => ({ reason, day });

export const jevSet: SetNote[] = [
  { id: "rent-eviction", tries: "Rent in figures, a landlord, a dated eviction, living alone", note: "Marisol Vega called. Behind on November rent, $450. The landlord is Sample Property Co. She has an eviction notice for the 21st and lives alone.", kind: "rent", amount: 45000, payeeKind: "landlord", signs: [sign("eviction", 21), sign("alone")] },
  { id: "power-shutoff", tries: "Utility bill in figures, a dated shut-off, children", note: "Power bill of $186.40 with a shut-off on the 24th. Two kids at home. Lives at 14 Example Lane.", kind: "utility", amount: 18640, payeeKind: null, signs: [sign("shutoff", 24), sign("child")] },
  { id: "food-info", tries: "A question for information, and a maybe about rent", note: "Asked about food. Is there a pantry on Saturdays? She might need help with rent later.", kind: "food", amount: null, payeeKind: null, signs: [] },
  { id: "water-words", tries: "An amount written in words, a named utility, a phone number", note: "Earl Jennings, (239) 555-0178. Water bill is two hundred twelve dollars, owed to Sample Water Utility.", kind: "utility", amount: 21200, payeeKind: "utility", signs: [] },
  { id: "no-food", tries: "Food with no amount, no food in the house, children", note: "No food in the house since Tuesday. Three children.", kind: "food", amount: null, payeeKind: null, signs: [sign("noFood"), sign("child")] },
  { id: "goods", tries: "Household goods, no amount", note: "Lost her furniture in a fire. Needs a bed and a winter coat.", kind: "voucher", amount: null, payeeKind: null, signs: [] },
  { id: "other-bus", tries: "A need outside the four named kinds", note: "Needs a bus pass to get to a new job. $40 for the month.", kind: "other", amount: 4000, payeeKind: null, signs: [] },
  { id: "denial", tries: "A denial: nothing is asked for", note: "Not behind on rent. Called to ask when the office is open.", kind: null, amount: null, payeeKind: null, signs: [] },
  { id: "ask-food", tries: "A request worded as a question", note: "Could you help with food?", kind: "food", amount: null, payeeKind: null, signs: [] },
  { id: "maybe", tries: "A maybe: nothing is asked for now", note: "Might need help with the electric bill next month if her hours are cut.", kind: null, amount: null, payeeKind: null, signs: [] },
  { id: "mixed", tries: "Two needs and two amounts: a person must choose", note: "Behind on rent, $600, and the gas bill, $95. Landlord wants it by Friday.", kind: null, amount: null, payeeKind: "landlord", signs: [] },
  { id: "es-food", tries: "Spanish: no food, children", note: "Dice que no tiene comida en casa. Dos niños.", kind: "food", amount: null, payeeKind: null, signs: [sign("noFood"), sign("child")] },
  { id: "es-rent", tries: "Spanish: rent in figures, a dated eviction", note: "Debe la renta de noviembre, $700. Tiene aviso de desalojo para el 28.", kind: "rent", amount: 70000, payeeKind: null, signs: [sign("eviction", 28)] },
  { id: "ht-food", tries: "Creole: no food, children", note: "Li di li pa gen manje. De timoun nan kay la.", kind: "food", amount: null, payeeKind: null, signs: [sign("noFood"), sign("child")] },
  { id: "ht-power", tries: "Creole: power bill in figures, a dated shut-off", note: "Bòdwo kouran an se $130. Y ap koupe kouran an 19 la.", kind: "utility", amount: 13000, payeeKind: null, signs: [sign("shutoff", 19)] },
  { id: "elder-oxygen", tries: "An age, a medical need, a shut-off with no date", note: "He is 84 years old and on oxygen. Electric bill $240, shut-off notice came Monday.", kind: "utility", amount: 24000, payeeKind: null, signs: [sign("shutoff"), sign("elder"), sign("medical")] },
  { id: "hungry", tries: "Has not eaten, which is not the same as no food", note: "She hasn't eaten since Sunday. Asked for a grocery card.", kind: "food", amount: null, payeeKind: null, signs: [sign("hungry")] },
  { id: "thanks", tries: "Nothing useful", note: "Called to say thank you for the visit last week.", kind: null, amount: null, payeeKind: null, signs: [] },
  { id: "gas-no-shutoff", tries: "A named utility, cents, and a shut-off that is denied", note: "Owes $315.20 to Sample Gas Company for gas. No shut-off yet.", kind: "utility", amount: 31520, payeeKind: "utility", signs: [] },
  { id: "all-denied", tries: "Every urgent sign named and denied", note: "Rent is $525, due to the landlord, Sample Homes. Not elderly, no children, not evicted.", kind: "rent", amount: 52500, payeeKind: "landlord", signs: [] },
  { id: "three-amounts", tries: "Three amounts, one of them the need", note: "Rent is $800 but she can pay $300, so she needs $500.", kind: "rent", amount: 50000, payeeKind: null, signs: [] },
  { id: "car-repair", tries: "Another need with a business that is paid", note: "Car repair so he can keep his job, $380, paid to Sample Auto Shop.", kind: "other", amount: 38000, payeeKind: "vendor", signs: [] },
  { id: "someone-else", tries: "A sign that belongs to another household", note: "Her sister across town has no food, but she herself is fine. Called about her own water bill, $60.", kind: "utility", amount: 6000, payeeKind: null, signs: [] },
];
