"use client";

import { useState } from "react";
import { useWorkspaceIfAny } from "@/components/workspace/context";
import { readFailure } from "@/components/workspace/failure";

type Felt = "saved" | "decided";
type FeltBridge = { webkit?: { messageHandlers?: { kindHelpsFelt?: { postMessage: (felt: Felt) => void } } } };

/**
 * Runs one save at a time and keeps the plain sentence to show when it is refused. In the iOS app a save that
 * goes through is felt: a light touch, or the system's "done" when the save is a decision (an approval, a call
 * marked returned). Nothing else in the app is felt.
 */
export function useSave(felt: Felt = "saved") {
  const states = useWorkspaceIfAny()?.words.states;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function save<Result>(work: () => Promise<Result>) {
    setPending(true);
    setError("");
    try {
      const result = await work();
      (window as FeltBridge).webkit?.messageHandlers?.kindHelpsFelt?.postMessage(felt);
      return { saved: true as const, result };
    } catch (cause) {
      setError(readFailure(cause, states?.notSaved, states?.offlineSave));
      return { saved: false as const };
    } finally {
      setPending(false);
    }
  }
  return { pending, error, save, clear: () => setError("") };
}
