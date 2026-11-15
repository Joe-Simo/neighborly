"use client";

import { useEffect, useRef, useState } from "react";

export function SharedWindow({ selected }: { selected: 0 | 1 | 2 }) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<{ setSelected(value: 0 | 1 | 2): void; dispose(): void } | null>(null);
  const current = useRef(selected);
  const [failed, setFailed] = useState(false);
  useEffect(() => { current.current = selected; controller.current?.setSelected(selected); }, [selected]);
  useEffect(() => {
    let disposed = false;
    void import("@/lib/shared-window-controller").then(({ createSharedWindowController }) => {
      if (disposed || !host.current) return;
      controller.current = createSharedWindowController(host.current, { onError: () => setFailed(true) });
      controller.current.setSelected(current.current);
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; controller.current?.dispose(); controller.current = null; };
  }, []);
  return <div className="shared-window-stage" ref={host} aria-hidden="true">{failed && <div className="shared-window-fallback"><i /><i /><i /></div>}</div>;
}
