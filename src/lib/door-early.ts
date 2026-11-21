/**
 * Whether the server's sign-in sheet may be shown at the first paint, before any script of the page has run: read by
 * an inline script in the app's head (app/layout.tsx), which marks `html[data-door-early]` with the sheet's language
 * (the server draws it in each). Self-contained, because
 * its source is what that script runs.
 * - Nobody can be signed in on this browser: the rule of lib/no-session-kept.ts, kept the same.
 * - The address asks for nothing but sign-in: an invitation, an intent or the sample door draw their own screen.
 * - Inside the iOS app, only when it has no first room of its own to hand the page (a signed-out phone keeps none).
 * Anything else, and the launch line stands until the page's own answer, as before.
 */
export function doorEarly(): "en" | "es" | false {
  if (navigator.userAgent.includes("KindHelpsApp") && Reflect.has(window, "kindHelpsKept")) return false;
  if (/[?&](intent|invite)=/.test(location.search)) return false;
  const signedOut = !document.cookie.split(/;\s*/).some((cookie) => {
    const [name, value = ""] = cookie.split("=");
    return name.startsWith("__session") || (name.startsWith("__client_uat") && value !== "0");
  });
  if (!signedOut) return false;
  let chosen: string | null = null;
  try {
    chosen = localStorage.getItem("kind-helps:language");
  } catch {
    // A closed store: the device's languages still answer.
  }
  // The device's language as the sheet reads it (live-auth-words.ts, deviceLanguage): a choice kept, else the first it speaks.
  if (chosen === "en" || chosen === "es") return chosen;
  const tag = (navigator.languages ?? []).find((each) => /^(en|es)/i.test(each));
  return tag && /^es/i.test(tag) ? "es" : "en";
}
