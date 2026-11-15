import type { AuthConfig } from "convex/server";
// Clerk signs each session token; Convex checks it against this issuer. The value is Clerk's
// Frontend API URL (not a secret), set per deployment as CLERK_JWT_ISSUER_DOMAIN.
export default { providers: [{ domain: process.env.CLERK_JWT_ISSUER_DOMAIN!, applicationID: "convex" }] } satisfies AuthConfig;
