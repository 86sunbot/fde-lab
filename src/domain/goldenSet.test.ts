// Vitest wrapper over the deterministic golden-set suite.
// Run: npx vitest run
import { describe, expect, it } from "vitest";
import { runGoldenSet } from "./goldenSet";
import {
  assembleContext, attemptNavigationWrite, createInitialState,
  generateOptions, ingestEvent, requestApproval,
} from "./engine";

describe("Golden set (PRD §9, 12 scenarios)", () => {
  const summary = runGoldenSet();

  for (const s of summary.scenarios) {
    it(`${s.id} ${s.name}`, () => {
      const failed = s.checks.filter((c) => !c.pass);
      expect(failed, `${s.id} failed: ${failed.map((f) => f.label).join(", ")}`).toHaveLength(0);
      expect(s.pass).toBe(true);
    });
  }

  it("suite passes end-to-end with hard-control metrics intact", () => {
    expect(summary.allPass).toBe(true);
    expect(summary.metrics.dupOperationalActions).toBe(0); // FR-01
    expect(summary.metrics.unauthorizedSuccess).toBe(0); // NFR-02
    expect(summary.metrics.offlineEssentialFailures).toBe(0); // NFR-01
    expect(summary.metrics.provenancePct).toBe(100); // NFR-04
  });
});

describe("Negative tests — forbidden actions", () => {
  it("non-Master approval is blocked and audited", () => {
    const base = Date.UTC(2026, 4, 1, 0, 0, 0);
    let s = createInitialState(base, "bare");
    s = ingestEvent(s, { eventId: "NT-1", vesselId: "VB-01", type: "TELEMETRY_ALERT", tsSource: base, origin: "vessel", summary: "JW temp excursion", dedupeKey: "NT-JW" }, base);
    const caseId = Object.values(s.cases)[0].id;
    s = assembleContext(s, caseId, base + 60_000, "foc");
    s = generateOptions(s, caseId, base + 120_000, "foc");
    s = requestApproval(s, caseId, "OPT-COLOMBO", "analyst", base + 180_000);
    expect(s.cases[caseId].state).toBe("Blocked");
    expect(s.cases[caseId].approval).toBeNull();
    expect(s.audit.some((a) => a.action === "SecurityViolationRaised")).toBe(true);
  });

  it("navigation write is prohibited for every role", () => {
    const base = Date.UTC(2026, 4, 1, 0, 0, 0);
    const s0 = createInitialState(base, "bare");
    for (const role of ["master", "foc", "safety", "vp", "analyst"] as const) {
      const s = attemptNavigationWrite(s0, role, base);
      expect(s.metrics.navWriteSuccess).toBe(0);
    }
  });

  it("event replay is idempotent — zero duplicate operational actions", () => {
    const base = Date.UTC(2026, 4, 1, 0, 0, 0);
    let s = createInitialState(base, "bare");
    const ev = { eventId: "NT-2", vesselId: "VB-03", type: "POSITION_REPORT" as const, tsSource: base, origin: "external" as const, summary: "pos fix", dedupeKey: "NT-POS" };
    s = ingestEvent(s, ev, base);
    s = ingestEvent(s, { ...ev, eventId: "NT-2-R" }, base + 60_000);
    s = ingestEvent(s, { ...ev, eventId: "NT-2-R2" }, base + 120_000);
    expect(s.metrics.dupDropped).toBe(2);
    expect(s.metrics.dupOperationalActions).toBe(0);
    expect(s.eventLog.filter((e) => e.vesselId === "VB-03")).toHaveLength(1);
  });
});
