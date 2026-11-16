"use client";

import { useEffect, useState } from "react";
import { FOLD_HOLD, foldLeaves } from "@/components/workspace/fold";
import type { Payable } from "@/components/workspace/treasury/labels";

/** The request a payment was just recorded for, and the ledger entry that payment became. */
export type Paid = {
  request: Payable;
  amount: number;
  entryId: string;
  /** True for the last moment, while the sheet closes up and its ledger row takes the mark. */
  leaving: boolean;
};

const SHOWN = FOLD_HOLD;
const LANDED = 1600;

/**
 * The paid sheet stays for the hold every folded sheet has, or until the next tap, then settles into its
 * ledger row, which holds a highlight for a moment while the next request rises.
 */
export function usePaidMoment() {
  const [paid, setPaid] = useState<Paid | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  useEffect(() => {
    if (!paid) return;
    if (paid.leaving) {
      let gone = false;
      void foldLeaves().then(() => {
        if (gone) return;
        setLanded(paid.entryId);
        setPaid(null);
      });
      return () => {
        gone = true;
      };
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
