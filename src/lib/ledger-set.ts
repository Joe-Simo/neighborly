/**
 * Made-up ledger memos, each with the category it was booked under and whether a careful treasurer would say the memo
 * describes spending on something else, to measure the month check's question against the live model. Nobody and
 * nothing here is real. The answers were written from the memos alone before any run. Memos marked `heldOut` must never
 * be used to set a line or a wording: their marks are the honest figure.
 */
interface LedgerMemo { id: string; memo: string; category: string; off: boolean; heldOut?: true }

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
];
