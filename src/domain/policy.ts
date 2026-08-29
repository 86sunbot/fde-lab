// Centralized policy: pinned versions, budgets, thresholds, permissions, state machine.
// Every rule the PRD calls a "hard control" lives here — nowhere else.

import type { CaseState, Role } from "./types";

/** Pinned material versions — recorded on every audit entry (NFR-04). */
export const VERSIONS = {
  engine: "O2-1.4.0",
  policy: "POL-2026.02",
  dataset: "SYN-140@v1.0",
  app: "0.9.0-workshop",
  // Synthetic stand-in for the workshop. Real provider/model is an OPEN DECISION.
  model: "gemini-2.5-flash@2025-06-17·synthetic-stand-in",
  prompt: "P-RECOV-07",
} as const;

/** NFR-05 cost ceilings (per UTC day, workshop values). */
export const BUDGETS = {
  satKbDay: 5120,
  aiTokensDay: 200_000,
  advisoryCallTokens: 4_200,
  advisoryCallSatKb: 14,
  syncKbPerSpoolEvent: 0.9,
} as const;

/** NFR-06 interoperability thresholds. */
export const THRESHOLDS = {
  clockDriftMaxSec: 30,
  aisGapAlertMin: 20,
  weatherStaleAfterMin: 180,
  portStaleAfterMin: 120,
  telemetryStaleAfterMin: 30,
  aisStaleAfterMin: 45,
  cargoStaleAfterMin: 240,
  crewStaleAfterMin: 360,
} as const;

export type ActionKind =
  | "approve"
  | "rejectOption"
  | "commit"
  | "publishReplan"
  | "closeCase"
  | "clearViolation"
  | "assembleContext"
  | "generateOptions"
  | "requestAdvisory"
  | "resolveDivergence"
  | "viewRestricted"
  | "shoreEdit"
  | "viewAudit";

/** FR-04 / NFR-02 — role-based access. Master holds final approval; it cannot be delegated. */
export const PERMISSIONS: Record<Role, ActionKind[]> = {
  master: [
    "approve", "rejectOption", "closeCase", "resolveDivergence",
    "requestAdvisory", "viewRestricted", "viewAudit", "assembleContext", "generateOptions",
  ],
  foc: [
    "assembleContext", "generateOptions", "commit", "publishReplan",
    "requestAdvisory", "viewRestricted", "viewAudit", "shoreEdit", "resolveDivergence",
  ],
  safety: ["clearViolation", "viewAudit"],
  vp: ["viewAudit"],
  analyst: ["viewAudit"],
};

export function can(role: Role, action: ActionKind): boolean {
  return PERMISSIONS[role].includes(action);
}

export const ROLE_LABELS: Record<Role, string> = {
  master: "Master / Bridge",
  foc: "FOC Operator",
  safety: "Safety & Compliance",
  vp: "VP Fleet Ops",
  analyst: "Analyst (read-only)",
};

/** PRD §8 — legal transitions of the case state machine. */
export const ALLOWED_TRANSITIONS: Record<CaseState, CaseState[]> = {
  Nominal: ["DisruptionDetected"],
  DisruptionDetected: ["ImpactAssessed", "OfflineFallback", "Abstention"],
  ImpactAssessed: ["RecoveryOptionGenerated", "Abstention", "OfflineFallback"],
  RecoveryOptionGenerated: ["MasterApprovalRecorded", "Blocked", "Abstention", "ImpactAssessed", "ReconciliationPending"],
  MasterApprovalRecorded: ["RecoveryActionCommitted", "Blocked", "ReconciliationPending"],
  RecoveryActionCommitted: ["VoyageReplanned", "ReconciliationPending"],
  VoyageReplanned: ["Nominal", "ReconciliationPending"],
  OfflineFallback: ["DisruptionDetected", "ImpactAssessed", "RecoveryOptionGenerated", "MasterApprovalRecorded", "ReconciliationPending"],
  Abstention: ["ImpactAssessed"],
  Blocked: ["RecoveryOptionGenerated"],
  ReconciliationPending: [
    "RecoveryOptionGenerated", "MasterApprovalRecorded", "RecoveryActionCommitted",
    "VoyageReplanned", "ImpactAssessed", "Nominal", "DisruptionDetected",
  ],
};

export function transitionAllowed(from: CaseState, to: CaseState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Data-contract classification shown on every source card (PRD §6). */
export const SOURCE_POLICY: Record<
  string,
  { license: "permitted" | "conditional" | "restricted" | "prohibited"; purpose: string }
> = {
  telemetry: { license: "permitted", purpose: "Runtime support · timestamp/sequence preserved, drift normalized" },
  ais: { license: "conditional", purpose: "Runtime/model dev · provider license required, geographic gaps exposed" },
  weather: { license: "conditional", purpose: "Runtime support · license/freshness/SLA, forecast uncertainty shown" },
  port: { license: "conditional", purpose: "Runtime support · semantics/freshness/availability validated" },
  cargo: { license: "restricted", purpose: "Runtime optimization · minimized, tenant-isolated, gated" },
  crew: { license: "restricted", purpose: "Runtime support · personal data, purpose-limited, role-controlled" },
};

/** Recovery-value scoring weights — deterministic, auditable (GS-02). */
export const SCORING = {
  wDelay: -0.9, // per hour
  wCost: -0.00004, // per USD
  base: 60,
  riskAdj: { low: 18, medium: 8, high: -6 } as Record<"low" | "medium" | "high", number>,
} as const;
