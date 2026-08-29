// NORTHWATCH FOC — domain types (workshop build, synthetic data only)

export type Role = "master" | "foc" | "safety" | "vp" | "analyst";
export type SystemActor = "system" | "vessel-edge" | "shore-sync";
export type Actor = Role | SystemActor;

export type SourceId = "telemetry" | "ais" | "weather" | "port" | "cargo" | "crew";
export type SourceStatus = "fresh" | "stale" | "unavailable" | "cached";
export type LicenseClass = "permitted" | "conditional" | "restricted" | "prohibited";

export type EventType =
  | "TELEMETRY_ALERT"
  | "POSITION_REPORT"
  | "MAINTENANCE_FLAG"
  | "PORT_UPDATE"
  | "CARGO_STATUS"
  | "CREW_REST"
  | "ADVISORY_REQUEST"
  | "MANUAL_NOTE";

export interface OpEvent {
  seq: number;
  eventId: string;
  idemKey: string;
  vesselId: string;
  type: EventType;
  tsSource: number; // source clock (may carry drift)
  tsReceived: number; // receiver clock (canonical)
  driftNormalized: boolean;
  origin: "vessel" | "shore" | "external";
  summary: string;
}

export interface EventInput {
  eventId: string;
  idemKey?: string;
  vesselId: string;
  type: EventType;
  tsSource: number;
  origin: "vessel" | "shore" | "external";
  summary: string;
  dedupeKey?: string;
}

export type CaseState =
  | "Nominal"
  | "DisruptionDetected"
  | "ImpactAssessed"
  | "RecoveryOptionGenerated"
  | "MasterApprovalRecorded"
  | "RecoveryActionCommitted"
  | "VoyageReplanned"
  | "OfflineFallback"
  | "Abstention"
  | "Blocked"
  | "ReconciliationPending";

export interface SourceSnapshot {
  id: SourceId;
  label: string;
  status: SourceStatus;
  retrievedAt: number | null;
  elapsedMin: number | null;
  staleAfterMin: number;
  license: LicenseClass;
  headline: string;
  detail: string;
  critical: boolean;
  conflict?: { withLabel: string; valueA: string; valueB: string };
  note?: string;
}

export interface ContextBundle {
  assembledAt: number;
  sources: SourceSnapshot[];
  warnings: string[];
}

export type CheckKind = "safety" | "crew" | "cargo" | "port" | "maintenance" | "commercial";

export interface ConstraintCheck {
  id: string;
  label: string;
  kind: CheckKind;
  sourceId: SourceId;
  critical: boolean;
  pass: boolean | null; // null = undetermined (stale / unavailable / conflicting evidence)
  detail: string;
}

export interface RecoveryOption {
  id: string;
  label: string;
  summary: string;
  advisory: boolean;
  feasible: boolean;
  blockedReason?: string;
  checks: ConstraintCheck[];
  delayHrs: number;
  costUsd: number;
  risk: "low" | "medium" | "high";
  recoveryScore: number;
  evidenceRefs: string[];
  effects: { destination?: string; eta?: string; speedKn?: number; note: string };
}

export interface ApprovalRecord {
  by: Role;
  at: number;
  optionId: string;
  evidenceRefs: string[];
}

export interface AbstentionRecord {
  at: number;
  code: "MATERIAL_MISSING" | "CONFLICTING_EVIDENCE" | "NO_FEASIBLE_OPTION" | "STALE_SAFETY_EVIDENCE";
  reason: string;
  manualFallback: boolean;
  missingSources: SourceId[];
}

export interface ViolationRecord {
  at: number;
  actor: Actor;
  attempted: string;
}

export interface DivergenceField {
  field: string;
  vesselValue: string;
  shoreValue: string;
  resolvedTo?: "vessel" | "shore";
}

export interface AdvisoryNote {
  at: number;
  model: string;
  prompt: string;
  summary: string;
  uncertainty: string;
  confidence: "low" | "medium" | "high";
  citations: string[];
  optionId?: string;
}

export interface VoyageCase {
  id: string;
  vesselId: string;
  disruption: {
    type: string;
    summary: string;
    detectedAt: number;
    criticalSources: SourceId[];
  };
  state: CaseState;
  prevState: CaseState;
  context: ContextBundle | null;
  options: RecoveryOption[];
  selectedOptionId: string | null;
  abstain: AbstentionRecord | null;
  violation: ViolationRecord | null;
  approval: ApprovalRecord | null;
  committedOptionId: string | null;
  vesselFields: Record<string, string>; // canonical vessel-side state (reconciliation source of truth)
  shoreEdits: DivergenceField[];
  timeline: { at: number; state: CaseState; by: Actor; note?: string }[];
  advisoryNotes: AdvisoryNote[];
  commercialOptBlocked: string | null;
}

export interface AuditEntry {
  id: number;
  at: number;
  actor: Actor;
  action: string;
  severity: "info" | "ok" | "warn" | "violation";
  caseId?: string;
  vesselId?: string;
  detail: string;
  evidenceRefs: string[];
  beforeAfter?: { field: string; before: string; after: string }[];
  versions: {
    engine: string;
    policy: string;
    dataset: string;
    app: string;
    model?: string;
    prompt?: string;
  };
}

export interface Vessel {
  id: string;
  name: string;
  imo: string;
  kind: string;
  route: string;
  position: string;
  sogKn: number;
  hdg: number;
  draftM: number;
  status: "nominal" | "disruption" | "offline" | "recovery";
  caseId?: string;
  blip: { x: number; y: number };
}

export interface Toast {
  id: number;
  kind: "info" | "ok" | "warn" | "violation";
  text: string;
}

export interface Metrics {
  planTimesMin: number[];
  dupDropped: number;
  dupOperationalActions: number; // must remain 0 (FR-01)
  rejectedInputs: number;
  blockedActions: number;
  unauthorizedSuccess: number; // must remain 0 (NFR-02)
  retries: number;
  offlineEssentialRuns: number;
  offlineEssentialFailures: number; // must remain 0 (NFR-01)
  provenanceComplete: number;
  provenanceTotal: number;
  navWriteAttempts: number;
  navWriteSuccess: number; // must remain 0 (data contract)
}

export type CaseOverrides = {
  staleWeather?: boolean;
  portDown?: boolean;
  conflict?: boolean;
  tightWindow?: boolean;
  aisGap?: boolean;
};

export interface OrchestratorState {
  role: Role;
  view: "operations" | "verification" | "governance";
  vessels: Vessel[];
  cases: Record<string, VoyageCase>;
  activeCaseId: string | null;
  eventLog: OpEvent[];
  seenIdem: Record<string, number>;
  spool: OpEvent[]; // vessel-edge spool awaiting sync
  audit: AuditEntry[];
  connectivity: "online" | "offline";
  offlineSince: number | null;
  blackouts: { start: number; end: number | null }[];
  cost: { satKb: number; aiTokens: number };
  advisoryEnabled: boolean;
  overrides: Record<string, CaseOverrides>;
  toasts: Toast[];
  seqCounter: number;
  auditCounter: number;
  toastCounter: number;
  metrics: Metrics;
  restrictedGrants: Record<string, Partial<Record<"cargo" | "crew", { role: Role; at: number; purpose: string } | "denied">>>;
}

export interface GoldenCheck {
  label: string;
  pass: boolean;
  detail: string;
}

export interface GoldenResult {
  id: string;
  name: string;
  prdRef: string;
  pass: boolean;
  checks: GoldenCheck[];
}

export interface GoldenSummary {
  suite: string;
  dataset: string;
  scenarios: GoldenResult[];
  allPass: boolean;
  metrics: {
    dupDropped: number;
    dupOperationalActions: number;
    unauthorizedAttempts: number;
    unauthorizedSuccess: number;
    abstentions: number;
    rejectedInputs: number;
    offlineEssentialRuns: number;
    offlineEssentialFailures: number;
    provenancePct: number;
    medianPlanMin: number | null;
    p90PlanMin: number | null;
  };
}
