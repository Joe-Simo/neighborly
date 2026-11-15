"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/workspace/context";
import { readFailure } from "@/components/workspace/failure";

/** Runs one save at a time and keeps the plain sentence to show when it is refused. */
export function useSave() {
  const { words } = useWorkspace();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function save<Result>(work: () => Promise<Result>) {
    setPending(true);
    setError("");
    try {
      return { saved: true as const, result: await work() };
    } catch (cause) {
      setError(readFailure(cause, words.states.notSaved, words.states.offlineSave));
      return { saved: false as const };
    } finally {
      setPending(false);
    }
  }
  return { pending, error, save, clear: () => setError("") };
}
