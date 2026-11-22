import Papa from "papaparse";

/**
 * A spreadsheet program runs a cell that begins like a formula (= + - @, or a tab or return before one), so a name typed
 * as "=HYPERLINK(...)" would run when the file is opened. Such a cell gets a leading apostrophe and is read as text.
 * A plain negative amount ("-12.50") is left as a number.
 */
export const formulaStart = /^(?!-\d+(?:\.\d+)?$)[=+\-@\t\r]/;

/** CSV text with every formula-like cell made plain text. */
export function csvText(data: unknown[][] | { fields: string[]; data: unknown[][] }) {
  return Papa.unparse(data, { escapeFormulae: formulaStart });
}
