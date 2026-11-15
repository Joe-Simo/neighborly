"use client";

import { useState } from "react";

/** Runs one save at a time and keeps the plain sentence to show when it is refused. */
export function useSave() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function save<Result>(work: () => Promise<Result>) {
    setPending(true);
    setError("");
    try {
      return { saved: true as const, result: await work() };
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message.replace(/^.*?Uncaught Error:\s*/, "").split("\n")[0]
          : "That couldn’t be saved. Please try again.",
      );
      return { saved: false as const };
    } finally {
      setPending(false);
    }
  }
  return { pending, error, save, clear: () => setError("") };
}
