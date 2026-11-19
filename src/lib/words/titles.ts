/** A title written before a name: St., Mr., Mrs., Ms., Dr., Fr., Rev., Sr., Sra., Srta. (Spanish too). */
const title = /\b(St|Mr|Mrs|Ms|Dr|Fr|Rev|Sr|Sra|Srta)\. +(?=\p{Lu})/gu;

/** Joins a title to the name after it with a no-break space, so "St. Example Parish" never parts after "St.". */
export function keepTitle(text: string): string {
  return text.replace(title, "$1. ");
}
