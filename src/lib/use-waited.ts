import { useEffect, useState } from "react";

/** True once `waiting` has lasted 400ms, the product's one hold before a wait is said, so a quick answer says nothing. */
export function useWaited(waiting: boolean) {
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setWaited(true), 400);
    return () => {
      clearTimeout(timer);
      setWaited(false);
    };
  }, [waiting]);
  return waiting && waited;
}
