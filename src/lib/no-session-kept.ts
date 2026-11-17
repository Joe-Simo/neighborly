/**
 * Whether a browser holding these cookies cannot be signed in, known before Clerk's script has loaded.
 *
 * Clerk keeps a session in two cookies the page can read: `__session` (the token) and `__client_uat` (when this
 * browser's sign-in last changed; "0" once it has signed out). Each may also be kept under a name with the
 * instance's suffix. Clerk's own server rule is the one used here: no token and no sign-in time means signed out
 * (`@clerk/backend`, "session-token-and-uat-missing"). `__clerk_db_jwt` only names the browser to a development
 * instance and says nothing of a session, so it is not read. Anything else, and the question is left to Clerk.
 */
export function noSessionKept(cookies: string) {
  return !cookies.split(/;\s*/).some((cookie) => {
    const [name, value = ""] = cookie.split("=");
    return name.startsWith("__session") || (name.startsWith("__client_uat") && value !== "0");
  });
}
