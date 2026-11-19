import { useEffect, useState } from "react";
import { whenIdle } from "@/lib/idle";

/** True once the first screen has loaded and the page is idle: the moment to fetch what lies further down. */
export function useSettled() {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let stop = () => {};
    const settle = () => { stop = whenIdle(() => setSettled(true), 1500); };
    if (document.readyState === "complete") settle(); else window.addEventListener("load", settle, { once: true });
    return () => { window.removeEventListener("load", settle); stop(); };
  }, []);
  return settled;
}
