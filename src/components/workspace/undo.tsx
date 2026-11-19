"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";

type UndoBridge = { webkit?: { messageHandlers?: { kindHelpsUndo?: { postMessage: (slip: { label: string } | null) => void } } }; kindHelpsUndo?: () => void };

/**
 * The way back on a saved line. It stays as long as the line does (ten seconds, longer while a hand or the focus is
 * on it) and runs the act's own reverse on the server, under the same rules as the act. The room says what came of it.
 * In the iOS app the slip is also told to the app, with its words, and taken back when it goes; the app's own Undo
 * (a shake, a three-finger swipe) calls `window.kindHelpsUndo`, the same path as the press. Without the app, nothing.
 */
/** The Undo of the newest saved line; ⌘Z and Ctrl+Z run only that one. */
let newest: (() => void) | null = null;

export function UndoAct({ run }: { run: () => Promise<void> }) {
  const { words, area } = useWorkspace();
  // The room the line was put up in, and the room open now: the keys belong to the line only while they are the same.
  const room = useRef(area);
  const now = useRef(area);
  useEffect(() => {
    now.current = area;
  }, [area]);
  const [going, setGoing] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  // The press and the app's own Undo run the same reverse, once.
  const running = useRef(false);
  const latest = useRef(run);
  useEffect(() => {
    latest.current = run;
  });
  const undo = async () => {
    if (running.current) return;
    running.current = true;
    setGoing(true);
    try {
      await latest.current();
    } finally {
      running.current = false;
      setGoing(false);
    }
  };
  // On a keyboard, the way back is also the usual keys (⌘Z, or Ctrl+Z), wherever focus is, while the line is up;
  // never inside a box being typed in, where those keys undo the typing, nor while a sheet is open over the room, nor
  // once the person has gone to another room. Only the newest line answers them, and it answers as its button does.
  useEffect(() => {
    const mine = () => void undo();
    newest = mine;
    const keys = (event: KeyboardEvent) => {
      if (newest !== mine || event.key.toLowerCase() !== "z" || event.shiftKey || event.altKey || !(event.metaKey || event.ctrlKey)) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable]")) return;
      if (now.current !== room.current || document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      event.preventDefault();
      mine();
    };
    window.addEventListener("keydown", keys);
    return () => {
      window.removeEventListener("keydown", keys);
      if (newest === mine) newest = null;
    };
  }, []);
  useEffect(() => {
    const page = window as UndoBridge;
    const slip = button.current?.closest(".help-done");
    const own = button.current?.textContent ?? "";
    const label = (slip?.querySelector(".sr-only")?.textContent ?? slip?.textContent?.replace(own, "") ?? "").trim();
    const mine = () => void undo();
    page.kindHelpsUndo = mine;
    page.webkit?.messageHandlers?.kindHelpsUndo?.postMessage({ label });
    return () => {
      // A newer slip may already have taken the call; only this one's own is let go.
      if (page.kindHelpsUndo !== mine) return;
      page.kindHelpsUndo = () => {};
      page.webkit?.messageHandlers?.kindHelpsUndo?.postMessage(null);
    };
  }, []);
  return (
    <Button ref={button} variant="link" className="help-text-action" disabled={going} onClick={() => void undo()}>
      {words.tasks.undo}
    </Button>
  );
}
