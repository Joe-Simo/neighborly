"use client";

import { useState } from "react";
import { useWorkspaceIfAny } from "@/components/workspace/context";
import { readFailure } from "@/components/workspace/failure";
import { SAVED_EVENT } from "@/components/workspace/kept-typing";

type Felt = "saved" | "decided";
type FeltBridge = { webkit?: { messageHandlers?: { kindHelpsFelt?: { postMessage: (felt: "decided" | "refused") => void } } } };

/**
 * Runs one save at a time and keeps the plain sentence to show when it is refused. In the iOS app only what is real
 * is felt: a decision going through (an approval, a call marked returned; its corner lays green) is one light tap, and
 * a save the server refuses is the system's warning. An ordinary save is not felt. The page turn is the only other
 * thing felt (room-sheet.tsx), and the device's own haptics setting turns all of it off.
 */
export function useSave(felt: Felt = "saved") {
  const words = useWorkspaceIfAny()?.words;
  const states = words?.states;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function save<Result>(work: () => Promise<Result>) {
    setPending(true);
    setError("");
    try {
      const result = await work();
      if (felt === "decided") (window as FeltBridge).webkit?.messageHandlers?.kindHelpsFelt?.postMessage("decided");
      window.dispatchEvent(new Event(SAVED_EVENT));
      return { saved: true as const, result };
    } catch (cause) {
      (window as FeltBridge).webkit?.messageHandlers?.kindHelpsFelt?.postMessage("refused");
      // The backend's own sentence is English; the reader's language carries it where the tables have it.
      const said = readFailure(cause, states?.notSaved, states?.offlineSave);
      setError(words?.notices.refused[said] ?? said);
      return { saved: false as const };
    } finally {
      setPending(false);
    }
  }
  return { pending, error, save, clear: () => setError("") };
}
