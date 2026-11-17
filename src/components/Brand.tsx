import type { ReactNode } from "react";

/** The official MyIntel fingerprint-home symbol, tinted with the current text colour. */
export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return <span className={`mi-logo ${className}`} style={{ width: size, height: size }} aria-hidden="true" />;
}

const arc = (r: number) => {
  const cx = 80, cy = 98, a1 = (205 * Math.PI) / 180, a2 = (-25 * Math.PI) / 180;
  const p = (a: number) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy - r * Math.sin(a)).toFixed(1)}`;
  return `M${p(a1)}A${r} ${r} 0 1 1 ${p(a2)}`;
};

/**
 * Progress drawn as the brand fingerprint: one ridge over the home for each
 * part finished. Decorative; pair it with a text count.
 */
export function HomePrint({ done, total, size = 132, tone = "light", children }: { done: number; total: number; size?: number; tone?: "light" | "dark"; children?: ReactNode }) {
  const ridges = Math.max(1, Math.min(total, 6)), filled = total ? Math.round((done / total) * ridges) : 0, complete = total > 0 && done >= total;
  return <span className={`home-print home-print--${tone}${complete ? " is-complete" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
    <svg viewBox="0 0 160 160" focusable="false">
      {Array.from({ length: ridges }, (_, i) => <g key={i}>
        <path className="home-print__track" d={arc(34 + i * 8.5)} />
        <path className="home-print__ridge" d={arc(34 + i * 8.5)} pathLength={1} style={{ strokeDashoffset: i < filled ? 0 : 1, transitionDelay: `${i * 90}ms` }} />
      </g>)}
      <path className="home-print__house" d="M58 100 80 80l22 20v22H58Z" />
      <path className="home-print__window" d="M74 102h5v5h-5zm7 0h5v5h-5zm-7 7h5v5h-5zm7 0h5v5h-5z" />
      <path className="home-print__base" d="M44 136q18-9 36 0t36 0M56 149q12-7 24 0t24 0" />
    </svg>
    {children}
  </span>;
}

export type GlyphName = "home" | "list" | "help" | "inbox" | "user" | "wrench" | "bulb" | "heart" | "phone" | "route" | "check" | "alert" | "question" | "arrow" | "door" | "shield" | "people" | "clipboard" | "pen" | "spark" | "search" | "mail" | "print" | "x";

/** Small line icons in the same stroke weight as the room drawings. */
export function Glyph({ name, className = "" }: { name: GlyphName; className?: string }) {
  return <svg className={`glyph ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === "home" && <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>}
    {name === "list" && <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h8M8 16h5" /></>}
    {name === "help" && <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" /><path d="m5.6 5.6 3.9 3.9m5 5 3.9 3.9m0-12.800-3.900 3.900m-5 5-3.900 3.900" /></>}
    {name === "inbox" && <><path d="M3 13 6 4h12l3 9v6H3z" /><path d="M3 13h5l1 3h6l1-3h5" /></>}
    {name === "user" && <><circle cx="12" cy="8" r="4" /><path d="M4 21q0-7 8-7t8 7" /></>}
    {name === "wrench" && <path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L3 18l3 3 6.2-6.2a4 4 0 0 0 5.3-5.3L15 12l-3-3z" />}
    {name === "bulb" && <><path d="M9 18h6M10 21h4" /><path d="M8 14a6 6 0 1 1 8 0q-1 1-1 2H9q0-1-1-2z" /></>}
    {name === "heart" && <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.600-7 10-7 10z" />}
    {name === "phone" && <path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" />}
    {name === "route" && <><circle cx="6" cy="18" r="2.500" /><circle cx="18" cy="6" r="2.500" /><path d="M8.500 18H14a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h5.500" /></>}
    {name === "check" && <path d="m5 12 4.500 4.500L19 7" />}
    {name === "alert" && <><path d="M12 4 3 20h18z" /><path d="M12 10v4M12 17h.010" /></>}
    {name === "question" && <><circle cx="12" cy="12" r="9" /><path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.700.400-1 .900-1 1.700M12 17h.010" /></>}
    {name === "arrow" && <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>}
    {name === "door" && <><path d="M6 21V4h12v17" /><path d="M3 21h18M14 12h.010" /></>}
    {name === "shield" && <><path d="M12 3 5 6v6c0 4.500 3 7.500 7 9 4-1.500 7-4.500 7-9V6z" /><path d="m9 12 2 2 4-4" /></>}
    {name === "people" && <><circle cx="9" cy="8" r="3.500" /><path d="M2.500 20q0-6 6.500-6t6.500 6" /><path d="M16 5a3.500 3.500 0 0 1 0 6.500M18 14.500q3.500 1 3.500 5.500" /></>}
    {name === "clipboard" && <><rect x="5" y="5" width="14" height="16" rx="2.500" /><path d="M9 5V3h6v2M9 11h6M9 15h4" /></>}
    {name === "pen" && <><path d="m4 20 1-5L16 4l4 4L9 19z" /><path d="m14 6 4 4" /></>}
    {name === "spark" && <path d="M12 3v5m0 8v5M3 12h5m8 0h5M6 6l3 3m6 6 3 3m0-12-3 3m-6 6-3 3" />}
    {name === "search" && <><circle cx="11" cy="11" r="6.500" /><path d="m16 16 5 5" /></>}
    {name === "x" && <path d="m6 6 12 12M18 6 6 18" />}
    {name === "mail" && <><rect x="3" y="5" width="18" height="14" rx="2.500" /><path d="m3 7 9 6 9-6" /></>}
    {name === "print" && <><path d="M7 8V3h10v5" /><rect x="3" y="8" width="18" height="9" rx="2" /><path d="M7 14h10v7H7z" /></>}
  </svg>;
}

const STAGES = ["About you", "Your home", "Daily life", "Room check", "Your plan"] as const;

/** Where the reader is in the guided home check. */
export function FlowStages({ current }: { current: 0 | 1 | 2 | 3 | 4 }) {
  return <ol className="flow-stages" aria-label="Home check stages">{STAGES.map((label, index) => <li key={label} className={index < current ? "is-done" : index === current ? "is-current" : ""} aria-current={index === current ? "step" : undefined}>
    <span className="flow-stages__dot" aria-hidden="true">{index < current ? <Glyph name="check" /> : index + 1}</span><span className="flow-stages__label">{label}</span>
  </li>)}</ol>;
}
