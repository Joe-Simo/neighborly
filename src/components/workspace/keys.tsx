"use client";

import { memo, useEffect, useState, type RefObject } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Words } from "@/lib/words";

/** A key pressed while a box is being typed in, a sheet is open, or with a modifier belongs to that, not to the workspace. */
function forTheWorkspace(event: KeyboardEvent) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return false;
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
    const press = (event: KeyboardEvent) => {
      if (event.key === "?" && (shown || forTheWorkspace(event))) {
        event.preventDefault();
        setShown((was) => !was);
        return;
      }
      if (!forTheWorkspace(event)) return;
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
  const rows: [string, string][] = [
    ...rooms.slice(0, 9).map((room, at): [string, string] => [String(at + 1), room]),
    ["[ ]", k.step],
    ["/", k.find],
    ["n", k.act],
    ["?", k.show],
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
