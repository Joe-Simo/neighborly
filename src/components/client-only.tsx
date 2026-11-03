"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** The workspace lives in browser storage, so it renders only on the client. */
export function ClientOnly({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return mounted ? <>{children}</> : <>{fallback ?? <div className="min-h-dvh" aria-busy="true" />}</>;
}
