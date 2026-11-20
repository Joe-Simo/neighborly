import { sampleYear } from "@/lib/sample-year";

/** The flight's timing and which month is read, kept apart from the slips' geometry so the page's first load carries only these few lines. */
export const MONTHS = 12;
/** The first month of the sample's year (October 2025), as a UTC date; the year runs twelve months from it. */
export const FIRST_MONTH = Date.UTC(sampleYear.year - 1, 9, 1);
export const GAP = 3.4, START = 3.6;
export const ease = (t: number) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
export const monthZ = (month: number) => -month * GAP;
/**
 * The flight takes the band's first 72%. In the rest the camera rises over the open ledger book just past September, and the year's slips are
 * set down onto its right-hand page one after another, October's first, until the year is one squared pile on the book: the band ends on it.
 */
export const FLIGHT = .72;
/** Where the camera stands at `through` (0 to 1): from in front of October to just before September's fan, where it rests. */
export const cameraZ = (through: number) => START + (monthZ(MONTHS - 1) + 2.4 - START) * ease(Math.min(1, through / FLIGHT));
/** Which month is nearest in front of the camera: its leaf is the one being read. */
export const monthAt = (through: number) => through > FLIGHT ? MONTHS - 1 : Math.max(0, Math.min(MONTHS - 1, Math.round((START - 2.4 - cameraZ(through)) / GAP)));
