/**
 * Made-up ledger memos, each with the category it was booked under and whether a careful treasurer would say the memo
 * describes spending on something else, to measure the month check's question against the live model. Nobody and
 * nothing here is real. The answers were written from the memos alone before any run. Memos marked `heldOut` must never
 * be used to set a line or a wording: their marks are the honest figure.
 */
/** `fresh`: written after run 2, when the held-out rows had been seen. Never looked at to set a rule; only these are quoted. */
interface LedgerMemo { id: string; memo: string; category: string; off: boolean; heldOut?: true; fresh?: true }

export const ledgerSet: LedgerMemo[] = [
  { id: "rent-fits", memo: "October rent for the family on 3rd Street, check to landlord.", category: "rent", off: false },
  { id: "rent-car", memo: "Brake repair so he can keep driving to work.", category: "rent", off: true },
  { id: "utility-fits", memo: "Past-due electric bill, shut-off avoided.", category: "utility", off: false },
  { id: "utility-food", memo: "Groceries for the week at the corner market.", category: "utility", off: true },
  { id: "food-fits", memo: "Gift cards for groceries, two weeks.", category: "food", off: false },
  { id: "voucher-bed", memo: "Twin bed and mattress from the thrift store.", category: "voucher", off: false },
  { id: "food-motel", memo: "Two nights at a motel after the fire.", category: "food", off: true },
  { id: "es-rent-fits", memo: "Renta de noviembre, pagada al dueño.", category: "rent", off: false },
  { id: "es-utility-rent", memo: "Depósito para el nuevo apartamento.", category: "utility", off: true },
  { id: "ho-utility-gas", memo: "Gas bill, balance from last winter.", category: "utility", off: false, heldOut: true },
  { id: "ho-rent-phone", memo: "New phone after hers was stolen.", category: "rent", off: true, heldOut: true },
  { id: "ho-es-food", memo: "Comida para la despensa, compra del mes.", category: "food", off: false, heldOut: true },
  { id: "ho-es-food-medicine", memo: "Medicinas de la farmacia para la abuela.", category: "food", off: true, heldOut: true },
  { id: "ho-voucher-fits", memo: "Winter coats for three children.", category: "voucher", off: false, heldOut: true },
  { id: "fr-utility-water", memo: "Water bill, two months behind.", category: "utility", off: false, fresh: true },
  { id: "fr-food-gas", memo: "Gas for the car to get to dialysis.", category: "food", off: true, fresh: true },
  { id: "fr-rent-latefee", memo: "Late fee and November balance owed to the landlord.", category: "rent", off: false, fresh: true },
  { id: "fr-voucher-rent", memo: "Half of December rent, check to the property manager.", category: "voucher", off: true, fresh: true },
  { id: "fr-es-luz", memo: "Pago de la luz para evitar el corte.", category: "utility", off: false, fresh: true },
  { id: "fr-es-food-bus", memo: "Pases de autobús para ir al trabajo.", category: "food", off: true, fresh: true },
  { id: "fr-voucher-dresser", memo: "Dresser and kitchen table from the thrift store.", category: "voucher", off: false, fresh: true },
  // Written after run 3, before any run saw them.
  { id: "fr-rent-motel", memo: "Two nights at the motel until the lease starts.", category: "rent", off: false, fresh: true },
  { id: "fr-utility-tires", memo: "Two used tires so he can keep driving for work.", category: "utility", off: true, fresh: true },
  { id: "fr-food-formula", memo: "Baby formula and diapers for the week.", category: "food", off: false, fresh: true },
  { id: "fr-food-lightbill", memo: "Paid the electric company so the power stays on.", category: "food", off: true, fresh: true },
  { id: "fr-utility-propane", memo: "Propane tank refill for heat.", category: "utility", off: false, fresh: true },
  { id: "fr-voucher-glasses", memo: "Eye exam and glasses at the optometrist.", category: "voucher", off: true, fresh: true },
  { id: "fr-voucher-shoes", memo: "Work boots and two uniforms for the new job.", category: "voucher", off: false, fresh: true },
  { id: "fr-rent-funeral", memo: "Part of the funeral home bill for her husband.", category: "rent", off: true, fresh: true },
  { id: "fr-es-renta", memo: "Mitad de la renta de enero, cheque al administrador.", category: "rent", off: false, fresh: true },
  { id: "fr-es-food-rent", memo: "Depósito de seguridad del apartamento nuevo.", category: "food", off: true, fresh: true },
  { id: "fr-es-agua", memo: "Factura del agua atrasada, aviso de corte.", category: "utility", off: false, fresh: true },
  { id: "fr-es-voucher-dentist", memo: "Extracción de una muela en el dentista.", category: "voucher", off: true, fresh: true },
];

/** The last measured run of the fresh memos with the rule the month check uses (offLine in convex/drafts.ts). */
export const ledgerMeasured = { day: "2026-11-21", notes: 19, right: 18, missed: 1, wrong: 0 };
