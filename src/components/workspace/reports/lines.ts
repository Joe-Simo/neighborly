import Papa from "papaparse";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";
import { formatDate, words as book, type Words } from "@/lib/words";
import { fill } from "@/lib/words/fill";
import { categoryLabel } from "@/components/workspace/treasury/labels";
import { formatCount, formatMoney } from "@/lib/words/numbers";
import type { Language } from "@/lib/words";

export type YearReport = FunctionReturnType<typeof api.reports.year>;
export type Kind = YearReport["kinds"][number]["kind"];

/** The words of one person: their language, and the report's own table. English when no one is asked for. */
const english = book();
type Kinds = Record<Kind, string>;
/** Plain labels. The Society's own line names take their place when the official form is on hand. */
export const kindLabels = (words: Words = english): Kinds => words.rooms.reports.kindNames;

/** A count, or hours and miles to one decimal: "1,282", "177.5". */
export const count = (value: number, language: Language = "en") => formatCount(value, language);
/** Whole cents as "$4,675" when there are no cents to show, "$4,675.50" when there are. */
export const money = (cents: number, language: Language = "en") => formatMoney(cents / 100, language, cents % 100 === 0);

/** Noon on a calendar day ("2025-10-01") or in the middle of a month ("2025-10"), which is the same day in every time zone. */
const noon = (day: string) => Date.parse(`${day.length === 7 ? `${day}-15` : day}T12:00:00Z`);
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
/** "2025-10" as "October 2025"; short gives "Oct". The month's name is the language's own, from the date formatter. */
export function monthLabel(month: string, short = false, words: Words = english) {
  return capital(
    formatDate(words.locale, noon(month.slice(0, 7)), short ? { timeZone: "UTC", month: "short" } : { timeZone: "UTC", month: "long", year: "numeric" }),
  );
}
/** "Oct 2025 to Sep 2026" */
export const spanLabel = (report: Pick<YearReport, "firstDay" | "lastDay">, words: Words = english) =>
  fill(words.rooms.reports.period.span, {
    from: formatDate(words.locale, noon(report.firstDay), { timeZone: "UTC", month: "short", year: "numeric" }),
    to: formatDate(words.locale, noon(report.lastDay), { timeZone: "UTC", month: "short", year: "numeric" }),
  });
export const dayLabel = (day: string, words: Words = english) =>
  formatDate(words.locale, noon(day), { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });
/** "October 1, 2025 to September 30, 2026"; a year still running can add ", so far". */
export const longSpanLabel = (report: Pick<YearReport, "firstDay" | "lastDay">, words: Words = english, soFar = false) =>
  fill(soFar ? words.rooms.reports.period.longSpanSoFar : words.rooms.reports.period.longSpan, {
    from: dayLabel(report.firstDay, words),
    to: dayLabel(report.lastDay, words),
  });

/** "Fiscal year 2026" or "Fiscal year 2026, second quarter" */
export const periodLabel = (report: Pick<YearReport, "year" | "quarter">, words: Words = english) => {
  const period = words.rooms.reports.period;
  return (report.quarter ? [period.q1, period.q2, period.q3, period.q4][report.quarter - 1] : period.year)(report.year);
};

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
/** `said` gives the sample's own names (its teams, its money's sources) in the reader's language, as the rooms do. */
export function reportLines(report: YearReport, words: Words = english, said: (name: string) => string = (name) => name): ReportLine[] {
  const w = words.rooms.reports.rows;
  const kinds = kindLabels(words);
  const rows: ReportLine[] = [];
  const section = (name: string) => ({
    count: (line: string, value: number) => rows.push({ section: name, line, value: count(value), number: value }),
    money: (line: string, cents: number, total?: true) => rows.push({ section: name, line, value: money(cents), number: cents / 100, ...(total && { total }) }),
  });

  const neighbors = section(w.neighbors.section);
  neighbors.count(w.neighbors.households, report.households);
  neighbors.count(w.neighbors.people, report.people);
  neighbors.count(w.neighbors.adults, report.adults);
  neighbors.count(w.neighbors.children, report.children);
  neighbors.count(w.neighbors.again, report.householdsHelpedAgain);
  for (const language of ["en", "es", "ht"] as const)
    if (report.householdsByLanguage[language])
      neighbors.count(w.neighbors.speaking(w.neighbors.languages[language]), report.householdsByLanguage[language]);
  for (const other of report.householdsByOtherLanguage) neighbors.count(w.neighbors.speaking(other.name), other.households);

  const visits = section(w.visits.section);
  visits.count(w.visits.made, report.visits);
  visits.count(w.visits.people, report.peopleVisited);
  visits.count(w.visits.hours, report.visitHours);
  visits.count(w.visits.miles, report.visitMiles);

  const requests = section(w.requests.section);
  requests.count(w.requests.received, report.requests.received);
  requests.count(w.requests.paid, report.requests.paid + report.requests.closedAfterPart.requests);
  if (report.requests.closedAfterPart.requests > 0) {
    requests.count(w.requests.inPart, report.requests.closedAfterPart.requests);
    requests.money(w.requests.inPartPaid, report.requests.closedAfterPart.paid);
    requests.money(w.requests.inPartApproved, report.requests.closedAfterPart.approved);
  }
  requests.count(w.requests.approved, report.requests.approved);
  requests.count(w.requests.open, report.requests.open);
  requests.count(w.requests.declined, report.requests.declined);
  requests.count(w.requests.closed, report.requests.closed - report.requests.closedAfterPart.requests);
  requests.count(w.requests.referred, report.requests.referred);
  requests.money(w.requests.asked, report.requests.amountRequested);
  requests.money(w.requests.amountApproved, report.requests.amountApproved);
  requests.money(w.requests.paidToward, report.requests.paidTowardThese);
  if (report.requests.paidLater.requests > 0 || report.requests.paidLater.amount > 0) {
    requests.count(w.requests.paidLater, report.requests.paidLater.requests);
    requests.money(w.requests.amountLater, report.requests.paidLater.amount);
  }
  requests.money(w.requests.paidEarlier, report.requests.paidTowardEarlier);

  const paid = section(w.paid.section);
  for (const line of report.kinds) paid.money(kinds[line.kind], line.paid);
  paid.money(w.paid.all, report.helpPaid, true);

  // Help brought over from ServWare has no ledger entries, so it stands in a section of its own.
  if (report.history.requests > 0) {
    const history = section(w.history.section);
    history.count(w.history.requests, report.history.requests);
    history.count(w.history.households, report.history.households);
    for (const line of report.history.kinds)
      if (line.amount) history.money(w.history.kind(kinds[line.kind]), line.amount);
    history.money(w.history.all, report.history.amount);
    history.count(w.history.inAll, report.history.householdsInAll);
    history.count(w.history.people, report.history.peopleInAll);
  }

  if (report.vouchers.given > 0 || report.vouchers.takenBack > 0) {
    const vouchers = section(w.vouchers.section);
    vouchers.count(w.vouchers.given, report.vouchers.given);
    vouchers.count(w.vouchers.takenBack, report.vouchers.takenBack);
    vouchers.count(w.vouchers.requests, report.vouchers.requests);
    vouchers.count(w.vouchers.households, report.vouchers.households);
  }

  const calls = section(w.calls.section);
  calls.count(w.calls.taken, report.calls.taken);
  calls.count(w.calls.returned, report.calls.returned);
  calls.count(w.calls.waiting, report.calls.waiting);
  calls.count(w.calls.none, report.calls.taken - report.calls.returned - report.calls.waiting);

  const time = section(w.time.section);
  time.count(w.time.visits, report.visitHours);
  for (const team of report.time.teams) time.count(w.time.shifts(said(team.name)), team.hours);
  time.count(w.time.all, report.time.hours);
  time.count(w.time.miles, report.visitMiles);
  time.count(w.time.served, report.time.membersServing);
  time.count(w.time.active, report.time.activeMembers);

  const funds = section(w.funds.section);
  funds.money(w.funds.beginning, report.money.beginningBalance);
  for (const source of report.money.sources) funds.money(w.funds.received(categoryLabel(words.rooms.treasury, source.label, said)), source.amount);
  funds.money(w.funds.allReceived, report.money.received);
  funds.money(w.funds.helpPaid, report.helpPaid);
  for (const other of report.money.otherSpending) funds.money(w.funds.spent(categoryLabel(words.rooms.treasury, other.label, said)), other.amount);
  funds.money(w.funds.allSpent, report.money.spent);
  funds.money(w.funds.ending, report.money.endingBalance, true);
  return rows;
}

/** The twelve months as spreadsheet rows, one column per count: the column names, then a row for each month. */
export function monthLines(report: YearReport, words: Words = english) {
  const w = words.rooms.reports.rows.csv;
  return [
    [w.month, w.calls, w.requests, w.visits, w.households, w.paid, w.moneyIn],
    ...report.months.map((line) => [monthLabel(line.month, false, words), line.calls, line.requests, line.visits, line.households, line.paid / 100, line.moneyIn / 100]),
  ];
}

/** Each member who served as a spreadsheet row, under the column names. Members are volunteers; no neighbor appears here. */
export function memberLines(report: YearReport, words: Words = english) {
  const w = words.rooms.reports.rows.csv;
  return [
    [w.member, w.visits, w.shifts, w.hours, w.miles],
    ...report.time.members.map((line) => [line.name, line.visits, line.shifts, line.hours, line.miles]),
  ];
}

/** The year as one CSV file: every line, then the months, then the members. No neighbor is named anywhere in it. */
export function reportCsv(report: YearReport, groupName: string, sample = false, words: Words = english, said?: (name: string) => string) {
  const w = words.rooms.reports.rows.csv;
  const lines = reportLines(report, words, said).map(({ section, line, number }) => [section, line, number]);
  const members = memberLines(report, words);
  return Papa.unparse([
    [groupName, periodLabel(report, words), longSpanLabel(report, words)],
    ...(sample ? [[w.sample]] : []),
    [],
    [w.section, w.line, w.value],
    ...lines,
    [],
    ...monthLines(report, words),
    ...(members.length > 1 ? [[], ...members] : []),
  ]);
}
export const csvFileName = (report: YearReport, groupName: string) =>
  `${groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report"}-year-${report.year}${report.quarter ? `-quarter-${report.quarter}` : ""}.csv`;
