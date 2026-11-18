import { forgetKeptRoom } from "@/lib/kept-room";

/**
 * What the app leaves in the browser that names or hints at a conference, a person or a note. On sign-out, and on
 * leaving the sample, all of it goes, so the next person at a shared computer starts from nothing. Only the chosen
 * language stays (`kind-helps:language`), and Clerk's own keys are Clerk's to clear.
 * A new key that says anything about who was here, or what they saw, is added to these lists.
 */
const local = [
  // The conference last opened, asked for first on the next visit (workspace/dashboard.ts).
  "kindhelps.church",
  // The week note: the week it was put away, and the figures it last showed (workspace/week-note/week-note.tsx).
  "week-note-put-away",
  "week-note-last",
];
const session = [
  // The name written on the home page's card (lib/card-for.ts).
  "kh-card-for",
  // Which rooms' pictures have already been laid, and the reports pile (workspace/relief-arrival.tsx, reports/report-view.tsx).
  "kind-helps-arrived",
  "report-pile-laid",
];

export function forgetThisBrowser() {
  for (const [storage, keys] of [["localStorage", local], ["sessionStorage", session]] as const) {
    try {
      for (const key of keys) window[storage].removeItem(key);
    } catch {
      // Storage is closed to the page: nothing was kept.
    }
  }
  // In the iOS app, the first screen it keeps on the device (lib/kept-room.ts), and the app's pages kept by its
  // offline worker (app/sw.ts).
  forgetKeptRoom();
  if (typeof caches !== "undefined") void caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith("kh-app-pages-")).map((name) => caches.delete(name)))).catch(() => {});
}

/**
 * For a session that ended without the app's sign-out (it ran out, or was ended elsewhere): when nobody is signed in
 * and the browser still holds what a signed-in visit leaves, that goes too. A visitor who was never signed in
 * holds none of it, and the name they wrote on the home page's card is left for the door to read.
 */
export function forgetWhoWasHere() {
  // A room the app kept on the device is never drawn for someone signed out.
  forgetKeptRoom();
  try {
    if (local.some((key) => window.localStorage.getItem(key) !== null)) forgetThisBrowser();
  } catch {
    // Storage is closed to the page: nothing was kept.
  }
}
