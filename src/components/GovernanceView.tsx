import { useState } from "react";
import { useOrchestrator } from "../store";
import { Btn, Chip, Icon, Panel, fmtUTC } from "./atoms";
import { PERMISSIONS, ROLE_LABELS, SOURCE_POLICY } from "../domain/policy";
import { runGoldenSet } from "../domain/goldenSet";
import type { ActionKind } from "../domain/policy";
import type { CaseState } from "../domain/types";

const CHAIN: CaseState[] = ["Nominal", "DisruptionDetected", "ImpactAssessed", "RecoveryOptionGenerated", "MasterApprovalRecorded", "RecoveryActionCommitted", "VoyageReplanned"];
const EXCEPTIONS: { state: CaseState; trigger: string; color: string }[] = [
  { state: "OfflineFallback", trigger: "Connectivity lost — edge continues essential work", color: "text-amber border-amber/50 bg-amber/[0.06]" },
  { state: "Abstention", trigger: "Material constraint missing / conflicting — generation withheld", color: "text-amber border-amber/50 bg-amber/[0.06]" },
  { state: "Blocked", trigger: "Unauthorized action attempt — SecurityViolationRaised", color: "text-red border-red/55 bg-red/[0.06]" },
  { state: "ReconciliationPending", trigger: "Vessel/shore divergence — manual review before overwrite", color: "text-red border-red/55 bg-red/[0.06]" },
];

const TRACE_ROWS: { req: string; component: string; tests: string }[] = [
  { req: "FR-01 Deterministic capture & dedupe", component: "engine.ts · ingestEvent / idempotency keys", tests: "GS-01, GS-08, unit: replay idempotency" },
  { req: "FR-02 Context assembly & freshness", component: "fixtures.ts · makeSources, engine.assembleContext", tests: "GS-05, GS-06" },
  { req: "FR-03 Feasibility & option generation", component: "fixtures.ts · evaluateOptions (O2 core)", tests: "GS-02, GS-03, GS-09, GS-10" },
  { req: "FR-04 Authority & approval gate", component: "engine.ts · requestApproval, policy.PERMISSIONS", tests: "GS-07, GS-10, unit: non-Master block" },
  { req: "FR-05 Offline continuity & reconciliation", component: "engine.ts · setConnectivity / resolveDivergence", tests: "GS-08, GS-05R" },
  { req: "NFR-01 Resilience (offline essential)", component: "engine edge-spool path", tests: "GS-08 (100% offline runs)" },
  { req: "NFR-02 Security / RBAC", component: "policy.ts · PERMISSIONS, engine guards", tests: "GS-07, GS-12, unit: nav-write prohibition" },
  { req: "NFR-03 Privacy minimization", component: "engine.requestRestricted privacy gates", tests: "GS-07 family, manual gate demo" },
  { req: "NFR-04 Observability / provenance", component: "engine.audit + VERSIONS pinning", tests: "GS-11 (100% completeness)" },
  { req: "NFR-05 Cost ceilings", component: "policy.BUDGETS, engine.runAdvisory", tests: "Cost panel, advisory auto-disable" },
  { req: "NFR-06 Interoperability", component: "engine drift-normalize, AIS-gap exposure", tests: "GS-04" },
  { req: "NFR-07 Recoverability / rollback", component: "engine.clearViolation, GS-12 rejection path", tests: "GS-07 rollback, GS-12" },
  { req: "AI Req — grounding / abstention / oversight", component: "fixtures advisory option, engine.runAdvisory gates", tests: "GS-05, GS-06, GS-08, GS-09" },
];

const OPEN_DECISIONS: { decision: string; owner: string }[] = [
  { decision: "Exact performance target, observation window, and confidence method", owner: "Sponsor / Process Owner (after baseline reproduction)" },
  { decision: "Named real-source owners and access approvers", owner: "Director, FOC and Data Custodians" },
  { decision: "Production data permissions, retention, encryption, and isolation", owner: "Data Owners + Privacy/Security/Compliance" },
  { decision: "Jurisdiction, legal applicability, and EU AI Act conclusion", owner: "Qualified Legal / Compliance Review" },
  { decision: "Feasible-option validation tolerance", owner: "Process Owner + Safety/Security/Compliance" },
  { decision: "Production role model, authentication/authorization, and audit immutability", owner: "IT / Security / Control functions" },
  { decision: "Real provider/model, hosting/residency, cost budget, and change control", owner: "Sponsor, IT, Data/Security/Control functions" },
  { decision: "Full comparative recovery-value, latency/cost, and integration PoC results", owner: "FDE Team with Process-Owner review" },
];

const ACTIONS: ActionKind[] = ["assembleContext", "generateOptions", "approve", "rejectOption", "commit", "publishReplan", "closeCase", "clearViolation", "requestAdvisory", "resolveDivergence", "viewRestricted", "shoreEdit", "viewAudit"];

export default function GovernanceView() {
  const { state, dispatch } = useOrchestrator();
  const [summary] = useState(() => runGoldenSet());
  const lastNav = [...state.audit].reverse().find((a) => a.action === "NavWriteProhibited");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 scroll-slim">
      {/* state machine */}
      <Panel title="State machine · PRD §8" bodyClass="p-3">
        <div className="flex flex-wrap items-center gap-y-2">
          {CHAIN.slice(1).map((st, i) => (
            <span key={st} className="flex items-center">
              <span className="border border-line bg-ink-950/60 px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-mid">{st.replace(/([A-Z])/g, " $1").trim()}</span>
              {i < CHAIN.length - 2 && <span className="px-1 font-mono text-[11px] text-teal/70">→</span>}
            </span>
          ))}
          <span className="px-1 font-mono text-[11px] text-teal/70">→</span>
          <span className="border border-teal/50 bg-teal/10 px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-teal">Nominal</span>
        </div>
        <div className="mt-2.5 grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-4">
          {EXCEPTIONS.map((e) => (
            <div key={e.state} className={`border p-2 ${e.color}`}>
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">{e.state}</div>
              <div className="mt-0.5 font-mono text-[9px] leading-snug opacity-80">{e.trigger}</div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        {/* role matrix */}
        <Panel title="Decision rights · PRD §7" bodyClass="overflow-x-auto scroll-slim">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line font-mono text-[8.5px] uppercase tracking-[0.12em] text-low">
                <th className="sticky left-0 bg-ink-900 px-2 py-1.5 text-left">Action</th>
                {(Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>).map((r) => (
                  <th key={r} className="px-1.5 py-1.5 text-center">{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ACTIONS.map((a) => (
                <tr key={a} className="border-b border-b-line-soft hover:bg-ink-850/60">
                  <td className="sticky left-0 bg-ink-900 px-2 py-1 font-mono text-[9.5px] text-mid">{a}</td>
                  {(Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>).map((r) => {
                    const allowed = PERMISSIONS[r].includes(a);
                    return (
                      <td key={r} className={`px-1.5 py-1 text-center ${allowed ? "text-teal" : "text-line"}`}>
                        <Icon name={allowed ? "check" : "x"} size={11} className="inline" />
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-b border-b-line-soft">
                <td className="sticky left-0 bg-ink-900 px-2 py-1 font-mono text-[9.5px] text-red">writeNavigationCommand</td>
                {(Object.keys(ROLE_LABELS) as Array<keyof typeof ROLE_LABELS>).map((r) => (
                  <td key={r} className="px-1.5 py-1 text-center text-red"><Icon name="x" size={11} className="inline" /></td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="p-2 font-mono text-[8.5px] text-low">Master approval is non-delegable. Navigation-command writes are prohibited for every actor, including AI — the interface does not exist in this build.</p>
        </Panel>

        {/* prohibited demo + contracts */}
        <div className="flex flex-col gap-2">
          <Panel title="Prohibited-action probe · data contract" bodyClass="p-3">
            <p className="font-mono text-[10px] leading-relaxed text-mid">
              Fire a navigation-write attempt from the active role ({ROLE_LABELS[state.role]}). The contract says <span className="text-red">PROHIBITED</span> for all actors — expect a violation-severity audit entry and zero effect.
            </p>
            <div className="mt-2">
              <Btn tone="red" onClick={() => dispatch({ type: "NAV_WRITE" })}>
                <Icon name="alert" size={12} /> Push heading change to ECDIS
              </Btn>
            </div>
            {lastNav && (
              <div className="mt-2 animate-rise border border-red/50 bg-red/[0.06] p-2">
                <div className="flex items-center justify-between font-mono text-[9.5px] text-red">
                  <span>{lastNav.action} · {lastNav.actor}</span><span>{fmtUTC(lastNav.at)}</span>
                </div>
                <p className="mt-1 font-mono text-[9px] leading-relaxed text-mid">{lastNav.detail}</p>
                <p className="mt-1 font-mono text-[8.5px] text-low">attempts {state.metrics.navWriteAttempts} · successes {state.metrics.navWriteSuccess} · engine {lastNav.versions.engine}</p>
              </div>
            )}
          </Panel>

          <Panel title="Data contracts · PRD §6" bodyClass="p-2">
            {Object.entries(SOURCE_POLICY).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 border-b border-b-line-soft py-1 last:border-0">
                <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-wider text-steel">{k}</span>
                <Chip tone={v.license === "permitted" ? "teal" : v.license === "conditional" ? "cyan" : "amber"}>{v.license}</Chip>
                <span className="truncate font-mono text-[9px] text-low">{v.purpose}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 border-b border-b-line-soft py-1">
              <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-wider text-red">nav-cmds</span>
              <Chip tone="red">prohibited</Chip>
              <span className="truncate font-mono text-[9px] text-low">AI write authority — never. Interface absent.</span>
            </div>
            <div className="flex items-center gap-2 py-1">
              <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-wider text-amber">syn-csv</span>
              <Chip tone="amber">workshop</Chip>
              <span className="truncate font-mono text-[9px] text-low">140-row synthetic set — profiling only, not production evidence.</span>
            </div>
          </Panel>
        </div>
      </div>

      {/* traceability */}
      <Panel
        title="Requirement → component → test → result"
        right={<Chip tone={summary.allPass ? "teal" : "red"}>{summary.allPass ? "ALL PASS · live harness" : "FAILURES PRESENT"}</Chip>}
        bodyClass="overflow-x-auto scroll-slim"
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-line font-mono text-[8.5px] uppercase tracking-[0.12em] text-low">
              <th className="px-2 py-1.5 text-left">PRD requirement</th>
              <th className="px-2 py-1.5 text-left">Component</th>
              <th className="px-2 py-1.5 text-left">Tests</th>
              <th className="px-2 py-1.5 text-left">Result</th>
            </tr>
          </thead>
          <tbody>
            {TRACE_ROWS.map((r) => (
              <tr key={r.req} className="border-b border-b-line-soft hover:bg-ink-850/60">
                <td className="px-2 py-1.5 font-mono text-[9.5px] text-hi">{r.req}</td>
                <td className="px-2 py-1.5 font-mono text-[9.5px] text-mid">{r.component}</td>
                <td className="px-2 py-1.5 font-mono text-[9.5px] text-mid">{r.tests}</td>
                <td className="px-2 py-1.5"><Chip tone={summary.allPass ? "teal" : "red"}>{summary.allPass ? "PASS" : "CHECK SUITE"}</Chip></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* open decisions */}
      <Panel title="Open decisions · blocking production (not guessed)" bodyClass="p-2">
        <div className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
          {OPEN_DECISIONS.map((d, i) => (
            <div key={i} className="border border-amber/35 bg-amber/[0.04] p-2">
              <div className="flex items-center gap-1.5">
                <Icon name="alert" size={11} className="shrink-0 text-amber" />
                <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-amber">OD-{String(i + 1).padStart(2, "0")} · open</span>
              </div>
              <p className="mt-1 font-mono text-[10px] leading-snug text-hi">{d.decision}</p>
              <p className="mt-1 font-mono text-[9px] text-low">Owner: {d.owner}</p>
            </div>
          ))}
        </div>
      </Panel>

      {/* docs */}
      <Panel title="Workshop artefacts" bodyClass="p-2">
        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-4">
          {[
            { f: "README.md", d: "Local run, architecture (O2 core + O3 optional), AI Studio Build-mode handoff." },
            { f: "REQUIREMENTS_TRACEABILITY.md", d: "FR/NFR/AI-req → component → test map with recorded results." },
            { f: "TEST_PLAN.md", d: "Nominal, edge, stale, unavailable, unauthorized, misuse, fallback, rollback, golden-set coverage." },
            { f: "OPEN_DECISIONS.md", d: "Unresolved upstream decisions — owners and required evidence, nothing guessed." },
          ].map((x) => (
            <div key={x.f} className="border border-line bg-ink-950/50 p-2">
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-teal"><Icon name="book" size={11} /> {x.f}</div>
              <p className="mt-1 font-mono text-[9px] leading-snug text-low">{x.d}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
