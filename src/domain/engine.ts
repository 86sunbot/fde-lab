// NORTHWATCH FOC — deterministic O2 core.
// Pure functions over OrchestratorState. No I/O, no randomness: identical inputs → identical
// audit trail. Every guard the PRD calls a hard control is enforced here (FR-01..05, NFR-01..07).

import type {
  Actor, AuditEntry, CaseOverrides, EventInput, EventType, OpEvent,
  OrchestratorState, Role, VoyageCase,
} from "./types";
import { buildFacts, DISRUPTION_DEFS, evaluateOptions, FLEET, makeSources } from "./fixtures";
import { BUDGETS, can, ROLE_LABELS, THRESHOLDS, transitionAllowed, VERSIONS } from "./policy";

const KNOWN_TYPES: EventType[] = [
  "TELEMETRY_ALERT", "POSITION_REPORT", "MAINTENANCE_FLAG", "PORT_UPDATE",
  "CARGO_STATUS", "CREW_REST", "ADVISORY_REQUEST", "MANUAL_NOTE",
];

const CASE_ID_POOL = ["CS-014", "CS-021", "CS-032", "CS-040", "CS-051", "CS-063"];

const MIN = 60_000;

function clone(st: OrchestratorState): OrchestratorState {
  return {
    ...st,
    vessels: st.vessels.map((v) => ({ ...v, blip: { ...v.blip } })),
    cases: Object.fromEntries(
      Object.entries(st.cases).map(([k, c]) => [
        k,
        {
          ...c,
          disruption: { ...c.disruption, criticalSources: [...c.disruption.criticalSources] },
          timeline: c.timeline.map((t) => ({ ...t })),
          options: c.options.map((o) => ({ ...o, checks: o.checks.map((ch) => ({ ...ch })), evidenceRefs: [...o.evidenceRefs], effects: { ...o.effects } })),
          advisoryNotes: c.advisoryNotes.map((n) => ({ ...n, citations: [...n.citations] })),
          shoreEdits: c.shoreEdits.map((d) => ({ ...d })),
          vesselFields: { ...c.vesselFields },
        },
      ]),
    ),
    eventLog: [...st.eventLog],
    seenIdem: { ...st.seenIdem },
    spool: [...st.spool],
    audit: [...st.audit],
    blackouts: st.blackouts.map((b) => ({ ...b })),
    cost: { ...st.cost },
    overrides: Object.fromEntries(Object.entries(st.overrides).map(([k, v]) => [k, { ...v }])),
    toasts: [...st.toasts],
    metrics: { ...st.metrics, planTimesMin: [...st.metrics.planTimesMin] },
    restrictedGrants: { ...st.restrictedGrants },
  };
}

function audit(
  s: OrchestratorState, at: number, actor: Actor, action: string,
  severity: AuditEntry["severity"], detail: string,
  evidenceRefs: string[] = [], extra?: Partial<AuditEntry>,
): void {
  s.auditCounter += 1;
  s.audit.push({
    id: s.auditCounter,
    at, actor, action, severity, detail,
    evidenceRefs: [...evidenceRefs],
    versions: { engine: VERSIONS.engine, policy: VERSIONS.policy, dataset: VERSIONS.dataset, app: VERSIONS.app, ...(extra?.versions ?? {}) },
    ...(extra ?? {}),
  });
}

function toast(s: OrchestratorState, kind: "info" | "ok" | "warn" | "violation", text: string): void {
  s.toastCounter += 1;
  s.toasts.push({ id: s.toastCounter, kind, text });
  if (s.toasts.length > 4) s.toasts.shift();
}

function go(s: OrchestratorState, c: VoyageCase, to: VoyageCase["state"], by: Actor, at: number, note?: string): boolean {
  if (c.state === to) {
    if (note) c.timeline.push({ at, state: to, by, note });
    return true;
  }
  const ok = transitionAllowed(c.state, to) || to === "OfflineFallback" || c.state === "OfflineFallback";
  if (!ok) {
    audit(s, at, by, "InvalidTransitionBlocked", "warn", `State machine guard: ${c.state} → ${to} is not permitted (PRD §8). Transition refused.`, [], { caseId: c.id });
    return false;
  }
  c.prevState = c.state;
  c.state = to;
  c.timeline.push({ at, state: to, by, note });
  return true;
}

function shiftIso(iso: string, hrs: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t + hrs * 3_600_000).toISOString().slice(0, 16) + "Z";
}

function nextCaseId(s: OrchestratorState): string {
  for (const id of CASE_ID_POOL) if (!s.cases[id]) return id;
  return `CS-${300 + Object.keys(s.cases).length}`;
}

// ---------------------------------------------------------------- lifecycle

export function createInitialState(baseNow: number, mode: "live" | "bare" = "live"): OrchestratorState {
  let s: OrchestratorState = {
    role: "foc",
    view: "operations",
    vessels: FLEET.map((v) => ({ ...v, blip: { ...v.blip } })),
    cases: {},
    activeCaseId: null,
    eventLog: [],
    seenIdem: {},
    spool: [],
    audit: [],
    connectivity: "online",
    offlineSince: null,
    blackouts: [],
    cost: { satKb: 0, aiTokens: 0 },
    advisoryEnabled: true,
    overrides: {},
    toasts: [],
    seqCounter: 0,
    auditCounter: 0,
    toastCounter: 0,
    metrics: {
      planTimesMin: [], dupDropped: 0, dupOperationalActions: 0, rejectedInputs: 0,
      blockedActions: 0, unauthorizedSuccess: 0, retries: 0,
      offlineEssentialRuns: 0, offlineEssentialFailures: 0,
      provenanceComplete: 0, provenanceTotal: 0, navWriteAttempts: 0, navWriteSuccess: 0,
    },
    restrictedGrants: {},
  };

  audit(s, baseNow - 46 * MIN, "system", "SystemReady", "info",
    `Deterministic core ${VERSIONS.engine} initialized · policy ${VERSIONS.policy} · dataset ${VERSIONS.dataset} (synthetic, workshop-only).`,
    ["manifest@boot"]);

  if (mode === "bare") return s;

  // ---- seed: Aurora Bay engine cooling disruption (same code path as live operation)
  const t = (m: number) => baseNow - m * MIN;
  s.role = "foc";
  s = ingestEvent(s, {
    eventId: "EV-8841", vesselId: "VB-01", type: "TELEMETRY_ALERT", tsSource: t(14),
    origin: "vessel", summary: "JW cooling temp 96 °C — Δ +14 °C over baseline", dedupeKey: "JW-TEMP-96",
  }, t(14));
  s = ingestEvent(s, {
    eventId: "EV-8842", vesselId: "VB-01", type: "TELEMETRY_ALERT", tsSource: t(9),
    origin: "vessel", summary: "Lube oil temperature trend +6 °C/h — corroborating", dedupeKey: "LO-TREND",
  }, t(9));
  // replay of EV-8841 (satellite retransmit) → must be dropped, zero operational effect
  s = ingestEvent(s, {
    eventId: "EV-8841-R1", vesselId: "VB-01", type: "TELEMETRY_ALERT", tsSource: t(14),
    origin: "vessel", summary: "JW cooling temp 96 °C — Δ +14 °C over baseline", dedupeKey: "JW-TEMP-96",
  }, t(8));
  s = ingestEvent(s, {
    eventId: "EV-8843", vesselId: "VB-01", type: "POSITION_REPORT", tsSource: t(6),
    origin: "external", summary: "12°41.2′N 068°12.7′E · SOG 18.2 kn · hdg 097°", dedupeKey: "POS-0612",
  }, t(6));
  // Boreal Crown congestion disruption — left at DisruptionDetected for the operator to work
  s = ingestEvent(s, {
    eventId: "EV-5512", vesselId: "VB-02", type: "PORT_UPDATE", tsSource: t(11),
    origin: "external", summary: "Qingdao berth withdrawn — congestion, berthing window missed", dedupeKey: "QDG-BERTH",
  }, t(11));

  const aurora = Object.values(s.cases).find((c) => c.vesselId === "VB-01");
  if (aurora) {
    aurora.vesselFields = { eta: "2026-05-18T14:30Z", dest: "Singapore (SGSIN)", sogPlan: "18.2 kn" };
    s.activeCaseId = aurora.id;
    s = assembleContext(s, aurora.id, t(5), "foc");
    s = generateOptions(s, aurora.id, t(4), "foc");
  }
  const boreal = Object.values(s.cases).find((c) => c.vesselId === "VB-02");
  if (boreal) boreal.vesselFields = { eta: "2026-06-02T08:00Z", dest: "Qingdao (CNTAO)", sogPlan: "13.6 kn" };

  // Delft Horizon: vessel-level blackout, edge spool accumulating (9.6% > 60 min population)
  s.blackouts.push({ start: t(42), end: null });
  s.spool.push(
    { seq: 0, eventId: "EV-7701", idemKey: "VB-04|POSITION_REPORT|POS-0554", vesselId: "VB-04", type: "POSITION_REPORT", tsSource: t(39), tsReceived: t(39), driftNormalized: false, origin: "vessel", summary: "54°11.8′N 007°58.3′E · SOG 14.1 kn · spooled at edge" },
    { seq: 0, eventId: "EV-7702", idemKey: "VB-04|TELEMETRY_ALERT|GPS-INT", vesselId: "VB-04", type: "TELEMETRY_ALERT", tsSource: t(31), tsReceived: t(31), driftNormalized: false, origin: "vessel", summary: "GPS antenna intermittent — DR plot maintained, edge spool active" },
  );
  s.cost = { satKb: 318, aiTokens: 0 };
  return s;
}

// ---------------------------------------------------------------- FR-01 capture & dedupe

export function ingestEvent(s0: OrchestratorState, input: EventInput, now: number): OrchestratorState {
  const s = clone(s0);

  // GS-12: adversarial/malformed input — reject safely, corrupt nothing
  const problems: string[] = [];
  if (!input.vesselId || input.vesselId.trim() === "") problems.push("missing vesselId");
  if (!KNOWN_TYPES.includes(input.type)) problems.push(`unknown event type "${String(input.type)}"`);
  if (!Number.isFinite(input.tsSource) || input.tsSource <= 0) problems.push("non-finite source timestamp");
  if (problems.length > 0) {
    s.metrics.rejectedInputs += 1;
    audit(s, now, "vessel-edge", "InputRejected", "warn",
      `Malformed event rejected at gate: ${problems.join("; ")}. No state mutation performed.`, ["raw-packet@edge"]);
    toast(s, "warn", "Malformed packet rejected safely — state untouched");
    return s;
  }

  // NFR-06: clock-drift normalization
  let tsSource = input.tsSource;
  let driftNormalized = false;
  const driftSec = Math.round(Math.abs(tsSource - now) / 1000);
  if (driftSec > THRESHOLDS.clockDriftMaxSec) {
    driftNormalized = true;
    audit(s, now, "vessel-edge", "ClockDriftNormalized", "info",
      `Source clock drift ${driftSec}s exceeds ±${THRESHOLDS.clockDriftMaxSec}s — event re-stamped to receiver clock (NFR-06).`,
      [`telemetry@${input.vesselId}`]);
    tsSource = now;
  }

  const idem = input.idemKey ?? `${input.vesselId}|${input.type}|${input.dedupeKey ?? String(input.tsSource)}`;

  // FR-01: idempotency — replays never create new operational actions
  if (s.seenIdem[idem] !== undefined) {
    s.metrics.dupDropped += 1;
    audit(s, now, "vessel-edge", "DuplicateDropped", "info",
      `Idempotency key "${idem}" already materialized as seq ${s.seenIdem[idem]} — replay discarded. 0 operational actions created.`,
      [`idem@${idem}`]);
    toast(s, "info", `Duplicate event dropped (seq ${s.seenIdem[idem]} holds the original)`);
    return s;
  }

  s.seqCounter += 1;
  const ev: OpEvent = {
    seq: s.seqCounter, eventId: input.eventId, idemKey: idem, vesselId: input.vesselId,
    type: input.type, tsSource, tsReceived: now, driftNormalized, origin: input.origin, summary: input.summary,
  };
  s.seenIdem[idem] = ev.seq;

  if (s.connectivity === "online") {
    s.eventLog.push(ev);
    audit(s, now, "vessel-edge", "EventCaptured", "ok",
      `seq ${ev.seq} · ${ev.type} · ${ev.vesselId} — durably captured${driftNormalized ? " (drift-normalized)" : ""}.`,
      [`${ev.vesselId}@seq${ev.seq}`], { vesselId: ev.vesselId });
  } else {
    s.spool.push(ev);
    audit(s, now, "vessel-edge", "EventSpooledOffline", "warn",
      `seq ${ev.seq} · ${ev.type} · ${ev.vesselId} — captured to edge spool (shore link down, essential continuity).`,
      [`spool@${ev.vesselId}`], { vesselId: ev.vesselId });
  }

  // disruption-triggering events open a recovery case
  const isTrigger = input.type === "TELEMETRY_ALERT" || input.type === "PORT_UPDATE";
  const vessel = s.vessels.find((v) => v.id === input.vesselId);
  const existing = vessel?.caseId ? s.cases[vessel.caseId] : undefined;
  if (isTrigger && vessel && (!existing || existing.state === "Nominal")) {
    const defType = input.type === "PORT_UPDATE" ? "PORT_CONGESTION" : "ENGINE_COOLING";
    const def = DISRUPTION_DEFS[defType];
    const caseId = nextCaseId(s);
    const newCase: VoyageCase = {
      id: caseId, vesselId: vessel.id,
      disruption: { type: defType, summary: def.summary, detectedAt: now, criticalSources: [...def.criticalSources] },
      state: "DisruptionDetected", prevState: "Nominal",
      context: null, options: [], selectedOptionId: null, abstain: null, violation: null,
      approval: null, committedOptionId: null,
      vesselFields: { eta: "2026-06-02T08:00Z", dest: vessel.route.split("→")[1]?.trim() ?? "—", sogPlan: `${vessel.sogKn} kn` },
      shoreEdits: [], timeline: [{ at: now, state: "DisruptionDetected", by: "system", note: `Opened from ${ev.type} seq ${ev.seq}` }],
      advisoryNotes: [], commercialOptBlocked: null,
    };
    s.cases[caseId] = newCase;
    vessel.caseId = caseId;
    vessel.status = "disruption";
    s.activeCaseId = caseId;
    audit(s, now, "system", "CaseOpened", "warn",
      `${caseId} opened for ${vessel.name} — ${defType}. Master authority preserved; no autonomous action possible.`,
      [`${vessel.id}@seq${ev.seq}`], { caseId, vesselId: vessel.id });
    toast(s, "warn", `${caseId} opened — ${vessel.name} · ${defType.replace("_", " ")}`);
  }
  return s;
}

// ---------------------------------------------------------------- FR-02 context assembly

export function assembleContext(s0: OrchestratorState, caseId: string, now: number, actor: Actor): OrchestratorState {
  const s = clone(s0);
  const c = s.cases[caseId];
  if (!c) return s0;
  const ov: CaseOverrides = s.overrides[caseId] ?? {};
  const online = s.connectivity === "online";
  const sources = makeSources(caseId, now, ov, online);

  const warnings: string[] = [];
  for (const src of sources) {
    if (src.status === "stale") warnings.push(`${src.label} is STALE (${src.elapsedMin} m old > ${src.staleAfterMin} m limit) — shown, not concealed.`);
    if (src.status === "unavailable") {
      warnings.push(`${src.label} is UNAVAILABLE after ${3} deterministic retries — manual fallback required.`);
      s.metrics.retries += 3;
    }
    if (src.conflict) warnings.push(`Conflicting evidence on ${src.label}: ${src.conflict.valueA} (feed) vs ${src.conflict.valueB} (${src.conflict.withLabel}).`);
    if (src.status === "cached") warnings.push(`${src.label} served from vessel-edge cache (shore link down).`);
  }
  const facts = buildFacts(caseId, ov);
  if (facts.aisGapMin >= THRESHOLDS.aisGapAlertMin) {
    warnings.push(`AIS gap ${facts.aisGapMin} min between fixes — exposed, no interpolation applied (NFR-06).`);
  }

  c.context = { assembledAt: now, sources, warnings };
  if (c.state === "DisruptionDetected" || c.state === "Abstention") {
    go(s, c, "ImpactAssessed", actor, now, online ? "Context assembled — all sources stamped" : "Context assembled from edge cache — essential continuation");
  } else {
    c.timeline.push({ at: now, state: c.state, by: actor, note: "Context re-assembled — freshness re-stamped" });
  }
  audit(s, now, actor, "ContextAssembled", "ok",
    `${sources.length} sources assembled for ${caseId} · ${sources.filter((x) => x.status === "fresh" || x.status === "cached").length} usable, ${warnings.length} warning(s). Every source carries timestamp + license class.`,
    sources.map((x) => `${x.id}@${x.status === "unavailable" ? "UNAVAIL" : `${x.elapsedMin}m`}`),
    { caseId });
  return s;
}

// ---------------------------------------------------------------- FR-03 feasibility & options

function regenerate(s: OrchestratorState, caseId: string, now: number, actor: Actor): OrchestratorState {
  const c = s.cases[caseId];
  if (!c || !c.context) return s;
  const ov = s.overrides[caseId] ?? {};
  const facts = buildFacts(caseId, ov);
  const advisoryAllowed =
    s.advisoryEnabled && s.connectivity === "online" && c.advisoryNotes.length > 0;
  const res = evaluateOptions(caseId, c.context, facts, ov, now, advisoryAllowed);

  c.options = res.options;
  c.commercialOptBlocked = res.commercialBlocked;
  c.abstain = res.abstain;
  c.selectedOptionId = res.options.find((o) => o.feasible)?.id ?? null;

  if (res.abstain) {
    go(s, c, "Abstention", actor, now, `Abstained: ${res.abstain.code}`);
    audit(s, now, actor, "Abstained", "warn",
      `${caseId} — ${res.abstain.code}: ${res.abstain.reason}${res.abstain.manualFallback ? " Manual fallback engaged; FOC alerted." : ""}`,
      res.abstain.missingSources.map((m) => `${m}@missing`), { caseId });
    toast(s, "warn", `System abstains — ${res.abstain.code.replace(/_/g, " ").toLowerCase()}`);
    return s;
  }

  const firstTime = c.state !== "RecoveryOptionGenerated";
  go(s, c, "RecoveryOptionGenerated", actor, now, `${res.options.filter((o) => o.feasible).length} feasible of ${res.options.length} candidates`);
  if (firstTime) {
    s.metrics.planTimesMin.push(Math.round(((now - c.disruption.detectedAt) / MIN) * 10) / 10);
  }
  if (s.connectivity === "offline") s.metrics.offlineEssentialRuns += 1;

  audit(s, now, actor, "OptionsGenerated", "ok",
    `${caseId} — deterministic solver produced ${res.options.length} candidates (${res.options.filter((o) => o.feasible).length} feasible). Infeasible options blocked with cited constraints; safety overrides commercial.${res.commercialBlocked ? " " + res.commercialBlocked : ""}`,
    res.options.flatMap((o) => o.evidenceRefs), { caseId });
  return s;
}

export function generateOptions(s0: OrchestratorState, caseId: string, now: number, actor: Actor): OrchestratorState {
  const c = s0.cases[caseId];
  if (!c) return s0;
  if (!c.context) {
    const s = clone(s0);
    toast(s, "warn", "Assemble context before option generation (FR-02 gate)");
    audit(s, now, actor, "GenerationGated", "warn", `${caseId} — option generation refused: no assembled context. Abstain-by-default.`, [], { caseId });
    return s;
  }
  return regenerate(clone(s0), caseId, now, actor);
}

export function setOverride(s0: OrchestratorState, caseId: string, key: keyof CaseOverrides, value: boolean, now: number): OrchestratorState {
  const s = clone(s0);
  s.overrides[caseId] = { ...(s.overrides[caseId] ?? {}), [key]: value };
  const c = s.cases[caseId];
  if (c?.context) {
    c.context = null; // force re-assembly so freshness is honestly re-stamped
    if (c.state !== "Nominal" && c.state !== "Blocked") {
      go(s, c, "ImpactAssessed", "system", now, `Scenario condition changed (${key}=${value}) — context invalidated`);
    }
  }
  audit(s, now, "system", "ScenarioConditionSet", "info", `Workshop condition ${key}=${value} applied to ${caseId}. Context must be re-assembled.`, [], { caseId });
  return s;
}

// ---------------------------------------------------------------- FR-04 approval gate

export function selectOption(s0: OrchestratorState, caseId: string, optionId: string, role: Role, now: number): OrchestratorState {
  const s = clone(s0);
  const c = s.cases[caseId];
  if (!c) return s0;
  const o = c.options.find((x) => x.id === optionId);
  if (!o || !o.feasible) {
    s.metrics.blockedActions += 1;
    audit(s, now, role, "InfeasibleSelectionBlocked", "warn", `${caseId} — selection of infeasible option ${optionId} blocked by policy gate.`, [], { caseId });
    toast(s, "warn", "Infeasible options cannot be selected for approval");
    return s;
  }
  c.selectedOptionId = optionId;
  audit(s, now, role, "OptionSelected", "info", `${caseId} — ${o.id} staged for Master approval.`, o.evidenceRefs, { caseId });
  return s;
}

export function requestApproval(s0: OrchestratorState, caseId: string, optionId: string, role: Role, now: number): OrchestratorState {
  const s = clone(s0);
  const c = s.cases[caseId];
  if (!c) return s0;
  if (c.state !== "RecoveryOptionGenerated") {
    audit(s, now, role, "ApprovalGated", "warn", `${caseId} — approval attempted in state ${c.state}; gate requires RecoveryOptionGenerated.`, [], { caseId });
    toast(s, "warn", `Approval gate closed — case is in ${c.state}`);
    return s;
  }
  const o = c.options.find((x) => x.id === optionId);
  if (!o) return s0;
  if (!o.feasible) {
    s.metrics.blockedActions += 1;
    audit(s, now, role, "InfeasibleApprovalBlocked", "warn", `${caseId} — attempt to approve INFEASIBLE option ${o.id} blocked (${o.blockedReason ?? "constraint failure"}).`, o.evidenceRefs, { caseId });
    toast(s, "warn", "Blocked — cannot approve an infeasible option (GS-10)");
    return s;
  }
  // FR-04 / NFR-02 — Master authority is non-delegable
  if (role !== "master") {
    s.metrics.blockedActions += 1;
    c.violation = { at: now, actor: role, attempted: `approve ${o.id}` };
    go(s, c, "Blocked", role, now, "SecurityViolationRaised");
    audit(s, now, role, "SecurityViolationRaised", "violation",
      `${ROLE_LABELS[role]} attempted Master approval on ${o.id} — BLOCKED. Execution halted, case frozen at Blocked, P1 trigger condition logged (NFR-02). Master authority cannot be delegated to shore or AI.`,
      o.evidenceRefs, { caseId, vesselId: c.vesselId });
    toast(s, "violation", "SECURITY VIOLATION — unauthorized approval attempt blocked & audited");
    return s;
  }
  c.approval = { by: "master", at: now, optionId: o.id, evidenceRefs: [...o.evidenceRefs] };
  go(s, c, "MasterApprovalRecorded", "master", now, `Master approved ${o.id} with evidence pack`);
  audit(s, now, "master", "ApprovalRecorded", "ok",
    `${caseId} — Master approved ${o.id} ("${o.label}"). Evidence pack: ${o.evidenceRefs.join(", ")}. Identity, time and versions recorded.`,
    o.evidenceRefs, { caseId, vesselId: c.vesselId });
  toast(s, "ok", `Master approval recorded for ${o.id}`);
  return s;
}

export function rejectOption(s0: OrchestratorState, caseId: string, optionId: string, role: Role, now: number): OrchestratorState {
  const s = clone(s0);
  const c = s.cases[caseId];
  if (!c) return s0;
  audit(s, now, role, "OptionRejected", "info", `${caseId} — ${optionId} rejected by ${ROLE_LABELS[role]}. No execution occurred.`, [], { caseId });
  c.selectedOptionId = null;
  toast(s, "info", `${optionId} rejected — nothing executed`);
  return s;
}

// ---------------------------------------------------------------- controlled execution

export function commitAction(s0: OrchestratorState, caseId: string, role: Role, now: number): OrchestratorState {
  const s = clone(s0);
  const c = s.cases[caseId];
  if (!c) return s0;
  if (c.state !== "MasterApprovalRecorded" || !c.approval) {
    s.metrics.blockedActions += 1;
    audit(s, now, role, "ExecutionBlocked", "violation", `${caseId} — execution attempted without recorded Master approval (state ${c.state}). Halted.`, [], { caseId });
    toast(s, "violation", "Execution blocked — no recorded Master approval");
    return s;
  }
  if (!can(role, "commit")) {
    s.metrics.blockedActions += 1;
    audit(s, now, role, "ExecutionBlocked", "warn", `${caseId} — ${ROLE_LABELS[role]} lacks commit authority (FOC executes under Master approval). Halted.`, [], { caseId });
    toast(s, "warn", "Role lacks commit authority");
    return s;
  }
  const o = c.options.find((x) => x.id === c.approval!.optionId);
  if (!o) return s0;
  const beforeAfter: AuditEntry["beforeAfter"] = [];
  if (o.effects.destination) { beforeAfter.push({ field: "dest", before: c.vesselFields.dest ?? "—", after: o.effects.destination }); c.vesselFields.dest = o.effects.destination; }
  if (o.effects.eta) { beforeAfter.push({ field: "eta", before: c.vesselFields.eta ?? "—", after: shiftIso(c.vesselFields.eta ?? "2026-06-02T08:00Z", o.delayHrs) }); c.vesselFields.eta = shiftIso(c.vesselFields.eta ?? "2026-06-02T08:00Z", o.delayHrs); }
  if (o.effects.speedKn) { beforeAfter.push({ field: "sogPlan", before: c.vesselFields.sogPlan ?? "—", after: `${o.effects.speedKn} kn` }); c.vesselFields.sogPlan = `${o.effects.speedKn} kn`; }
  c.committedOptionId = o.id;
  const vessel = s.vessels.find((v) => v.id === c.vesselId);
  if (vessel) vessel.status = "recovery";
  go(s, c, "RecoveryActionCommitted", "system", now, `Executed under approval of ${c.approval.by} at ${new Date(c.approval.at).toISOString()}`);
  audit(s, now, "system", "ActionCommitted", "ok",
    `${caseId} — ${o.id} committed by deterministic executor under recorded Master approval. Before/after state captured.`,
    o.evidenceRefs, { caseId, vesselId: c.vesselId, beforeAfter });
  toast(s, "ok", `${o.id} committed — controlled execution under approval`);
  return s;
}

export function publishReplan(s0: OrchestratorState, caseId: string, role: Role, now: number): OrchestratorState {
  const s = clone(s0);
  const c = s.cases[caseId];
  if (!c || c.state !== "RecoveryActionCommitted") return s0;
  if (!can(role, "publishReplan")) {
    s.metrics.blockedActions += 1;
    audit(s, now, role, "ReplanRefused", "warn", `${caseId} — ${ROLE_LABELS[role]} lacks replan-publication authority. Refused.`, [], { caseId });
    toast(s, "warn", "Replan publication requires FOC authority");
    return s;
  }
  go(s, c, "VoyageReplanned", role, now, "Revised voyage plan v13 lodged");
  audit(s, now, role, "ReplanPublished", "ok", `${caseId} — revised voyage plan v13 published to vessel + FOC.`, ["voyageplan@v13"], { caseId });
  return s;
}

export function closeCase(s0: OrchestratorState, caseId: string, role: Role, now: number): OrchestratorState {
  const s = clone(s0);
  const c = s.cases[caseId];
  if (!c || c.state !== "VoyageReplanned") return s0;
  if (!can(role, "closeCase")) {
    s.metrics.blockedActions += 1;
    audit(s, now, role, "CloseRefused", "warn", `${caseId} — steady-state confirmation is a Master decision. Refused for ${ROLE_LABELS[role]}.`, [], { caseId });
    toast(s, "warn", "Case closure requires Master authority");
    return s;
  }
  const vessel = s.vessels.find((v) => v.id === c.vesselId);
  if (vessel) vessel.status = "nominal";
  go(s, c, "Nominal", role, now, "Steady state confirmed — case closed");
  audit(s, now, role, "CaseClosed", "ok", `${caseId} closed — full transition chain audited from DisruptionDetected to Nominal.`, [], { caseId });
  toast(s, "ok", `${caseId} closed — voyage nominal`);
  return s;
}

export function clearViolation(s0: OrchestratorState, caseId: string, role: Role, now: number): OrchestratorState {
  const s = clone(s0);
  const c = s.cases[caseId];
  if (!c || c.state !== "Blocked") return s0;
  if (!can(role, "clearViolation")) {
    audit(s, now, role, "RollbackRefused", "warn", `${caseId} — only Safety & Compliance may roll back a Blocked case. Refused for ${ROLE_LABELS[role]}.`, [], { caseId });
    toast(s, "warn", "Rollback requires Safety & Compliance authority");
    return s;
  }
  const before = c.state;
  c.violation = null;
  go(s, c, "RecoveryOptionGenerated", role, now, "Rollback to last safe state after violation review");
  audit(s, now, role, "RollbackExecuted", "warn",
    `${caseId} — graceful rollback ${before} → RecoveryOptionGenerated after violation review. No execution had occurred; nothing to undo beyond state.`,
    [], { caseId, beforeAfter: [{ field: "state", before, after: "RecoveryOptionGenerated" }] });
  toast(s, "ok", "Rollback complete — case returned to last safe state");
  return s;
}

// ---------------------------------------------------------------- FR-05 offline & reconciliation

export function setConnectivity(s0: OrchestratorState, online: boolean, now: number): OrchestratorState {
  const s = clone(s0);
  if (!online && s.connectivity === "online") {
    s.connectivity = "offline";
    s.offlineSince = now;
    s.blackouts.push({ start: now, end: null });
    for (const c of Object.values(s.cases)) {
      if (c.state !== "Nominal") {
        go(s, c, "OfflineFallback", "system", now, "Shore link lost — essential vessel-side workflow continues");
        // vessel edge applies conservative planning buffer locally (divergence source #1)
        if (c.vesselFields.eta) {
          const after = shiftIso(c.vesselFields.eta, 3);
          audit(s, now, "vessel-edge", "VesselSideUpdate", "info", `${c.id} — vessel edge applied conservative ETA buffer +3 h offline (${c.vesselFields.eta} → ${after}).`, [], { caseId: c.id, beforeAfter: [{ field: "eta", before: c.vesselFields.eta, after }] });
          c.vesselFields.eta = after;
        }
      }
    }
    audit(s, now, "system", "ConnectivityLost", "warn", "Satellite link down — OfflineFallback engaged. Deterministic core continues on vessel edge; O3 advisory unavailable. No silent overwrites possible.", ["link@sat"]);
    toast(s, "warn", "Satellite link lost — offline fallback active");
    return s;
  }
  if (online && s.connectivity === "offline") {
    s.connectivity = "online";
    const b = [...s.blackouts].reverse().find((x) => x.end === null);
    if (b) b.end = now;
    s.offlineSince = null;

    // spool sync with dedupe (FR-01 + FR-05)
    let synced = 0;
    for (const ev of s.spool) {
      if (s.seenIdem[ev.idemKey] !== undefined) { s.metrics.dupDropped += 1; continue; }
      s.seqCounter += 1;
      const merged: OpEvent = { ...ev, seq: s.seqCounter };
      s.seenIdem[ev.idemKey] = merged.seq;
      s.eventLog.push(merged);
      synced += 1;
    }
    const kb = Math.round(s.spool.length * BUDGETS.syncKbPerSpoolEvent * 10) / 10;
    s.cost.satKb = Math.round((s.cost.satKb + kb) * 10) / 10;
    if (s.spool.length > 0) {
      audit(s, now, "shore-sync", "SpoolSynced", "ok", `${synced} spooled event(s) reconciled into the durable log (${kb} KB sat). Idempotency keys re-checked — 0 duplicate actions.`, [`spool@${synced}ev`]);
    }
    s.spool = [];
    const delft = s.vessels.find((v) => v.id === "VB-04");
    if (delft && delft.status === "offline") delft.status = "nominal";

    // restore paused state machines, then surface divergence
    for (const c of Object.values(s.cases)) {
      if (c.state === "OfflineFallback") {
        go(s, c, c.prevState === "OfflineFallback" ? "DisruptionDetected" : c.prevState, "system", now, "Link restored — state machine resumed");
      }
      if (c.shoreEdits.some((e) => !e.resolvedTo)) {
        go(s, c, "ReconciliationPending", "system", now, "Vessel/shore divergence detected — manual review required");
        audit(s, now, "shore-sync", "DivergenceDetected", "warn",
          `${c.id} — vessel-side and shore-side state diverged during blackout. NO silent overwrite: manual resolution required (FR-05).`,
          c.shoreEdits.map((e) => `${e.field}@conflict`), { caseId: c.id });
      }
    }
    audit(s, now, "system", "ConnectivityRestored", "ok", "Shore link restored — spool synced, state machines resumed, divergence checks run.", ["link@sat"]);
    toast(s, "ok", "Link restored — spool synced & reconciled");
    return s;
  }
  return s0;
}

export function shoreEdit(s0: OrchestratorState, caseId: string, now: number, role: Role): OrchestratorState {
  const s = clone(s0);
  const c = s.cases[caseId];
  if (!c) return s0;
  if (s.connectivity !== "offline") {
    toast(s, "info", "Shore edit simulation is only meaningful while the vessel link is down");
    return s0;
  }
  if (!can(role, "shoreEdit")) {
    s.metrics.blockedActions += 1;
    audit(s, now, role, "ShoreEditRefused", "warn", `${caseId} — ${ROLE_LABELS[role]} lacks shore-edit authority. Refused.`, [], { caseId });
    toast(s, "warn", "Role lacks shore-edit authority");
    return s0;
  }
  const vesselValue = c.vesselFields.eta ?? "—";
  const shoreValue = shiftIso(vesselValue, -2); // shore planner is 2 h more optimistic than vessel edge
  c.shoreEdits.push({ field: "eta", vesselValue, shoreValue });
  audit(s, now, role, "ShoreSideEdit", "info", `${caseId} — shore planner revised ETA to ${shoreValue} while vessel link down. Divergence will require manual reconciliation.`, [], { caseId, beforeAfter: [{ field: "eta(shore)", before: vesselValue, after: shoreValue }] });
  toast(s, "info", "Shore ETA edit recorded — divergence pending on reconnect");
  return s;
}

export function resolveDivergence(s0: OrchestratorState, caseId: string, field: string, to: "vessel" | "shore", role: Role, now: number): OrchestratorState {
  const s = clone(s0);
  const c = s.cases[caseId];
  if (!c) return s0;
  if (!can(role, "resolveDivergence")) {
    s.metrics.blockedActions += 1;
    audit(s, now, role, "ReconciliationRefused", "warn", `${caseId} — ${ROLE_LABELS[role]} cannot resolve divergences. Refused.`, [], { caseId });
    toast(s, "warn", "Divergence resolution requires Master or FOC authority");
    return s0;
  }
  const d = c.shoreEdits.find((e) => e.field === field && !e.resolvedTo);
  if (!d) return s0;
  d.resolvedTo = to;
  const canonical = to === "vessel" ? d.vesselValue : d.shoreValue;
  const before = c.vesselFields[field] ?? "—";
  c.vesselFields[field] = canonical;
  audit(s, now, role, "StateReconciled", "ok",
    `${caseId}.${field} resolved to ${to.toUpperCase()} value (${canonical}). Human decision recorded — no silent overwrite.`,
    [`${field}@${to}`], { caseId, beforeAfter: [{ field, before, after: canonical }] });
  if (c.shoreEdits.every((e) => e.resolvedTo)) {
    go(s, c, c.prevState === "ReconciliationPending" ? "RecoveryOptionGenerated" : c.prevState, role, now, "All divergences resolved — resuming");
    audit(s, now, role, "ReconciliationComplete", "ok", `${caseId} — reconciliation complete; case resumed at ${c.state}.`, [], { caseId });
    toast(s, "ok", "Reconciliation complete — case resumed");
  }
  return s;
}

// ---------------------------------------------------------------- O3 advisory (optional layer)

export function runAdvisory(s0: OrchestratorState, caseId: string, role: Role, now: number): OrchestratorState {
  const s = clone(s0);
  const c = s.cases[caseId];
  if (!c) return s0;
  if (!can(role, "requestAdvisory")) {
    s.metrics.blockedActions += 1;
    audit(s, now, role, "AdvisoryRefused", "warn", `${caseId} — ${ROLE_LABELS[role]} may not request the advisory layer. Refused.`, [], { caseId });
    toast(s, "warn", "Role may not request the advisory layer");
    return s0;
  }
  if (s.connectivity === "offline") {
    audit(s, now, role, "AdvisoryUnavailable", "warn", `${caseId} — O3 advisory unreachable while offline. Manual fallback in effect; deterministic core unaffected (GS-08).`, [], { caseId });
    toast(s, "warn", "Advisory unavailable offline — manual fallback in effect");
    return s0;
  }
  if (!s.advisoryEnabled) {
    audit(s, now, role, "AdvisoryDisabled", "warn", `${caseId} — advisory layer disabled (cost ceiling or manual kill). Deterministic workflow continues (NFR-05).`, [], { caseId });
    toast(s, "warn", "Advisory disabled — deterministic core continues");
    return s0;
  }
  if (s.cost.aiTokens + BUDGETS.advisoryCallTokens > BUDGETS.aiTokensDay) {
    s.advisoryEnabled = false;
    audit(s, now, "system", "CostLimitBreached", "violation", `AI token budget ${BUDGETS.aiTokensDay.toLocaleString()} exceeded — advisory features disabled for the UTC day (NFR-05). Deterministic core unaffected.`, ["budget@ai"]);
    toast(s, "violation", "AI budget breached — advisory disabled, core unaffected");
    return s0;
  }
  if (!c.context || c.abstain || c.commercialOptBlocked) {
    audit(s, now, "system", "AdvisorySuppressed", "warn", `${caseId} — policy gate: advisory suppressed (${c.abstain ? "case abstaining" : c.commercialOptBlocked ? "stale material source" : "no assembled context"}). AI never runs ahead of evidence.`, [], { caseId });
    toast(s, "warn", "Advisory suppressed by policy gate — evidence incomplete");
    return s0;
  }
  const fresh = c.context.sources.filter((x) => x.status === "fresh");
  c.advisoryNotes.push({
    at: now,
    model: VERSIONS.model, prompt: VERSIONS.prompt,
    summary: "Retrieval-grounded synthesis suggests a staged derating profile (14 kn) with a Colombo inspection window on day 4: holds jacket-water temperature ≤ 90 °C in the synthetic thermal model, preserves reefer margin, and keeps corridor Hs inside the class limit through +48 h.",
    uncertainty: "Single forecast model run (00Z); swell estimate ±0.6 m. Thermal projection is a synthetic stand-in, not a class-approved model. Confidence: MEDIUM — verify against engine-room trend before approval.",
    confidence: "medium",
    citations: fresh.map((x) => `${x.id}@${x.elapsedMin}m`),
    optionId: "OPT-A1",
  });
  s.cost.aiTokens += BUDGETS.advisoryCallTokens;
  s.cost.satKb = Math.round((s.cost.satKb + BUDGETS.advisoryCallSatKb) * 10) / 10;
  audit(s, now, role, "AdvisoryGenerated", "info",
    `${caseId} — O3 advisory note generated (model ${VERSIONS.model}, prompt ${VERSIONS.prompt}). Labeled ADVISORY, cited to ${fresh.length} fresh sources, uncertainty disclosed. Human approval still required; no write authority.`,
    fresh.map((x) => `${x.id}@${x.elapsedMin}m`),
    { caseId, versions: { engine: VERSIONS.engine, policy: VERSIONS.policy, dataset: VERSIONS.dataset, app: VERSIONS.app, model: VERSIONS.model, prompt: VERSIONS.prompt } });
  toast(s, "ok", "Advisory note added — labeled, cited, approval still required");
  return regenerate(s, caseId, now, role);
}

// ---------------------------------------------------------------- prohibitions & privacy gates

export function attemptNavigationWrite(s0: OrchestratorState, role: Role, now: number): OrchestratorState {
  const s = clone(s0);
  s.metrics.navWriteAttempts += 1;
  audit(s, now, role, "NavWriteProhibited", "violation",
    `System write to navigation/command interface attempted by ${ROLE_LABELS[role]} — PROHIBITED for every role, including AI (data contract: Navigation Commands = Prohibited). Interface is physically absent in this build.`,
    ["contract@nav-commands"]);
  toast(s, "violation", "PROHIBITED — no write authority to navigation systems, for any actor");
  return s;
}

const PURPOSE_BY_ROLE: Record<string, string> = {
  master: "Voyage safety decision — bridge authority",
  foc: "Recovery planning — process ownership",
  vp: "Scope oversight — mandate review",
};

export function requestRestricted(s0: OrchestratorState, caseId: string, kind: "cargo" | "crew", role: Role, now: number): OrchestratorState {
  const s = clone(s0);
  if (!can(role, "viewRestricted")) {
    s.restrictedGrants[caseId] = { ...(s.restrictedGrants[caseId] ?? {}), [kind]: "denied" };
    s.metrics.blockedActions += 1;
    audit(s, now, role, "PrivacyGateDenied", "warn", `${caseId} — ${ROLE_LABELS[role]} requested restricted ${kind} detail — DENIED (NFR-03 minimization; no purpose basis).`, [`gate@${kind}`], { caseId });
    toast(s, "warn", `Restricted ${kind} detail denied for this role`);
    return s;
  }
  s.restrictedGrants[caseId] = { ...(s.restrictedGrants[caseId] ?? {}), [kind]: { role, at: now, purpose: PURPOSE_BY_ROLE[role] ?? "Documented operational purpose" } };
  audit(s, now, role, "PrivacyGateGranted", "info", `${caseId} — restricted ${kind} detail exposed under purpose limitation: "${PURPOSE_BY_ROLE[role]}". Access recorded for audit (NFR-03).`, [`gate@${kind}`], { caseId });
  toast(s, "ok", `Restricted ${kind} detail unlocked — access audited`);
  return s;
}

// ---------------------------------------------------------------- housekeeping

export function setAdvisoryEnabled(s0: OrchestratorState, enabled: boolean, now: number): OrchestratorState {
  if (s0.advisoryEnabled === enabled) return s0;
  const s = clone(s0);
  s.advisoryEnabled = enabled;
  audit(s, now, "system", enabled ? "AdvisoryRestored" : "AdvisoryKilled", enabled ? "info" : "warn",
    enabled
      ? "O3 advisory layer restored by operator."
      : "O3 advisory layer manually killed — deterministic O2 core + manual workflow continue unaffected (PRD §11 fallback).",
    ["layer@O3"]);
  toast(s, enabled ? "ok" : "warn", enabled ? "Advisory layer restored" : "Advisory killed — deterministic core continues");
  return s;
}

export function setRole(s0: OrchestratorState, role: Role): OrchestratorState {
  const s = clone(s0);
  s.role = role;
  return s;
}

export function setView(s0: OrchestratorState, view: OrchestratorState["view"]): OrchestratorState {
  const s = clone(s0);
  s.view = view;
  return s;
}

export function dismissToast(s0: OrchestratorState, id: number): OrchestratorState {
  return { ...s0, toasts: s0.toasts.filter((t) => t.id !== id) };
}

export function setActiveCase(s0: OrchestratorState, caseId: string): OrchestratorState {
  return { ...s0, activeCaseId: caseId };
}
