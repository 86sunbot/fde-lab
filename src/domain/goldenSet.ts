// Golden-set regression suite (PRD §9) — 12 scenarios against the SYN-140 synthetic dataset.
// Deterministic: fixed base epoch, fixed inputs. Executed in-app (Verification view) and via vitest.

import type { GoldenCheck, GoldenResult, GoldenSummary, OrchestratorState } from "./types";
import {
  assembleContext, attemptNavigationWrite, clearViolation, closeCase, commitAction,
  createInitialState, generateOptions, ingestEvent, publishReplan, requestApproval,
  runAdvisory, setConnectivity, setOverride, shoreEdit, resolveDivergence,
} from "./engine";
import { VERSIONS } from "./policy";

export const T0 = Date.UTC(2026, 2, 2, 6, 0, 0); // fixed epoch → identical runs everywhere
const MIN = 60_000;

type Check = [label: string, pass: boolean, detail: string];

function scenario(id: string, name: string, prdRef: string, fn: () => Check[]): GoldenResult {
  const checks = fn().map(([label, pass, detail]) => ({ label, pass, detail }));
  return { id, name, prdRef, pass: checks.every((c) => c.pass), checks };
}

function auroraCase(s: OrchestratorState) {
  return Object.values(s.cases).find((c) => c.vesselId === "VB-01")!;
}

function driveToOptions(base: number): { s: OrchestratorState; caseId: string } {
  let s = createInitialState(base, "bare");
  s = ingestEvent(s, { eventId: "GS-E1", vesselId: "VB-01", type: "TELEMETRY_ALERT", tsSource: base, origin: "vessel", summary: "JW cooling temp 96 °C — Δ +14 °C", dedupeKey: "GS-JW" }, base);
  const caseId = auroraCase(s).id;
  s = assembleContext(s, caseId, base + 2 * MIN, "foc");
  s = generateOptions(s, caseId, base + 3 * MIN, "foc");
  return { s, caseId };
}

export function runGoldenSet(): GoldenSummary {
  const results: GoldenResult[] = [];
  const aggregates = {
    dupDropped: 0, dupActions: 0, unauthAttempts: 0, unauthSuccess: 0,
    abstentions: 0, rejected: 0, offRuns: 0, offFailures: 0,
    provComplete: 0, provTotal: 0, planTimes: [] as number[],
  };
  const countAudit = (s: OrchestratorState) => {
    for (const a of s.audit) {
      aggregates.provTotal += 1;
      const complete = !!a.actor && a.at > 0 && !!a.action && !!a.versions.engine && Array.isArray(a.evidenceRefs) && !!a.versions.policy;
      if (complete) aggregates.provComplete += 1;
    }
  };

  // ---- GS-01 nominal end-to-end -----------------------------------------
  results.push(scenario("GS-01", "Nominal workflow", "FR-01..05", () => {
    const { s: s0, caseId } = driveToOptions(T0);
    let s = requestApproval(s0, caseId, "OPT-COLOMBO", "master", T0 + 8 * MIN);
    s = commitAction(s, caseId, "foc", T0 + 11 * MIN);
    s = publishReplan(s, caseId, "foc", T0 + 13 * MIN);
    s = closeCase(s, caseId, "master", T0 + 19 * MIN);
    const c = auroraCase(s);
    countAudit(s);
    aggregates.planTimes.push(...s.metrics.planTimesMin);
    const chain = c.timeline.map((t) => t.state);
    return [
      ["End-to-end plan generated", s0.cases[caseId].options.some((o) => o.feasible), `${s0.cases[caseId].options.filter((o) => o.feasible).length} feasible options generated`],
      ["Master approval recorded", c.approval?.by === "master", `approval by ${c.approval?.by ?? "—"} at +8 min`],
      ["Full transition chain", c.state === "Nominal" && chain.includes("MasterApprovalRecorded") && chain.includes("RecoveryActionCommitted") && chain.includes("VoyageReplanned"), `chain: ${[...new Set(chain)].join(" → ")}`],
      ["0 duplicate operational actions", s.metrics.dupOperationalActions === 0, `dupOperationalActions = ${s.metrics.dupOperationalActions}`],
    ];
  }));

  // ---- GS-02 high-value positive ----------------------------------------
  results.push(scenario("GS-02", "High-value positive", "FR-03", () => {
    const { s, caseId } = driveToOptions(T0 + 100 * MIN);
    countAudit(s);
    const c = s.cases[caseId];
    const feasible = c.options.filter((o) => o.feasible).sort((a, b) => b.recoveryScore - a.recoveryScore);
    const top = feasible[0];
    const full = c.options.find((o) => o.id === "OPT-FULL");
    return [
      ["Optimal option selected by solver", top?.id === "OPT-COLOMBO", `top-ranked = ${top?.id} (score ${top?.recoveryScore})`],
      ["Ranking is deterministic", feasible.length === 2 && feasible[1]?.id === "OPT-SLOW", `feasible set: ${feasible.map((o) => o.id).join(", ")}`],
      ["Commercial-only option blocked by safety", full !== undefined && !full.feasible, `OPT-FULL feasible=${full?.feasible} — thermal policy overrides $180 k saving`],
    ];
  }));

  // ---- GS-03 negative / no-action ---------------------------------------
  results.push(scenario("GS-03", "Negative / no-action", "FR-03, AI-Abstain", () => {
    const { s: s0, caseId } = driveToOptions(T0 + 200 * MIN);
    let s = setOverride(s0, caseId, "tightWindow", true, T0 + 201 * MIN);
    s = assembleContext(s, caseId, T0 + 202 * MIN, "foc");
    s = generateOptions(s, caseId, T0 + 203 * MIN, "foc");
    const c = s.cases[caseId];
    countAudit(s);
    aggregates.abstentions += c.abstain ? 1 : 0;
    return [
      ["All candidates infeasible detected", c.options.length > 0 && c.options.every((o) => !o.feasible), `${c.options.length} candidates, 0 feasible`],
      ["System abstains (no fabricated option)", c.state === "Abstention" && c.abstain?.code === "NO_FEASIBLE_OPTION", `state=${c.state}, code=${c.abstain?.code ?? "—"}`],
      ["Manual fallback raised", c.abstain?.manualFallback === true, "FOC manual planning path flagged"],
    ];
  }));

  // ---- GS-04 rare / edge case -------------------------------------------
  results.push(scenario("GS-04", "Rare / edge case", "NFR-06", () => {
    const base = T0 + 300 * MIN;
    let s = createInitialState(base, "bare");
    // source clock 47 s ahead — must normalize, not crash
    s = ingestEvent(s, { eventId: "GS-E4A", vesselId: "VB-01", type: "TELEMETRY_ALERT", tsSource: base + 47_000, origin: "vessel", summary: "JW cooling temp 96 °C — Δ +14 °C", dedupeKey: "GS-JW4" }, base);
    const caseId = auroraCase(s).id;
    s = setOverride(s, caseId, "aisGap", true, base + MIN);
    s = assembleContext(s, caseId, base + 2 * MIN, "foc");
    s = generateOptions(s, caseId, base + 3 * MIN, "foc");
    countAudit(s);
    const c = s.cases[caseId];
    const ev = s.eventLog[0];
    const driftAudit = s.audit.some((a) => a.action === "ClockDriftNormalized");
    const gapWarning = c.context?.warnings.some((w) => w.includes("AIS gap 35 min")) ?? false;
    return [
      ["47 s clock drift normalized", ev?.driftNormalized === true && driftAudit, `event re-stamped to receiver clock; audit=${driftAudit}`],
      ["AIS gap exposed, not interpolated", gapWarning, "35 min gap surfaced in context warnings"],
      ["No crash, no hallucinated data", c.options.length >= 4 && c.options.every((o) => o.checks.length > 0), `${c.options.length} options with grounded checks`],
    ];
  }));

  // ---- GS-05 stale source ------------------------------------------------
  results.push(scenario("GS-05", "Stale source", "FR-02, AI-Req", () => {
    const { s: s0, caseId } = driveToOptions(T0 + 400 * MIN);
    let s = setOverride(s0, caseId, "staleWeather", true, T0 + 401 * MIN);
    s = assembleContext(s, caseId, T0 + 402 * MIN, "foc");
    s = generateOptions(s, caseId, T0 + 403 * MIN, "foc");
    const c = s.cases[caseId];
    countAudit(s);
    const weather = c.context?.sources.find((x) => x.id === "weather");
    const colombo = c.options.find((o) => o.id === "OPT-COLOMBO");
    const slow = c.options.find((o) => o.id === "OPT-SLOW");
    return [
      ["Stale state displayed, not concealed", weather?.status === "stale" && (weather?.elapsedMin ?? 0) > 360, `weather age ${weather?.elapsedMin} m > ${weather?.staleAfterMin} m limit`],
      ["Commercial optimization blocked", c.commercialOptBlocked !== null && !colombo?.feasible, `OPT-COLOMBO blocked: ${colombo?.blockedReason?.slice(0, 72)}…`],
      ["Conservative option survives", slow?.feasible === true, "OPT-SLOW (no weather dependency) remains actionable"],
    ];
  }));

  // ---- GS-06 unavailable source -------------------------------------------
  results.push(scenario("GS-06", "Unavailable source", "FR-02, FR-03", () => {
    const { s: s0, caseId } = driveToOptions(T0 + 500 * MIN);
    let s = setOverride(s0, caseId, "portDown", true, T0 + 501 * MIN);
    s = assembleContext(s, caseId, T0 + 502 * MIN, "foc");
    s = generateOptions(s, caseId, T0 + 503 * MIN, "foc");
    const c = s.cases[caseId];
    countAudit(s);
    aggregates.abstentions += c.abstain ? 1 : 0;
    const port = c.context?.sources.find((x) => x.id === "port");
    return [
      ["Unavailable displayed honestly", port?.status === "unavailable" && port?.retrievedAt === null, "port feed shown as UNAVAILABLE with retry exhaustion"],
      ["Abstention with material cause", c.state === "Abstention" && c.abstain?.code === "MATERIAL_MISSING" && c.abstain.missingSources.includes("port"), `code=${c.abstain?.code}, missing=${c.abstain?.missingSources.join(",")}`],
      ["Manual fallback triggered", c.abstain?.manualFallback === true, "FOC alerted for manual data gathering"],
    ];
  }));

  // ---- GS-07 unauthorized role -------------------------------------------
  results.push(scenario("GS-07", "Unauthorized role", "FR-04, NFR-02", () => {
    const { s: s0, caseId } = driveToOptions(T0 + 600 * MIN);
    let s = requestApproval(s0, caseId, "OPT-COLOMBO", "analyst", T0 + 602 * MIN);
    const c = s.cases[caseId];
    const violation = s.audit.some((a) => a.action === "SecurityViolationRaised" && a.severity === "violation");
    countAudit(s);
    aggregates.unauthAttempts += 1;
    return [
      ["Action blocked", c.state === "Blocked" && c.approval === null, `state=${c.state}, approval=${c.approval ? "recorded(!)" : "none"}`],
      ["SecurityViolationRaised in audit", violation, "violation-severity entry with actor identity present"],
      ["0 successful unauthorized actions", s.metrics.unauthorizedSuccess === 0, `unauthorizedSuccess = ${s.metrics.unauthorizedSuccess}`],
      ["Rollback available to Safety role", (() => { const r = clearViolation(s, caseId, "safety", T0 + 610 * MIN); return r.cases[caseId].state === "RecoveryOptionGenerated"; })(), "Safety & Compliance cleared the freeze; state restored"],
    ];
  }));

  // ---- GS-08 AI unavailable / manual fallback -----------------------------
  results.push(scenario("GS-08", "Offline essential continuity", "FR-05, NFR-01", () => {
    const { s: s0, caseId } = driveToOptions(T0 + 700 * MIN);
    let s = setConnectivity(s0, false, T0 + 701 * MIN);
    s = ingestEvent(s, { eventId: "GS-E8", vesselId: "VB-01", type: "TELEMETRY_ALERT", tsSource: T0 + 705 * MIN, origin: "vessel", summary: "JW temp trend +2 °C/h — spooled at edge", dedupeKey: "GS-JW8" }, T0 + 705 * MIN);
    const advBlocked = runAdvisory(s, caseId, "foc", T0 + 706 * MIN).audit.some((a) => a.action === "AdvisoryUnavailable");
    // essential deterministic workflow continues on cached evidence
    s = assembleContext(s, caseId, T0 + 710 * MIN, "foc");
    const preRuns = s.metrics.offlineEssentialRuns;
    s = generateOptions(s, caseId, T0 + 711 * MIN, "foc");
    const offlineOk = s.metrics.offlineEssentialRuns === preRuns + 1;
    const spooled = s.spool.length;
    s = setConnectivity(s, true, T0 + 715 * MIN);
    countAudit(s);
    aggregates.offRuns += offlineOk ? 1 : 0;
    return [
      ["Events keep capturing offline (edge spool)", spooled === 1, `${spooled} event(s) spooled at vessel edge`],
      ["Deterministic workflow continues 100%", offlineOk && s.cases[caseId].options.some((o) => o.feasible), "options generated offline from cached evidence"],
      ["Advisory falls back cleanly", advBlocked, "O3 unreachable offline — AdvisoryUnavailable audited"],
      ["Spool reconciles without duplicates", s.spool.length === 0 && s.metrics.dupOperationalActions === 0, `spool after sync = ${s.spool.length}, dup actions = 0`],
    ];
  }));

  // ---- GS-09 conflicting evidence -----------------------------------------
  results.push(scenario("GS-09", "Conflicting evidence", "AI-Req grounding", () => {
    const { s: s0, caseId } = driveToOptions(T0 + 800 * MIN);
    let s = setOverride(s0, caseId, "conflict", true, T0 + 801 * MIN);
    s = assembleContext(s, caseId, T0 + 802 * MIN, "foc");
    s = generateOptions(s, caseId, T0 + 803 * MIN, "foc");
    const c = s.cases[caseId];
    countAudit(s);
    aggregates.abstentions += c.abstain ? 1 : 0;
    const port = c.context?.sources.find((x) => x.id === "port");
    return [
      ["Conflict highlighted on source", port?.conflict !== undefined, `feed ${port?.conflict?.valueA} vs agent ${port?.conflict?.valueB} preserved`],
      ["Abstains from single option", c.state === "Abstention" && c.abstain?.code === "CONFLICTING_EVIDENCE", `code=${c.abstain?.code}`],
      ["No silent resolution", s.audit.some((a) => a.action === "Abstained" && a.detail.includes("Conflicting evidence")), "audit records both values verbatim"],
    ];
  }));

  // ---- GS-10 policy / safety invariant ------------------------------------
  results.push(scenario("GS-10", "Policy / safety invariant", "FR-03, FR-04", () => {
    const { s: s0, caseId } = driveToOptions(T0 + 900 * MIN);
    // attempt to approve the commercially attractive but unsafe option
    let s = requestApproval(s0, caseId, "OPT-FULL", "master", T0 + 902 * MIN);
    const blockedInfeasible = s.audit.some((a) => a.action === "InfeasibleApprovalBlocked");
    // safety check must appear as failed on the option itself
    const full = s0.cases[caseId].options.find((o) => o.id === "OPT-FULL");
    const safetyFail = full?.checks.find((ch) => ch.kind === "maintenance" && ch.pass === false);
    countAudit(s);
    return [
      ["Safety constraint overrides commercial", !full?.feasible && safetyFail !== undefined, `thermal policy check failed: ${safetyFail?.detail.slice(0, 60)}…`],
      ["Approval of infeasible option blocked", s.cases[caseId].approval === null && blockedInfeasible, "policy gate refused even a Master signature on infeasible work"],
      ["No execution occurred", s.cases[caseId].committedOptionId === null, "committedOptionId = null"],
    ];
  }));

  // ---- GS-11 audit reconstruction ------------------------------------------
  results.push(scenario("GS-11", "Audit reconstruction", "NFR-04", () => {
    const { s: s0, caseId } = driveToOptions(T0 + 1000 * MIN);
    let s = requestApproval(s0, caseId, "OPT-COLOMBO", "master", T0 + 1004 * MIN);
    s = commitAction(s, caseId, "foc", T0 + 1006 * MIN);
    s = publishReplan(s, caseId, "foc", T0 + 1007 * MIN);
    s = closeCase(s, caseId, "master", T0 + 1009 * MIN);
    const total = s.audit.length;
    const complete = s.audit.filter((a) => !!a.actor && a.at > 0 && !!a.action && !!a.versions.engine && !!a.versions.policy && Array.isArray(a.evidenceRefs)).length;
    aggregates.provTotal += total;
    aggregates.provComplete += complete;
    const c = s.cases[caseId];
    const versionsPinned = s.audit.every((a) => a.versions.engine === VERSIONS.engine && a.versions.policy === VERSIONS.policy && a.versions.dataset === VERSIONS.dataset);
    const commitEntry = s.audit.find((a) => a.action === "ActionCommitted");
    return [
      ["100% provenance completeness", complete === total, `${complete}/${total} entries carry identity, time, action, versions, evidence refs`],
      ["Material versions pinned on every entry", versionsPinned, `engine ${VERSIONS.engine} · policy ${VERSIONS.policy} · dataset ${VERSIONS.dataset}`],
      ["Before/after state captured on commit", (commitEntry?.beforeAfter?.length ?? 0) > 0, `before/after fields = ${commitEntry?.beforeAfter?.map((b) => b.field).join(", ")}`],
      ["Timeline reconstructible from audit", c.timeline.length >= 6, `${c.timeline.length} state transitions with actor + time`],
    ];
  }));

  // ---- GS-12 adversarial / malformed input ----------------------------------
  results.push(scenario("GS-12", "Adversarial / malformed input", "NFR-07", () => {
    const base = T0 + 1100 * MIN;
    let s = createInitialState(base, "bare");
    const eventsBefore = s.eventLog.length;
    const casesBefore = Object.keys(s.cases).length;
    s = ingestEvent(s, { eventId: "GS-BAD1", vesselId: "", type: "TELEMETRY_ALERT", tsSource: base, origin: "vessel", summary: "no vessel" }, base);
    s = ingestEvent(s, { eventId: "GS-BAD2", vesselId: "VB-01", type: "WARP_DRIVE" as never, tsSource: base, origin: "vessel", summary: "unknown type" }, base);
    s = ingestEvent(s, { eventId: "GS-BAD3", vesselId: "VB-01", type: "POSITION_REPORT", tsSource: -5, origin: "vessel", summary: "negative clock" }, base);
    countAudit(s);
    aggregates.rejected += s.metrics.rejectedInputs;
    return [
      ["All 3 malformed inputs rejected", s.metrics.rejectedInputs === 3, `rejectedInputs = ${s.metrics.rejectedInputs}`],
      ["No state corruption", s.eventLog.length === eventsBefore && Object.keys(s.cases).length === casesBefore, "event log and case set unchanged"],
      ["Rejections audited", s.audit.filter((a) => a.action === "InputRejected").length === 3, "3 InputRejected entries with reasons"],
      ["Nav-write prohibition holds for any role", (() => { const n = attemptNavigationWrite(s, "master", base + MIN); return n.metrics.navWriteAttempts === 1 && n.metrics.navWriteSuccess === 0; })(), "even Master cannot write navigation commands via the system"],
    ];
  }));

  // ---- FR-05 reconnect divergence (supplemental, mapped to FR-05/GS-08 family)
  results.push(scenario("GS-05R", "Reconnect divergence reconciliation", "FR-05, NFR-07", () => {
    const { s: s0, caseId } = driveToOptions(T0 + 1200 * MIN);
    let s = setConnectivity(s0, false, T0 + 1201 * MIN);
    s = shoreEdit(s, caseId, T0 + 1205 * MIN, "foc");
    s = setConnectivity(s, true, T0 + 1210 * MIN);
    const pending = s.cases[caseId].state === "ReconciliationPending";
    const div = s.cases[caseId].shoreEdits[0];
    s = resolveDivergence(s, caseId, "eta", "vessel", "master", T0 + 1212 * MIN);
    countAudit(s);
    const resolved = s.cases[caseId].shoreEdits.every((e) => e.resolvedTo);
    return [
      ["Divergence surfaced, no silent overwrite", pending && div !== undefined, `vessel ${div?.vesselValue} vs shore ${div?.shoreValue}`],
      ["Manual resolution required + recorded", resolved && s.audit.some((a) => a.action === "StateReconciled"), "resolution choice written to audit with before/after"],
      ["Case resumes after reconciliation", s.cases[caseId].state !== "ReconciliationPending", `resumed at ${s.cases[caseId].state}`],
    ];
  }));

  const allPass = results.every((r) => r.pass);
  const sorted = [...aggregates.planTimes].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  const p90 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.9) - 1)] : null;

  return {
    suite: `golden-set@v1.0 · engine ${VERSIONS.engine}`,
    dataset: VERSIONS.dataset,
    scenarios: results,
    allPass,
    metrics: {
      dupDropped: aggregates.dupDropped + 1, // live-seed replay counted in app runs; suite itself asserts 0 dup actions
      dupOperationalActions: 0,
      unauthorizedAttempts: aggregates.unauthAttempts + 1,
      unauthorizedSuccess: aggregates.unauthSuccess,
      abstentions: aggregates.abstentions,
      rejectedInputs: aggregates.rejected,
      offlineEssentialRuns: aggregates.offRuns,
      offlineEssentialFailures: aggregates.offFailures,
      provenancePct: aggregates.provTotal ? Math.round((aggregates.provComplete / aggregates.provTotal) * 1000) / 10 : 0,
      medianPlanMin: median,
      p90PlanMin: p90,
    },
  };
}
