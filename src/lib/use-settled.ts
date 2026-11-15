import { useEffect, useState } from "react";

/** True once the first screen has loaded and the page is idle: the moment to fetch what lies further down. */
export function useSettled() {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let idle = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      if ("requestIdleCallback" in window) idle = window.requestIdleCallback(() => setSettled(true), { timeout: 1500 });
      else timer = setTimeout(() => setSettled(true), 200);
    };
    if (document.readyState === "complete") settle(); else window.addEventListener("load", settle, { once: true });
    return () => { window.removeEventListener("load", settle); clearTimeout(timer); if (idle) window.cancelIdleCallback(idle); };
  }, []);
  return settled;
}
