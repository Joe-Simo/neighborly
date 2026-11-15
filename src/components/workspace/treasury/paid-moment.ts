"use client";

import { useEffect, useState } from "react";
import type { Payable } from "@/components/workspace/treasury/labels";

/** The request a payment was just recorded for, and the ledger entry that payment became. */
export type Paid = {
  request: Payable;
  amount: number;
  entryId: string;
  /** True for the last moment, while the sheet goes down into its ledger row. */
  leaving: boolean;
};

const SHOWN = 4000;
const LEAVING = 320;
const LANDED = 1600;

/**
 * The paid sheet stays about four seconds, or until the next tap, then settles into its
 * ledger row, which holds a highlight for a moment while the next request rises.
 */
export function usePaidMoment() {
  const [paid, setPaid] = useState<Paid | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  useEffect(() => {
    if (!paid) return;
    if (paid.leaving) {
      const timer = setTimeout(() => {
        setLanded(paid.entryId);
        setPaid(null);
      }, LEAVING);
      return () => clearTimeout(timer);
    }
    const leave = () => setPaid((now) => now && { ...now, leaving: true });
    const timer = setTimeout(leave, SHOWN);
    window.addEventListener("pointerdown", leave);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", leave);
    };
  }, [paid]);
  useEffect(() => {
    if (!landed) return;
    const timer = setTimeout(() => setLanded(null), LANDED);
    return () => clearTimeout(timer);
  }, [landed]);
  return {
    paid,
    landed,
    pay: (request: Payable, amount: number, entryId: string) =>
      setPaid({ request, amount, entryId, leaving: false }),
  };
}
