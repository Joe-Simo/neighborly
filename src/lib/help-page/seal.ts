/**
 * The form's values between the form step and the check step, held by the person's own browser for ten minutes and
 * readable by no one else: AES-GCM under a key derived from INTAKE_SERVER_SECRET, then an HMAC over the whole token
 * (a second derived key). Nothing is written anywhere on the server until the check passes.
 */
const TEN_MINUTES = 10 * 60 * 1000;
const encoder = new TextEncoder(), decoder = new TextDecoder();

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function unb64(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[\w-]*$/.test(text)) return null;
  try {
    const raw = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  } catch { return null; }
}

async function keys(secret: string) {
  const root = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const derive = async (label: string) => new Uint8Array(await crypto.subtle.sign("HMAC", root, encoder.encode(label)));
  const [enc, mac] = await Promise.all([derive("kh-intake-check-enc-v1"), derive("kh-intake-check-mac-v1")]);
  return {
    enc: await crypto.subtle.importKey("raw", enc, "AES-GCM", false, ["encrypt", "decrypt"]),
    mac: await crypto.subtle.importKey("raw", mac, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]),
  };
}

/** Seals `value` until ten minutes from `now`. */
export async function seal(secret: string, value: unknown, now = Date.now()): Promise<string> {
  const { enc, mac } = await keys(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, enc, encoder.encode(JSON.stringify({ e: now + TEN_MINUTES, v: value }))));
  const head = `${b64(iv)}.${b64(body)}`;
  return `${head}.${b64(new Uint8Array(await crypto.subtle.sign("HMAC", mac, encoder.encode(head))))}`;
}

/** The sealed value, "expired" when it is genuine but older than ten minutes, or null when it is anything else. */
export async function unseal(secret: string, token: string, now = Date.now()): Promise<{ value: unknown } | "expired" | null> {
  const parts = token.split(".");
  if (parts.length !== 3 || token.length > 8000) return null;
  const [ivText, bodyText, sigText] = parts as [string, string, string];
  const iv = unb64(ivText), body = unb64(bodyText), sig = unb64(sigText);
  if (!iv || !body || !sig || iv.length !== 12) return null;
  const { enc, mac } = await keys(secret);
  if (!(await crypto.subtle.verify("HMAC", mac, sig, encoder.encode(`${ivText}.${bodyText}`)))) return null;
  let read: unknown;
  try { read = JSON.parse(decoder.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, enc, body))); } catch { return null; }
  if (typeof read !== "object" || read === null || !("e" in read) || typeof read.e !== "number" || !("v" in read)) return null;
  return now > read.e ? "expired" : { value: read.v };
}
