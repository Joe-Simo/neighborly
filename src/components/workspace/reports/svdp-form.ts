import type { YearReport } from "@/components/workspace/reports/lines";
import type { Language } from "@/lib/words";

/**
 * The Society's Conference Annual Report, line by line, filled from the year's records. Line names follow the national
 * form as councils publish it (the 2017 conference form, with the 2024 treasurer lines where they changed). A line Kind
 * Helps does not keep is marked as not tracked, never estimated. Ledger categories map by the label the ledger stores.
 */
export type FormLine = { code: string; line: string; value: { cents: number } | { count: number } | null; note?: string };
type FormSection = { title: string; lines: FormLine[] };

const said = {
  en: {
    sections: { balance: "Treasurer: balances", receipts: "Treasurer: receipts", expenses: "Treasurer: expenses", visits: "Visits and services to people", goods: "In-kind goods and services", hours: "Hours and miles", served: "Those served, from Kind Helps" },
    lines: {
      begin: "Beginning balance", end: "Ending balance",
      r1: "Donations from members", r2: "Church and poor box collections", r3a: "Fund raising: special works", r3b: "Fund raising: stores", r3c: "Fund raising: special events and other",
      r4: "Other SVdP contributions (twinning received)", r5a: "Qualified government grants", r5b: "Disaster funds", r5c: "Capital campaign funds", r5d: "Other restricted funds", r5e: "Miscellaneous receipts", rTotal: "Total receipts",
      e6: "Those we served", e6rent: "of which rent and eviction prevention", e6utility: "of which utilities", e6food: "of which food", e6other: "of which other help", e7: "Disaster contributions",
      e8: "Twinning sent (domestic and international together)", e10: "Contributions to upper councils (dues)", e11a: "Operating expense: special works", e11b: "Operating expense: stores", e11c: "Operating expense: special events",
      e11d: "Operating expense: other", eTotal: "Total expenses",
      vA: "Home visits", vAPeople: "People helped by home visits", vB: "Prison visits", vC: "Hospital visits", vD: "Eldercare visits", vE: "Other in-person visits",
      gServices: "In-kind services: legal, medical, dental, other", gFood: "In-kind goods: food", gFurniture: "In-kind goods: furniture", gClothing: "In-kind goods: clothing", gOther: "In-kind goods: other (vouchers given from the shelf)",
      hMembers: "Hours of service: members", hOthers: "Hours of service: non-members", miles: "Miles in Vincentian service",
      households: "Households helped", people: "People in those households", activeMembers: "Active members", meetings: "How often the conference meets", bylaws: "Conference bylaws adopted without changes",
    },
    notTracked: "Not tracked in Kind Helps",
    notes: {
      r1: "Donations are not split between members and others; all are under miscellaneous receipts.",
      e8: "Kind Helps does not split domestic from international twinning.",
      miles: "Miles logged on home visits only.",
      gOther: "A count of vouchers; their dollar value is not kept.",
      hMembers: "Home visit hours and finished shift hours.",
    },
  },
  es: {
    sections: { balance: "Tesorería: saldos", receipts: "Tesorería: ingresos", expenses: "Tesorería: gastos", visits: "Visitas y servicios a personas", goods: "Bienes y servicios en especie", hours: "Horas y millas", served: "Personas atendidas, según Kind Helps" },
    lines: {
      begin: "Saldo inicial", end: "Saldo final",
      r1: "Donativos de miembros", r2: "Colectas de la parroquia y alcancía de los pobres", r3a: "Recaudación: obras especiales", r3b: "Recaudación: tiendas", r3c: "Recaudación: eventos especiales y otros",
      r4: "Otras contribuciones de SVdP (hermanamiento recibido)", r5a: "Subvenciones gubernamentales", r5b: "Fondos para desastres", r5c: "Fondos de campaña de capital", r5d: "Otros fondos restringidos", r5e: "Ingresos varios", rTotal: "Total de ingresos",
      e6: "Ayuda a quienes servimos", e6rent: "de ello, renta y prevención de desalojo", e6utility: "de ello, servicios", e6food: "de ello, comida", e6other: "de ello, otra ayuda", e7: "Contribuciones para desastres",
      e8: "Hermanamiento enviado (nacional e internacional juntos)", e10: "Contribuciones a consejos superiores (cuotas)", e11a: "Gasto de operación: obras especiales", e11b: "Gasto de operación: tiendas", e11c: "Gasto de operación: eventos especiales",
      e11d: "Gasto de operación: otros", eTotal: "Total de gastos",
      vA: "Visitas a domicilio", vAPeople: "Personas ayudadas en visitas a domicilio", vB: "Visitas a prisiones", vC: "Visitas a hospitales", vD: "Visitas a personas mayores", vE: "Otras visitas en persona",
      gServices: "Servicios en especie: legales, médicos, dentales, otros", gFood: "Bienes en especie: comida", gFurniture: "Bienes en especie: muebles", gClothing: "Bienes en especie: ropa", gOther: "Bienes en especie: otros (vales entregados)",
      hMembers: "Horas de servicio: miembros", hOthers: "Horas de servicio: no miembros", miles: "Millas en servicio vicentino",
      households: "Hogares ayudados", people: "Personas en esos hogares", activeMembers: "Miembros activos", meetings: "Con qué frecuencia se reúne la conferencia", bylaws: "Estatutos de la conferencia adoptados sin cambios",
    },
    notTracked: "Kind Helps no lo registra",
    notes: {
      r1: "Los donativos no se separan entre miembros y otras personas; todos están en ingresos varios.",
      e8: "Kind Helps no separa el hermanamiento nacional del internacional.",
      miles: "Solo las millas registradas en visitas a domicilio.",
      gOther: "Una cuenta de vales; su valor en dólares no se guarda.",
      hMembers: "Horas de visitas a domicilio y de turnos terminados.",
    },
  },
} satisfies Record<Language, unknown>;

export const notTracked = (language: Language) => said[language].notTracked;

/** Ledger labels as the ledger stores them (convex/treasury.ts incomeSources and spendingKinds). */
const ledger = { collection: "Parish collection", walk: "Friends of the Poor Walk", twinningIn: "Twinning received", opening: "Opening balance", twinningOut: "Twinning gift", pantry: "Pantry purchase", dues: "Council dues" };

export function svdpForm(report: YearReport, language: Language): FormSection[] {
  const { sections: s, lines: l, notes: n } = said[language];
  const cents = (value: number) => ({ cents: value });
  const count = (value: number) => ({ count: value });
  const amount = (list: { label: string; amount: number }[], label: string) => list.find((one) => one.label === label)?.amount ?? 0;
  const sources = report.money.sources.filter((one) => one.label !== ledger.opening);
  const known = new Set<string>([ledger.collection, ledger.walk, ledger.twinningIn]);
  const misc = sources.filter((one) => !known.has(one.label)).reduce((sum, one) => sum + one.amount, 0);
  const spending = report.money.otherSpending;
  const pantry = amount(spending, ledger.pantry);
  const kind = (k: string) => report.kinds.find((one) => one.kind === k)?.paid ?? 0;
  const operating = spending.filter((one) => ![ledger.twinningOut, ledger.pantry, ledger.dues].includes(one.label)).reduce((sum, one) => sum + one.amount, 0);
  const none = (code: string, line: string, note?: string): FormLine => ({ code, line, value: null, ...(note && { note }) });
  return [
    { title: s.balance, lines: [{ code: "", line: l.begin, value: cents(report.money.beginningBalance) }, { code: "", line: l.end, value: cents(report.money.endingBalance) }] },
    { title: s.receipts, lines: [
      none("1", l.r1, n.r1),
      { code: "2", line: l.r2, value: cents(amount(sources, ledger.collection)) },
      none("3A", l.r3a), none("3B", l.r3b),
      { code: "3C", line: l.r3c, value: cents(amount(sources, ledger.walk)) },
      { code: "4", line: l.r4, value: cents(amount(sources, ledger.twinningIn)) },
      none("5A", l.r5a), none("5B", l.r5b), none("5C", l.r5c), none("5D", l.r5d),
      { code: "5E", line: l.r5e, value: cents(misc) },
      { code: "", line: l.rTotal, value: cents(report.money.received) },
    ] },
    { title: s.expenses, lines: [
      { code: "6", line: l.e6, value: cents(report.helpPaid + pantry) },
      { code: "", line: l.e6rent, value: cents(kind("rent")) },
      { code: "", line: l.e6utility, value: cents(kind("utility")) },
      { code: "", line: l.e6food, value: cents(kind("food") + pantry) },
      { code: "", line: l.e6other, value: cents(kind("other") + kind("voucher")) },
      none("7", l.e7),
      { code: "8", line: l.e8, value: cents(amount(spending, ledger.twinningOut)), note: n.e8 },
      { code: "10", line: l.e10, value: cents(amount(spending, ledger.dues)) },
      none("11A", l.e11a), none("11B", l.e11b), none("11C", l.e11c),
      { code: "11D", line: l.e11d, value: cents(operating) },
      { code: "", line: l.eTotal, value: cents(report.money.spent) },
    ] },
    { title: s.visits, lines: [
      { code: "A", line: l.vA, value: count(report.visits) },
      { code: "A", line: l.vAPeople, value: count(report.peopleVisited) },
      none("B", l.vB), none("C", l.vC), none("D", l.vD), none("E", l.vE),
    ] },
    { title: s.goods, lines: [
      none("F–I", l.gServices), none("J", l.gFood), none("K", l.gFurniture), none("L", l.gClothing),
      { code: "M", line: l.gOther, value: count(report.vouchers.given), note: n.gOther },
    ] },
    { title: s.hours, lines: [
      { code: "", line: l.hMembers, value: count(report.time.hours), note: n.hMembers },
      none("", l.hOthers),
      { code: "", line: l.miles, value: count(report.visitMiles), note: n.miles },
    ] },
    { title: s.served, lines: [
      { code: "", line: l.households, value: count(report.households) },
      { code: "", line: l.people, value: count(report.people) },
      { code: "", line: l.activeMembers, value: count(report.time.activeMembers) },
      none("", l.meetings), none("", l.bylaws),
    ] },
  ];
}
