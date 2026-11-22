"use client";

import { useState } from "react";
import { useWorkspaceIfAny } from "@/components/workspace/context";
import { readFailure } from "@/components/workspace/failure";
import { sayRefused } from "@/lib/refusals";
import { SAVED_EVENT } from "@/components/workspace/kept-typing";

type Felt = "saved" | "decided";
type FeltBridge = { webkit?: { messageHandlers?: { kindHelpsFelt?: { postMessage: (felt: "decided" | "refused") => void } } } };

/** One light tap in the iOS app when a yes goes through. The app feels nothing else, and nothing under Reduce Motion. */
export const feelYes = () => (window as FeltBridge).webkit?.messageHandlers?.kindHelpsFelt?.postMessage("decided");

/**
 * Runs one save at a time and keeps the plain sentence to show when it is refused. In the iOS app only the yes
 * actions are felt (Approve, Save this request, and Record payment in treasury/payment-form.tsx): one light tap,
 * which the app leaves out under Reduce Motion. An ordinary save, a refusal, and anything else the page says are
 * not felt (SceneDelegate.swift, tap(for:)).
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
      if (felt === "decided") feelYes();
      window.dispatchEvent(new Event(SAVED_EVENT));
      return { saved: true as const, result };
    } catch (cause) {
      (window as FeltBridge).webkit?.messageHandlers?.kindHelpsFelt?.postMessage("refused");
      // The backend's own sentence is English; the reader's language carries it where the tables have it.
      const said = readFailure(cause, states?.notSaved, states?.offlineSave);
      setError(sayRefused(words?.notices, said));
      return { saved: false as const };
    } finally {
      setPending(false);
    }
  }
  return { pending, error, save, clear: () => setError("") };
}
