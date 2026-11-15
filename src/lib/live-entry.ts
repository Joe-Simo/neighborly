export type LiveEntryIntent = "start" | "join" | "signin";
export type LiveEntryContext = {
  intent: LiveEntryIntent;
  invitationToken: string;
};
type EntryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type EntryStores = { session?: EntryStorage; local?: EntryStorage };

const key = "neighborly.entry";
const lifetime = 60 * 60 * 1000;
const validIntent = (value: unknown): value is LiveEntryIntent =>
  value === "start" || value === "join" || value === "signin";
const validToken = (value: unknown): value is string =>
  typeof value === "string" && (value === "" || /^[a-f0-9]{64}$/i.test(value));

/** Storage access can be denied independently by browser privacy settings. */
export function browserEntryStores(): EntryStores {
  const stores: EntryStores = {};
  if (typeof window === "undefined") return stores;
  try {
    stores.session = window.sessionStorage;
  } catch {
    /* Optional continuity. */
  }
  try {
    stores.local = window.localStorage;
  } catch {
    /* Optional cross-tab continuity. */
  }
  return stores;
}

function remove(storage?: EntryStorage) {
  try {
    storage?.removeItem(key);
  } catch {
    /* A denied store must not block the flow. */
  }
}

function read(
  storage: EntryStorage | undefined,
  now: number,
): LiveEntryContext | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (
      data &&
      typeof data === "object" &&
      "intent" in data &&
      validIntent(data.intent) &&
      "invitationToken" in data &&
      validToken(data.invitationToken) &&
      "expiresAt" in data &&
      typeof data.expiresAt === "number" &&
      Number.isFinite(data.expiresAt) &&
      data.expiresAt > now &&
      data.expiresAt <= now + lifetime
    ) {
      return { intent: data.intent, invitationToken: data.invitationToken };
    }
  } catch {
    /* Invalid JSON and denied access both fall through. */
  }
  remove(storage);
  return null;
}

/** Only entry intent and an invitation capability are stored, never credentials. */
export function saveEntryContext(
  entry: LiveEntryContext,
  stores: EntryStores = browserEntryStores(),
  now = Date.now(),
): void {
  if (!validIntent(entry.intent) || !validToken(entry.invitationToken)) {
    clearEntryContext(stores);
    return;
  }
  const serialized = JSON.stringify({
    intent: entry.intent,
    invitationToken: entry.invitationToken,
    expiresAt: now + lifetime,
  });
  for (const storage of [stores.session, stores.local]) {
    try {
      storage?.setItem(key, serialized);
    } catch {
      /* Try the other store. */
    }
  }
}

/** This tab's exact flow wins over a newer flow begun in another tab. */
export function restoreEntryContext(
  stores: EntryStores = browserEntryStores(),
  now = Date.now(),
): LiveEntryContext | null {
  return read(stores.session, now) ?? read(stores.local, now);
}

export function clearEntryContext(
  stores: EntryStores = browserEntryStores(),
): void {
  remove(stores.session);
  remove(stores.local);
}

export function entryDestination(entry: LiveEntryContext | null): string {
  if (!entry) return "/app";
  const query = new URLSearchParams({ intent: entry.intent });
  if (entry.invitationToken) query.set("invite", entry.invitationToken);
  return "/app?" + query.toString();
}
