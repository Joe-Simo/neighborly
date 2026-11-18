"use client";

import { useEffect } from "react";
import { typedFor } from "@/lib/kept-typing";

/** Said by useSave when the server took a save: the form just sent no longer needs what was typed into it. */
export const SAVED_EVENT = "kh-saved";
type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** This tab's kept typing for `owner`; a tab whose storage is closed keeps nothing. */
const shelfFor = (owner: string) => {
  try {
    return typedFor(sessionStorage, owner);
  } catch {
    return null;
  }
};

const fields = (form: HTMLFormElement) =>
  [...form.elements].filter(
    (control): control is Field =>
      (control instanceof HTMLInputElement &&
        !!control.name &&
        !["password", "hidden", "file", "submit", "button", "checkbox", "radio"].includes(control.type) &&
        control.autocomplete !== "one-time-code") ||
      ((control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) && !!control.name),
  );

const firstValue = (control: Field) =>
  control instanceof HTMLSelectElement
    ? ([...control.options].find((option) => option.defaultSelected)?.value ?? control.options[0]?.value ?? "")
    : control.defaultValue;

/**
 * Which form this is: the page, the sheet's title, and what the form opened with. Two neighbours' call forms have
 * different names in them, so one's words never open in the other's.
 */
function formKey(form: HTMLFormElement) {
  const title = form.closest("[role='dialog']")?.querySelector("h2")?.textContent ?? "";
  const opened = fields(form).map((control) => `${control.name}=${firstValue(control)}`).join("&");
  return `${location.pathname}${location.search}|${title}|${opened}`;
}

/** Puts a value in as typing would, so the form's own state hears it. */
function retype(control: Field, value: string) {
  const own = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(control) as object, "value");
  own?.set?.call(control, value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Nothing typed into a room's form is lost: closing a sheet, changing rooms, or reloading the tab and opening the same
 * form again finds the words where they were left. Kept only for this tab (sessionStorage), and let go the moment the
 * save is taken. A form the server refused keeps everything, as it stands on the page. Kept for one member in one
 * conference: sign-out lets it go (lib/forget-browser.ts), and so does anyone else coming to the same tab.
 */
export function KeptTyping({ member, conference }: { member: string; conference: string }) {
  useEffect(() => {
    const owner = `${member}:${conference}`;
    // Read once now, so another member's typing is let go as soon as this one's rooms open.
    shelfFor(owner);
    let sent: HTMLFormElement | null = null;
    const keys = new WeakMap<HTMLFormElement, string>();
    const keyOf = (form: HTMLFormElement) => {
      let key = keys.get(form);
      if (!key) keys.set(form, (key = formKey(form)));
      return key;
    };
    const ours = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLFormElement>("form.live-form") : null;

    const typed = (event: Event) => {
      const form = ours(event.target);
      if (!form || !event.isTrusted) return;
      const now: Record<string, string> = {};
      for (const control of fields(form)) if (control.value !== firstValue(control)) now[control.name] = control.value;
      shelfFor(owner)?.set(keyOf(form), now);
    };
    const send = (event: Event) => {
      sent = ours(event.target);
    };
    const saved = () => {
      if (!sent) return;
      shelfFor(owner)?.set(keyOf(sent), {});
      sent = null;
    };
    const bringBack = (form: HTMLFormElement) => {
      if (keys.has(form)) return;
      const words = shelfFor(owner)?.get(keyOf(form));
      if (!words) return;
      for (const control of fields(form)) {
        const value = words[control.name];
        if (value !== undefined && control.value === firstValue(control)) retype(control, value);
      }
    };
    const look = () => document.querySelectorAll<HTMLFormElement>("form.live-form").forEach(bringBack);
    look();
    const watch = new MutationObserver(look);
    watch.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("input", typed, true);
    document.addEventListener("change", typed, true);
    document.addEventListener("submit", send, true);
    window.addEventListener(SAVED_EVENT, saved);
    return () => {
      watch.disconnect();
      document.removeEventListener("input", typed, true);
      document.removeEventListener("change", typed, true);
      document.removeEventListener("submit", send, true);
      window.removeEventListener(SAVED_EVENT, saved);
    };
  }, [member, conference]);
  return null;
}
