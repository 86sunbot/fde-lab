import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { CaseState, LicenseClass, SourceStatus } from "../domain/types";

/** Re-render tick for relative-time displays. */
export function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

// ---------- time formatting ----------

export function fmtUTC(ts: number): string {
  return new Date(ts).toISOString().slice(11, 19) + "Z";
}
export function fmtDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 16).replace("T", " ") + "Z";
}
export function fmtAgo(ts: number, now: number): string {
  const m = Math.max(0, Math.round((now - ts) / 60000));
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}
export function fmtDur(min: number): string {
  if (min < 60) return `${Math.round(min)} m`;
  return `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")} m`;
}

// ---------- tones ----------

export type Tone = "teal" | "cyan" | "amber" | "red" | "steel" | "dim";

const CHIP_TONES: Record<Tone, string> = {
  teal: "border-teal/40 text-teal bg-teal/10",
  cyan: "border-cyan/40 text-cyan bg-cyan/10",
  amber: "border-amber/45 text-amber bg-amber/10",
  red: "border-red/45 text-red bg-red/10",
  steel: "border-steel/30 text-steel bg-steel/10",
  dim: "border-line text-low bg-ink-800/70",
};

export function Chip({ tone = "dim", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 border px-1.5 py-[2px] font-mono text-[10px] uppercase tracking-[0.12em] ${CHIP_TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

const BTN_TONES: Record<Tone, string> = {
  teal: "bg-teal text-ink-950 border-teal hover:bg-[#63e5c6] font-semibold",
  cyan: "bg-cyan/15 text-cyan border-cyan/50 hover:bg-cyan/25",
  amber: "bg-amber/15 text-amber border-amber/50 hover:bg-amber/25",
  red: "bg-red/15 text-red border-red/50 hover:bg-red/25",
  steel: "bg-steel/10 text-steel border-steel/40 hover:bg-steel/20",
  dim: "bg-ink-800 text-mid border-line hover:border-steel/50 hover:text-hi",
};

export function Btn({
  tone = "dim", onClick, children, disabled, className = "", title,
}: {
  tone?: Tone; onClick?: () => void; children: ReactNode; disabled?: boolean; className?: string; title?: string;
}) {
  return (
    <button
      type="button" title={title} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition-all duration-150 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-35 ${BTN_TONES[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Panel({
  title, right, children, className = "", bodyClass = "",
}: {
  title: ReactNode; right?: ReactNode; children: ReactNode; className?: string; bodyClass?: string;
}) {
  return (
    <section className={`flex min-h-0 flex-col border border-line bg-ink-900/85 ${className}`}>
      <header className="flex items-center justify-between gap-2 border-b border-line-soft bg-ink-850/90 px-3 py-1.5">
        <h3 className="font-display text-[13px] font-semibold uppercase tracking-[0.22em] text-mid">{title}</h3>
        <div className="flex items-center gap-1.5">{right}</div>
      </header>
      <div className={`min-h-0 flex-1 ${bodyClass}`}>{children}</div>
    </section>
  );
}

export function StatusDot({ tone, pulse }: { tone: Tone; pulse?: boolean }) {
  const bg: Record<Tone, string> = {
    teal: "bg-teal", cyan: "bg-cyan", amber: "bg-amber", red: "bg-red", steel: "bg-steel", dim: "bg-low",
  };
  return <span className={`inline-block h-[7px] w-[7px] rounded-full ${bg[tone]} ${pulse ? "animate-pulse-dot" : ""}`} />;
}

// ---------- domain badges ----------

export function FreshBadge({ status }: { status: SourceStatus }) {
  const map: Record<SourceStatus, { tone: Tone; label: string }> = {
    fresh: { tone: "teal", label: "Fresh" },
    stale: { tone: "amber", label: "Stale" },
    unavailable: { tone: "red", label: "Unavail" },
    cached: { tone: "cyan", label: "Cached" },
  };
  const m = map[status];
  return <Chip tone={m.tone}>{m.label}</Chip>;
}

export function LicBadge({ license }: { license: LicenseClass }) {
  const map: Record<LicenseClass, Tone> = { permitted: "teal", conditional: "cyan", restricted: "amber", prohibited: "red" };
  return <Chip tone={map[license]}>{license}</Chip>;
}

export const STATE_META: Record<CaseState, { tone: Tone; label: string }> = {
  Nominal: { tone: "teal", label: "Nominal" },
  DisruptionDetected: { tone: "amber", label: "Disruption Detected" },
  ImpactAssessed: { tone: "cyan", label: "Impact Assessed" },
  RecoveryOptionGenerated: { tone: "cyan", label: "Options Generated" },
  MasterApprovalRecorded: { tone: "teal", label: "Master Approval" },
  RecoveryActionCommitted: { tone: "teal", label: "Action Committed" },
  VoyageReplanned: { tone: "teal", label: "Voyage Replanned" },
  OfflineFallback: { tone: "amber", label: "Offline Fallback" },
  Abstention: { tone: "amber", label: "Abstention" },
  Blocked: { tone: "red", label: "Blocked" },
  ReconciliationPending: { tone: "red", label: "Reconciliation" },
};

export function StateChip({ state }: { state: CaseState }) {
  const m = STATE_META[state];
  return <Chip tone={m.tone}>{m.label}</Chip>;
}

export function Meter({ value, max, tone = "teal" }: { value: number; max: number; tone?: Tone }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const bar: Record<Tone, string> = {
    teal: "bg-teal", cyan: "bg-cyan", amber: "bg-amber", red: "bg-red", steel: "bg-steel", dim: "bg-low",
  };
  return (
    <div className="h-[5px] w-full border border-line-soft bg-ink-950">
      <div className={`h-full ${bar[tone]} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------- icons (hand-drawn inline SVG, stroke = currentColor) ----------

export type IconName =
  | "anchor" | "radar" | "alert" | "shield" | "link" | "linkoff" | "check" | "x"
  | "lock" | "spark" | "book" | "clock" | "zap" | "eye" | "layers" | "split" | "wave";

const PATHS: Record<IconName, ReactNode> = {
  anchor: (<><circle cx="12" cy="5" r="2.2" /><path d="M12 7.2V21" /><path d="M4.5 13a7.5 7.5 0 0 0 15 0" /><path d="M2.5 13h4M17.5 13h4" /></>),
  radar: (<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.6" opacity="0.55" /><path d="M12 12l6.2-6.2" /><circle cx="15" cy="14.6" r="0.9" fill="currentColor" stroke="none" /></>),
  alert: (<><path d="M12 3.2 2.6 19.8h18.8z" /><path d="M12 9.5v4.5" /><circle cx="12" cy="16.8" r="0.7" fill="currentColor" stroke="none" /></>),
  shield: (<><path d="M12 2.8l7.2 2.9v6.1c0 4.7-3.1 7.7-7.2 9.4-4.1-1.7-7.2-4.7-7.2-9.4V5.7z" /><path d="M8.8 12l2.3 2.3 4.2-4.6" /></>),
  link: (<><path d="M9.5 14.5l5-5" /><path d="M11.2 6.8l1.6-1.6a3.6 3.6 0 0 1 5.1 5.1l-1.6 1.6" /><path d="M12.8 17.2l-1.6 1.6a3.6 3.6 0 0 1-5.1-5.1l1.6-1.6" /></>),
  linkoff: (<><path d="M11.2 6.8l1.6-1.6a3.6 3.6 0 0 1 5.1 5.1l-1.6 1.6" /><path d="M12.8 17.2l-1.6 1.6a3.6 3.6 0 0 1-5.1-5.1l1.6-1.6" /><path d="M4 4l16 16" /></>),
  check: (<path d="M4.5 12.8l4.7 4.7L19.5 6.6" />),
  x: (<path d="M6 6l12 12M18 6L6 18" />),
  lock: (<><rect x="5" y="11" width="14" height="9.2" /><path d="M8.2 11V7.8a3.8 3.8 0 0 1 7.6 0V11" /><circle cx="12" cy="15.5" r="1" fill="currentColor" stroke="none" /></>),
  spark: (<path d="M12 2.5l1.9 6.6 6.6 1.9-6.6 1.9L12 19.5l-1.9-6.6-6.6-1.9 6.6-1.9z" />),
  book: (<><path d="M4.5 5a2.2 2.2 0 0 1 2.2-2.2h12.8v18.7H6.7a2.2 2.2 0 0 0-2.2 2.2z" /><path d="M4.5 21.5a2.2 2.2 0 0 1 2.2-2.2h12.8" /></>),
  clock: (<><circle cx="12" cy="12" r="8.6" /><path d="M12 7v5.2l3.4 2" /></>),
  zap: (<path d="M13 2.5 4.5 13.8h5.7l-1.2 7.7 8.5-11.3h-5.7z" />),
  eye: (<><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.6" /></>),
  layers: (<><path d="M12 3 2.5 8 12 13l9.5-5z" /><path d="M2.5 13 12 18l9.5-5" opacity="0.6" /></>),
  split: (<><path d="M12 3v7" /><path d="M12 10 5.5 16.5" /><path d="M12 10l6.5 6.5" /><path d="M5.5 16.5V21M18.5 16.5V21" /></>),
  wave: (<><path d="M2 10c2.5 0 2.5-2.6 5-2.6s2.5 2.6 5 2.6 2.5-2.6 5-2.6 2.5 2.6 5 2.6" /><path d="M2 16c2.5 0 2.5-2.6 5-2.6s2.5 2.6 5 2.6 2.5-2.6 5-2.6 2.5 2.6 5 2.6" opacity="0.55" /></>),
};

export function Icon({ name, size = 15, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
