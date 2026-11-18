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
export function UndoAct({ run }: { run: () => Promise<void> }) {
  const { words } = useWorkspace();
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
