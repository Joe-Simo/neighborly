"use client";

import { memo, useEffect, useState, type RefObject } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Words } from "@/lib/words";

/** In the iPad app a hardware keyboard's shortcuts are held with ⌘, as in every iPad app; the website keeps the bare keys. */
const onIpad = () => document.documentElement.dataset.shell === "ios";
/** ⌘ keys the app answers, and the bare key each stands for: ⌘F finds and ⌘N makes, as anywhere on an iPad. */
const held: Record<string, string> = { f: "/", n: "n", "/": "?", "[": "[", "]": "]" };

/** The workspace key this press stands for, or nothing: a key pressed while a box is being typed in, a sheet is open, or with a modifier the workspace does not use belongs to that, not to the workspace. */
function forTheWorkspace(event: KeyboardEvent) {
  if (event.defaultPrevented || event.ctrlKey || event.altKey || event.isComposing) return false;
  if (event.metaKey && !(onIpad() && (/^[1-9]$/.test(event.key) || event.key.toLowerCase() in held))) return false;
  const at = event.target;
  if (at instanceof HTMLElement && at.closest("input, textarea, select, [contenteditable], [role=dialog], [role=listbox], [role=menu]")) return false;
  return !document.querySelector("[role=dialog][data-state=open], dialog[open]");
}

/**
 * The workspace's keys, on every room: 1 to 9 go to the menu's rooms in its order, [ and ] to the room before and after, / finds in the room, n presses the
 * room's head button, and ? shows them all on one sheet. Each key does what a click on the same control does, so
 * nothing new happens by key that cannot happen by hand.
 */
export const WorkspaceKeys = memo(function WorkspaceKeys({ nav, rooms: lines, keys: k }: { nav: RefObject<HTMLElement | null>; /** The menu's rooms in order, one per line. */ rooms: string; keys: Words["shell"]["keys"] }) {
  const [shown, setShown] = useState(false);
  const rooms = lines.split("\n");
  useEffect(() => {
    const press = (pressed: KeyboardEvent) => {
      // ⌘ and the key, in the iPad app, is read as the bare key.
      const ipadKey = pressed.metaKey ? (/^[1-9]$/.test(pressed.key) ? pressed.key : held[pressed.key.toLowerCase()]) : undefined;
      const event = { key: ipadKey ?? pressed.key, preventDefault: () => pressed.preventDefault() };
      if (event.key === "?" && (shown || forTheWorkspace(pressed))) {
        event.preventDefault();
        setShown((was) => !was);
        return;
      }
      if (!forTheWorkspace(pressed)) return;
      const main = document.getElementById("workspace-content");
      if (/^[1-9]$/.test(event.key)) {
        const link = nav.current?.querySelectorAll<HTMLAnchorElement>("a[href]")[Number(event.key) - 1];
        if (!link) return;
        event.preventDefault();
        link.click();
      } else if (event.key === "[" || event.key === "]") {
        // The room before or after this one in the menu's order, so the rooms past the ninth are a key away too.
        const links = [...(nav.current?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? [])];
        const here = links.findIndex((link) => link.getAttribute("aria-current") === "page");
        const next = links[here + (event.key === "]" ? 1 : -1)];
        if (!next) return;
        event.preventDefault();
        next.click();
      } else if (event.key === "/") {
        const field = main?.querySelector<HTMLInputElement>('input[type="search"]');
        if (!field) return;
        event.preventDefault();
        field.focus();
      } else if (event.key === "n") {
        const head = main?.querySelector<HTMLButtonElement>(".live-head-actions button:not(:disabled)");
        if (!head) return;
        event.preventDefault();
        head.click();
      }
    };
    window.addEventListener("keydown", press);
    return () => window.removeEventListener("keydown", press);
  }, [nav, shown]);
  // Read when the sheet is drawn, which is only ever in the browser, after the app has marked the page.
  const cmd = shown && onIpad() ? "⌘" : "";
  const rows: [string, string][] = [
    ...rooms.slice(0, 9).map((room, at): [string, string] => [cmd + String(at + 1), room]),
    [cmd + "[ ]", k.step],
    [cmd ? "⌘F" : "/", k.find],
    [cmd ? "⌘N" : "n", k.act],
    [cmd ? "⌘/" : "?", k.show],
  ];
  return (
    <Dialog open={shown} onOpenChange={setShown}>
      <DialogContent className="live-keys" closeLabel={k.close}>
        <DialogHeader>
          <DialogTitle>{k.title}</DialogTitle>
          <DialogDescription>{k.description}</DialogDescription>
        </DialogHeader>
        <dl>
          {rows.map(([key, what], at) => (
            <div key={key} data-first-room={at === 0 ? "" : undefined}>
              <dt><kbd>{key}</kbd></dt>
              <dd>{at < Math.min(rooms.length, 9) ? <><span className="sr-only">{k.rooms}: </span>{what}</> : what}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
});
