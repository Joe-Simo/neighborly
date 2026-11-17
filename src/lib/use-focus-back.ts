import { useEffect, useRef, useState } from "react";

/**
 * A form at rest disables its fields, and a disabled field gives its focus up to the page: a person on a
 * keyboard or a screen reader is then sent back to the top. `note()` is called at the press, while focus is
 * still where the person left it; `back()` once the form has answered. Focus returns to the same control if
 * it can take it, else to the first field of the same sheet. If the person has moved on, nothing is taken.
 */
export function useFocusBack() {
  const from = useRef<HTMLElement | null>(null);
  const [asked, setAsked] = useState(0);
  useEffect(() => {
    const held = from.current;
    if (!asked || !held) return;
    from.current = null;
    const now = document.activeElement;
    if (now && now !== document.body && now.isConnected && !now.matches(":disabled")) return;
    const sheet = held.isConnected ? held.closest("main") : document.querySelector("main");
    const next = held.isConnected && !held.matches(":disabled")
      ? held
      : sheet?.querySelector<HTMLElement>('form :is(input, select):enabled');
    next?.focus();
  }, [asked]);
  return {
    note() {
      const now = document.activeElement;
      from.current = now instanceof HTMLElement && now.closest("main") ? now : null;
    },
    back: () => setAsked((count) => count + 1),
  };
}
