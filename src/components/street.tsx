/** A row of homes with the church among them. Lit windows are the neighbors the invitation is for. */
const HOMES: { x: number; w: number; h: number; roof: "gable" | "flat" | "hip"; lit: boolean; door: number }[] = [
  { x: 10, w: 62, h: 44, roof: "gable", lit: false, door: 0.3 },
  { x: 84, w: 48, h: 62, roof: "flat", lit: true, door: 0.6 },
  { x: 150, w: 70, h: 40, roof: "hip", lit: false, door: 0.5 },
  { x: 236, w: 54, h: 54, roof: "gable", lit: true, door: 0.35 },
  { x: 306, w: 44, h: 70, roof: "flat", lit: false, door: 0.5 },
  { x: 372, w: 66, h: 42, roof: "gable", lit: true, door: 0.65 },
  { x: 620, w: 60, h: 46, roof: "hip", lit: true, door: 0.4 },
  { x: 694, w: 46, h: 66, roof: "flat", lit: false, door: 0.5 },
  { x: 756, w: 68, h: 42, roof: "gable", lit: true, door: 0.3 },
  { x: 842, w: 52, h: 58, roof: "gable", lit: false, door: 0.6 },
  { x: 910, w: 48, h: 72, roof: "flat", lit: true, door: 0.45 },
  { x: 976, w: 70, h: 40, roof: "hip", lit: false, door: 0.55 },
  { x: 1062, w: 56, h: 50, roof: "gable", lit: true, door: 0.4 },
  { x: 1134, w: 56, h: 60, roof: "flat", lit: false, door: 0.5 },
];

const BASE = 150;

export function Street({ className = "" }: { className?: string }) {
  let lit = 0;
  return (
    <svg viewBox="0 0 1200 160" className={`street ${className}`} role="img" aria-label="A street of homes with a church in the middle. Some windows are lit." preserveAspectRatio="xMidYMax meet">
      <g fill="none" stroke="var(--ink)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
        <path d={`M0 ${BASE}H1200`} />
        {HOMES.map((h, n) => {
          const top = BASE - h.h;
          const roof =
            h.roof === "gable"
              ? `M${h.x - 5} ${top}L${h.x + h.w / 2} ${top - 20}L${h.x + h.w + 5} ${top}`
              : h.roof === "hip"
                ? `M${h.x - 5} ${top}L${h.x + 12} ${top - 14}H${h.x + h.w - 12}L${h.x + h.w + 5} ${top}`
                : `M${h.x - 3} ${top}H${h.x + h.w + 3}`;
          const dx = h.x + h.w * h.door - 6;
          const wx = h.door < 0.5 ? h.x + h.w - 22 : h.x + 9;
          const i = h.lit ? lit++ : 0;
          return (
            <g key={n}>
              <path d={`M${h.x} ${BASE}V${top}H${h.x + h.w}V${BASE}`} fill="var(--paper)" />
              <path d={roof} />
              <path d={`M${dx} ${BASE}v-17h12v17`} />
              <rect x={wx} y={top + 10} width="13" height="13" rx="1" className={h.lit ? "window" : undefined} fill={h.lit ? "var(--gold-bright)" : "none"} style={{ "--i": i } as React.CSSProperties} />
              {h.h > 56 ? <rect x={wx} y={top + 32} width="13" height="13" rx="1" /> : null}
            </g>
          );
        })}
        {/* The church: open doors, a steeple, light inside. */}
        <g>
          <path d={`M468 ${BASE}V92L528 56L588 92V${BASE}`} fill="var(--paper)" />
          <path d="M460 96L528 54L596 96" />
          <path d="M514 62V30L528 8L542 30V62" fill="var(--paper)" />
          <path d="M528 8V-2M523 2h10" stroke="var(--accent)" strokeWidth="1.8" />
          <path d={`M512 ${BASE}V118a16 16 0 0 1 32 0V${BASE}`} fill="var(--gold-bright)" className="window" />
          <path d={`M528 104V${BASE}`} />
          <circle cx="528" cy="84" r="7" fill="var(--gold-bright)" className="window" />
          <path d={`M512 ${BASE}L498 ${BASE + 8}M544 ${BASE}L558 ${BASE + 8}`} />
        </g>
        {/* Trees */}
        {[440, 606, 224, 830, 1050].map((x, n) => (
          <g key={x} stroke="var(--accent)">
            <path d={`M${x} ${BASE}v-16`} />
            <circle cx={x} cy={BASE - 24 - (n % 2) * 4} r={8 + (n % 3) * 2} fill="var(--accent-soft)" />
          </g>
        ))}
      </g>
    </svg>
  );
}
