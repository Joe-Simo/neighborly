/**
 * After a deploy, a tab opened before it still runs the last deploy's code, and a piece of that code loaded only when
 * needed (a sheet, a form) can name a file the site no longer has (the offline worker keeps the last deploys' files, but
 * a tab with no worker has nothing kept). Such a tab is reloaded once, in place: the address, and with it an open sheet
 * named there, is kept. The once is kept per deploy for the tab's session, so a second failure on the same deploy is
 * never reloaded again and is shown as a page that did not open.
 */
const KEY = `kh-code-reloaded:${process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}`;

/** A failed load of the site's own code: a ChunkLoadError, a failed chunk or dynamically imported module. */
export const isCodeLoadFailure = (error: unknown) =>
  error instanceof Error && (error.name === "ChunkLoadError" || /chunk .* failed|load chunk|dynamically imported module|Importing a module script failed/i.test(error.message));

/** Whether a failed code load may still be met by the once-only reload; false when it was already used (or cannot be kept). */
export function willReloadForCode(error: unknown) {
  try {
    return isCodeLoadFailure(error) && !sessionStorage.getItem(KEY);
  } catch {
    // With no session storage the once cannot be kept, so it is never tried: no reload can loop.
    return false;
  }
}

/** Reloads the tab for a failed code load, once for this deploy. */
export function reloadOnceForCode(error: unknown) {
  if (!willReloadForCode(error)) return;
  sessionStorage.setItem(KEY, "1");
  window.location.reload();
}
