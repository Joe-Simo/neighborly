import Papa from "papaparse";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";

export type YearReport = FunctionReturnType<typeof api.reports.year>;
export type Kind = YearReport["kinds"][number]["kind"];

/** Plain labels. The Society's own line names take their place when the official form is on hand. */
export const kindLabels: Record<Kind, string> = {
  rent: "Rent",
  utility: "Utilities",
  food: "Food",
  voucher: "Thrift store vouchers",
  other: "Other",
};
const languageLabels = { en: "English", es: "Spanish", ht: "Haitian Creole" } as const;

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
/** A count, or hours and miles to one decimal: "1,282", "177.5". */
export const count = (value: number) => whole.format(value);
/** Whole cents as "$4,675" when there are no cents to show, "$4,675.50" when there are. */
export const money = (cents: number) =>
  cents % 100 === 0 ? dollars.format(cents / 100).slice(0, -3) : dollars.format(cents / 100);
export const plural = (value: number, one: string, many = `${one}s`) =>
  `${count(value)} ${value === 1 ? one : many}`;

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "2025-10" as "October 2025"; short gives "Oct". */
export function monthLabel(month: string, short = false) {
  const name = monthNames[Number(month.slice(5, 7)) - 1];
  return short ? name.slice(0, 3) : `${name} ${month.slice(0, 4)}`;
}
/** "Oct 2025 to Sep 2026" */
export const spanLabel = (report: Pick<YearReport, "firstDay" | "lastDay">) =>
  `${monthLabel(report.firstDay, true)} ${report.firstDay.slice(0, 4)} to ${monthLabel(report.lastDay, true)} ${report.lastDay.slice(0, 4)}`;
export const dayLabel = (day: string) => `${monthNames[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8))}, ${day.slice(0, 4)}`;
/** "October 1, 2025 to September 30, 2026" */
export const longSpanLabel = (report: Pick<YearReport, "firstDay" | "lastDay">) =>
  `${dayLabel(report.firstDay)} to ${dayLabel(report.lastDay)}`;

const quarterNames = ["first", "second", "third", "fourth"];
/** "Fiscal year 2026" or "Fiscal year 2026, second quarter" */
export const periodLabel = (report: Pick<YearReport, "year" | "quarter">) =>
  `Fiscal year ${report.year}${report.quarter ? `, ${quarterNames[report.quarter - 1]} quarter` : ""}`;
/** What to call the stretch of time in a sentence: "year" or "quarter". */
export const periodNoun = (report: Pick<YearReport, "quarter">) => (report.quarter ? "quarter" : "year");

/** True when nothing at all was recorded in the year. */
export const isBlank = (report: YearReport) =>
  report.calls.taken + report.requests.received + report.visits + report.households + report.history.requests + report.vouchers.given === 0 &&
  report.money.received === 0 && report.money.spent === 0 && report.money.beginningBalance === 0 &&
  report.time.shiftHours === 0;

export type ReportLine = {
  section: string;
  line: string;
  /** As a person reads it: "$4,675", "177.5". */
  value: string;
  /** The same as a plain number, dollars for money, for a spreadsheet to add up. */
  number: number;
  /** A ruled total closing its section. */
  total?: true;
};

/** Every line of the year's report, in the order it is printed. The spreadsheet download is these rows. */
export function reportLines(report: YearReport): ReportLine[] {
  const rows: ReportLine[] = [];
  const section = (name: string) => ({
    count: (line: string, value: number) => rows.push({ section: name, line, value: count(value), number: value }),
    money: (line: string, cents: number, total?: true) => rows.push({ section: name, line, value: money(cents), number: cents / 100, ...(total && { total }) }),
  });

  const neighbors = section("Neighbors helped");
  neighbors.count("Households helped", report.households);
  neighbors.count("People in those households", report.people);
  neighbors.count("Adults", report.adults);
  neighbors.count("Children", report.children);
  neighbors.count("Households helped more than once", report.householdsHelpedAgain);
  for (const language of ["en", "es", "ht"] as const)
    if (report.householdsByLanguage[language])
      neighbors.count(`Households speaking ${languageLabels[language]}`, report.householdsByLanguage[language]);

  const visits = section("Home visits");
  visits.count("Home visits made", report.visits);
  visits.count("People helped, counted at each visit", report.peopleVisited);
  visits.count("Hours on visits", report.visitHours);
  visits.count("Miles driven", report.visitMiles);

  const requests = section("Requests for help");
  requests.count("Received", report.requests.received);
  requests.count("Paid", report.requests.paid + report.requests.closedAfterPart.requests);
  if (report.requests.closedAfterPart.requests > 0) {
    requests.count("Of those, paid in part and then closed", report.requests.closedAfterPart.requests);
    requests.money("Paid on those before they closed", report.requests.closedAfterPart.paid);
    requests.money("Approved on those", report.requests.closedAfterPart.approved);
  }
  requests.count("Approved, waiting to be paid", report.requests.approved);
  requests.count("Waiting for a decision", report.requests.open);
  requests.count("Declined", report.requests.declined);
  requests.count("Closed without help", report.requests.closed - report.requests.closedAfterPart.requests);
  requests.count("Referred to other help", report.requests.referred);
  requests.money("Amount asked for", report.requests.amountRequested);
  requests.money("Amount approved", report.requests.amountApproved);
  requests.money("Paid toward these requests", report.requests.paidTowardThese);
  if (report.requests.paidLater.requests > 0 || report.requests.paidLater.amount > 0) {
    requests.count("Paid after the period ended", report.requests.paidLater.requests);
    requests.money("Amount paid after the period ended", report.requests.paidLater.amount);
  }
  requests.money("Paid toward earlier requests", report.requests.paidTowardEarlier);

  const paid = section("Help paid");
  for (const line of report.kinds) paid.money(kindLabels[line.kind], line.paid);
  paid.money("All help paid", report.helpPaid, true);

  // Help brought over from ServWare has no ledger entries, so it stands in a section of its own.
  if (report.history.requests > 0) {
    const history = section("From ServWare history");
    history.count("Requests in the history", report.history.requests);
    history.count("Households in the history", report.history.households);
    for (const line of report.history.kinds)
      if (line.amount) history.money(`${kindLabels[line.kind]}, in the history`, line.amount);
    history.money("All help in the history", report.history.amount);
    history.count("Households helped in all, each counted once", report.history.householdsInAll);
    history.count("People in those households", report.history.peopleInAll);
  }

  if (report.vouchers.given > 0 || report.vouchers.takenBack > 0) {
    const vouchers = section("Vouchers from the shelf");
    vouchers.count("Vouchers given", report.vouchers.given);
    vouchers.count("Taken back, not counted as given", report.vouchers.takenBack);
    vouchers.count("Requests given a voucher", report.vouchers.requests);
    vouchers.count("Households given a voucher", report.vouchers.households);
  }

  const calls = section("Help line");
  calls.count("Calls taken", report.calls.taken);
  calls.count("Calls returned", report.calls.returned);
  calls.count("Waiting for a call back", report.calls.waiting);
  calls.count("No call back needed", report.calls.taken - report.calls.returned - report.calls.waiting);

  const time = section("Time given");
  time.count("Hours on home visits", report.visitHours);
  for (const team of report.time.teams) time.count(`Hours on shifts, ${team.name}`, team.hours);
  time.count("All hours of service", report.time.hours);
  time.count("Miles in service", report.visitMiles);
  time.count("Members who served", report.time.membersServing);
  time.count("Active members today", report.time.activeMembers);

  const funds = section("Cash in and out");
  funds.money("Beginning balance", report.money.beginningBalance);
  for (const source of report.money.sources) funds.money(`Received: ${source.label}`, source.amount);
  funds.money("All money received", report.money.received);
  funds.money("Spent: help paid", report.helpPaid);
  for (const other of report.money.otherSpending) funds.money(`Spent: ${other.label}`, other.amount);
  funds.money("All money spent", report.money.spent);
  funds.money("Ending balance", report.money.endingBalance, true);
  return rows;
}

/** The twelve months as spreadsheet rows, one column per count. */
export function monthLines(report: YearReport) {
  return report.months.map((line) => ({
    Month: monthLabel(line.month),
    "Calls taken": line.calls,
    "Requests received": line.requests,
    "Home visits": line.visits,
    "Households helped": line.households,
    "Help paid": line.paid / 100,
    "Money received": line.moneyIn / 100,
  }));
}

/** Each member who served as a spreadsheet row. Members are volunteers; no neighbor appears here. */
export function memberLines(report: YearReport) {
  return report.time.members.map((line) => ({
    Member: line.name,
    "Home visits": line.visits,
    Shifts: line.shifts,
    Hours: line.hours,
    Miles: line.miles,
  }));
}

/** The year as one CSV file: every line, then the months, then the members. No neighbor is named anywhere in it. */
export function reportCsv(report: YearReport, groupName: string, sample = false) {
  const lines = reportLines(report).map(({ section, line, number }) => [section, line, number]);
  const months = monthLines(report);
  const members = memberLines(report);
  return Papa.unparse([
    [groupName, periodLabel(report), longSpanLabel(report)],
    ...(sample ? [["Sample"]] : []),
    [],
    ["Section", "Line", "Value"],
    ...lines,
    [],
    Object.keys(months[0]),
    ...months.map((row) => Object.values(row)),
    ...(members.length ? [[], Object.keys(members[0]), ...members.map((row) => Object.values(row))] : []),
  ]);
}
export const csvFileName = (report: YearReport, groupName: string) =>
  `${groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report"}-year-${report.year}${report.quarter ? `-quarter-${report.quarter}` : ""}.csv`;
