/**
 * Made-up requests, each with the made-up earlier records of the same household, and which of those earlier records a
 * careful person would point out before approving: the same need asked again (`same`), or a record that says otherwise
 * (`differs`), by position in `earlier`. Nobody here is real. The answers were written from the texts alone before any
 * run. Cases marked `heldOut` must never be used to set a line or a wording: their marks are the honest figure.
 */
interface Earlier { daysBefore: number; text: string }
interface RepeatCase { id: string; request: string; earlier: Earlier[]; same: number[]; differs: number[]; heldOut?: true }

export const repeatSet: RepeatCase[] = [
  {
    id: "same-rent",
    request: "Behind on November rent, $400 short.",
    earlier: [{ daysBefore: 12, text: "Short $400 on November rent after hours were cut." }],
    same: [0], differs: [],
  },
  {
    id: "new-month",
    request: "Short on December rent, $350.",
    earlier: [{ daysBefore: 35, text: "Short on November rent, $400." }],
    same: [], differs: [],
  },
  {
    id: "other-bill",
    request: "Water bill is past due, $90.",
    earlier: [{ daysBefore: 20, text: "Electric bill past due, $160. Shut-off notice for the 15th." }],
    same: [], differs: [],
  },
  {
    id: "lives-alone",
    request: "Lives alone. Needs help with the gas bill, $75.",
    earlier: [{ daysBefore: 40, text: "Visited. Three children live in the home with their mother." }],
    same: [], differs: [0],
  },
  {
    id: "no-income",
    request: "No income at all this month. Rent is $600.",
    earlier: [{ daysBefore: 9, text: "Started a new full-time job at the warehouse last week." }],
    same: [], differs: [0],
  },
  {
    id: "lost-job-later",
    request: "Lost the warehouse job two weeks ago. Rent is $600.",
    earlier: [{ daysBefore: 60, text: "Works full time at the warehouse." }],
    same: [], differs: [],
  },
  {
    id: "already-paid",
    request: "Power bill of $210 is still unpaid and due Friday.",
    earlier: [{ daysBefore: 6, text: "Conference paid the $210 power bill directly to the utility." }],
    same: [0], differs: [0],
  },
  {
    id: "food-again",
    request: "Needs groceries this week.",
    earlier: [{ daysBefore: 7, text: "Gave a grocery voucher for this week." }, { daysBefore: 70, text: "Rent help, $300." }],
    same: [0], differs: [],
  },
  {
    id: "adds-up",
    request: "Two kids at home; needs coats for both.",
    earlier: [{ daysBefore: 30, text: "Mother and two children. Behind on rent." }],
    same: [], differs: [],
  },
  {
    id: "es-same",
    request: "Debe la renta de noviembre, le faltan $500.",
    earlier: [{ daysBefore: 10, text: "Le faltan $500 para la renta de noviembre." }],
    same: [0], differs: [],
  },
  {
    id: "es-differs",
    request: "Vive sola, sin hijos. Pide ayuda con la luz.",
    earlier: [{ daysBefore: 25, text: "En la visita vimos que viven tres niños en la casa." }],
    same: [], differs: [0],
  },
  {
    id: "two-records",
    request: "Behind on the electric bill, $180, for October.",
    earlier: [{ daysBefore: 15, text: "Paid $180 toward the October electric bill." }, { daysBefore: 50, text: "Grandmother lives with them and is on oxygen." }],
    same: [0], differs: [0],
  },
  {
    id: "ho-same-water",
    request: "The same water bill from last week is still open, $95.",
    earlier: [{ daysBefore: 8, text: "Asked for help with the water bill, $95. Declined, pointed to the county program." }],
    same: [0], differs: [], heldOut: true,
  },
  {
    id: "ho-new-need",
    request: "Needs a bed for the youngest child.",
    earlier: [{ daysBefore: 14, text: "Rent help approved, $450." }],
    same: [], differs: [], heldOut: true,
  },
  {
    id: "ho-car",
    request: "Has no car and walks to work. Needs bus passes.",
    earlier: [{ daysBefore: 30, text: "Drove to the office in their own car for the interview." }],
    same: [], differs: [0], heldOut: true,
  },
  {
    id: "ho-es-new-month",
    request: "Pide ayuda con la renta de enero, $400.",
    earlier: [{ daysBefore: 31, text: "Se pagó la renta de diciembre, $400." }],
    same: [], differs: [], heldOut: true,
  },
  {
    id: "ho-es-paid",
    request: "No ha pagado el gas de este mes, $70.",
    earlier: [{ daysBefore: 4, text: "La conferencia pagó el gas de este mes, $70." }],
    same: [0], differs: [0], heldOut: true,
  },
];

/** The last measuring run on the held-out cases (drafts:measureRepeats, jev-1.14.0): one mark per earlier record and question. */
export const repeatsMeasured = { day: "2026-11-21", cases: 5, right: 9, missed: 1, wrong: 0 };
