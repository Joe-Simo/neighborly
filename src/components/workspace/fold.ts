/**
 * How long a sheet stays after its yes, its corner green and its word showing, before it moves on:
 * the fold itself (about half a second) and time to read the word. One timing in every room.
 */
export const FOLD_HOLD = 1600;

const LEAVE = 320;

/**
 * After the hold, whatever is marked `data-fold-leaves` goes: it fades and closes up over 320ms, so what
 * is below glides into its place and the page never jumps. Await it, then take the sheet out of the data.
 * For anyone who asks for less motion it is a plain cut.
 */
export async function foldLeaves() {
  const sheets = [...document.querySelectorAll<HTMLElement>("[data-fold-leaves]")];
  if (!sheets.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  await Promise.all(
    sheets.map((sheet) => {
      const { marginTop, marginBottom, paddingTop, paddingBottom } = getComputedStyle(sheet);
      const height = `${sheet.offsetHeight}px`;
      sheet.style.boxSizing = "border-box";
      sheet.style.overflow = "hidden";
      return sheet.animate(
        [
          { height, opacity: 1, marginTop, marginBottom, paddingTop, paddingBottom },
          { opacity: 0, offset: 0.6 },
          { height: "0px", opacity: 0, marginTop: "0px", marginBottom: "0px", paddingTop: "0px", paddingBottom: "0px" },
        ],
        { duration: LEAVE, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)", fill: "forwards" },
      ).finished;
    }),
  );
}
