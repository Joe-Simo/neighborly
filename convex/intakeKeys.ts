/**
 * The keyed hash of the "Ask for help" form, so a list of hashed emails cannot be reversed by hashing guesses.
 * INTAKE_HASH_SECRET keys it. A plain module: the form's endpoints (intakeHttp.ts) and the sample's web requests
 * (sampleData.ts) hash the same way, so a sample row holds what a real one would.
 */
const encode = (text: string) => new TextEncoder().encode(text);
export const hex = (bytes: ArrayBuffer | Uint8Array) => Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
export async function keyed(text: string) {
  const key = await crypto.subtle.importKey("raw", encode(process.env.INTAKE_HASH_SECRET || "kind-helps-intake"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, encode(text)));
}
