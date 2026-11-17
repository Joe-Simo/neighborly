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
  // The account the backend last found here (components/live-providers.tsx).
  "kind-helps-entered",
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
}

/**
 * For a session that ended without the app's sign-out (it ran out, or was ended elsewhere): when nobody is signed in
 * and the browser still holds what a signed-in visit leaves, that goes too. A visitor who was never signed in
 * holds none of it, and the name they wrote on the home page's card is left for the door to read.
 */
export function forgetWhoWasHere() {
  try {
    if (local.some((key) => window.localStorage.getItem(key) !== null)) forgetThisBrowser();
  } catch {
    // Storage is closed to the page: nothing was kept.
  }
}
