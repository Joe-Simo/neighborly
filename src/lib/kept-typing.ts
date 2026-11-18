/** Where a room's unsaved typing is kept for this tab: one member in one conference at a time. */
export const TYPED_KEY = "kh-typed";

type Words = Record<string, string>;
type Store = { owner: string; forms: Record<string, Words> };
type Shelf = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const read = (shelf: Shelf): Store | null => {
  try {
    const store = JSON.parse(shelf.getItem(TYPED_KEY) ?? "null") as Store | null;
    return store && typeof store.owner === "string" && store.forms ? store : null;
  } catch {
    return null;
  }
};

/**
 * The typing kept for `owner` (a member in a conference). Anything kept for someone else, as when volunteers share a
 * parish computer and its open tab, is let go before anything is read.
 */
export function typedFor(shelf: Shelf, owner: string) {
  const forms = (() => {
    const store = read(shelf);
    if (store && store.owner !== owner) shelf.removeItem(TYPED_KEY);
    return store?.owner === owner ? store.forms : {};
  })();
  const write = () => {
    if (Object.keys(forms).length) shelf.setItem(TYPED_KEY, JSON.stringify({ owner, forms } satisfies Store));
    else shelf.removeItem(TYPED_KEY);
  };
  return {
    get: (form: string): Words | undefined => forms[form],
    set(form: string, words: Words) {
      if (Object.keys(words).length) forms[form] = words;
      else delete forms[form];
      write();
    },
  };
}
