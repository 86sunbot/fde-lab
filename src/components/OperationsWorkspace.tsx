import { useRef } from "react";
import { useOrchestrator } from "../store";
import { Btn, Chip, Icon, Panel, StateChip, fmtUTC, useNow } from "./atoms";
import { ContextPanel, EventFeed, OptionsBoard } from "./EvidencePanels";
import { ROLE_LABELS } from "../domain/policy";
import type { CaseOverrides, CaseState } from "../domain/types";

const CHAIN: CaseState[] = [
  "DisruptionDetected", "ImpactAssessed", "RecoveryOptionGenerated",
  "MasterApprovalRecorded", "RecoveryActionCommitted", "VoyageReplanned", "Nominal",
];
const CHAIN_LABEL: Record<string, string> = {
  DisruptionDetected: "Disruption", ImpactAssessed: "Impact", RecoveryOptionGenerated: "Options",
  MasterApprovalRecorded: "Approval", RecoveryActionCommitted: "Committed", VoyageReplanned: "Replanned", Nominal: "Nominal",
};
const EXCEPTIONS: CaseState[] = ["OfflineFallback", "Abstention", "Blocked", "ReconciliationPending"];

const CONDITION_LABEL: Record<keyof CaseOverrides, string> = {
  staleWeather: "Stale weather (GS-05)",
  portDown: "Port feed down (GS-06)",
  conflict: "Draft conflict (GS-09)",
  tightWindow: "Zero slack (GS-03)",
  aisGap: "AIS gap 35 m (GS-04)",
};

export default function OperationsWorkspace() {
  const { state, dispatch } = useOrchestrator();
  const now = useNow(15000);
  const demoRunning = useRef(false);

  const cases = Object.values(state.cases);
  const c = state.activeCaseId ? state.cases[state.activeCaseId] : undefined;
  const vessel = c ? state.vessels.find((v) => v.id === c.vesselId) : undefined;

  const runDemo = () => {
    if (!c || demoRunning.current) return;
    demoRunning.current = true;
    const steps: Array<() => void> = [
      () => dispatch({ type: "ROLE", role: "master" }),
      () => dispatch({ type: "APPROVE", caseId: c.id, optionId: c.selectedOptionId ?? "OPT-COLOMBO" }),
      () => dispatch({ type: "ROLE", role: "foc" }),
      () => dispatch({ type: "COMMIT", caseId: c.id }),
      () => dispatch({ type: "PUBLISH", caseId: c.id }),
      () => dispatch({ type: "ROLE", role: "master" }),
      () => dispatch({ type: "CLOSE", caseId: c.id }),
      () => dispatch({ type: "ROLE", role: "foc" }),
      () => { demoRunning.current = false; },
    ];
    steps.forEach((fn, i) => window.setTimeout(fn, i * 900));
  };

  if (!c) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Icon name="radar" size={34} className="text-low" />
          <div className="font-display text-[20px] font-semibold uppercase tracking-[0.2em] text-mid">No active recovery case</div>
          <p className="max-w-[340px] font-mono text-[10.5px] leading-relaxed text-low">
            Inject a telemetry alert from the scenario console, or replay a disruption on a nominal vessel to open a case.
          </p>
        </div>
      </div>
    );
  }

  const ov: CaseOverrides = state.overrides[c.id] ?? {};
  const reached = new Set(c.timeline.map((t) => t.state));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 scroll-slim">
      {/* scenario console */}
      <Panel
        title="Scenario console · workshop injector"
        right={<Btn tone="teal" onClick={runDemo} disabled={demoRunning.current || c.state !== "RecoveryOptionGenerated"}
          title="Walks Master approval → commit → replan → close">
          <Icon name="zap" size={12} /> {demoRunning.current ? "Running…" : "Run full recovery demo"}
        </Btn>}
        bodyClass="flex flex-wrap items-center gap-1.5 p-2"
      >
        <Btn tone="cyan" onClick={() => dispatch({
          type: "INGEST",
          event: {
            eventId: `EV-LIVE-${Date.now() % 100000}`, vesselId: c.vesselId, type: "TELEMETRY_ALERT",
            tsSource: Date.now(), origin: "vessel", summary: "JW temperature trend update — live injection",
            dedupeKey: `LIVE-${Date.now()}`,
          },
        })}>
          <Icon name="wave" size={12} /> Inject telemetry
        </Btn>
        <span className="mx-1 h-5 w-px bg-line" />
        {(Object.keys(CONDITION_LABEL) as Array<keyof CaseOverrides>).map((k) => (
          <Btn key={k} tone={ov[k] ? "amber" : "dim"} onClick={() => dispatch({ type: "OVERRIDE", caseId: c.id, key: k, value: !ov[k] })}
            title="Workshop condition — re-assemble context after change">
            {CONDITION_LABEL[k]}{ov[k] ? " ·ON" : ""}
          </Btn>
        ))}
        <span className="mx-1 h-5 w-px bg-line" />
        <Btn tone={state.connectivity === "online" ? "dim" : "amber"} onClick={() => dispatch({ type: "CONNECTIVITY", online: false })}>
          <Icon name="linkoff" size={12} /> Drop link
        </Btn>
        <Btn tone={state.connectivity === "online" ? "teal" : "dim"} onClick={() => dispatch({ type: "CONNECTIVITY", online: true })}>
          <Icon name="link" size={12} /> Restore link
        </Btn>
        <Btn tone="dim" onClick={() => dispatch({ type: "SHORE_EDIT", caseId: c.id })} title="Simulates a shore-side ETA edit while the vessel link is down (FR-05 divergence)">
          <Icon name="split" size={12} /> Shore ETA edit
        </Btn>
        <Btn tone="dim" onClick={() => dispatch({ type: "RESET" })} title="Rebuild the workshop dataset from scratch">
          Reset workshop
        </Btn>
      </Panel>

      {/* case selector */}
      {cases.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {cases.map((cc) => (
            <button key={cc.id} type="button" onClick={() => dispatch({ type: "SET_CASE", caseId: cc.id })}
              className={`flex items-center gap-1.5 border px-2 py-1 font-mono text-[10.5px] transition-colors ${
                cc.id === c.id ? "border-teal/60 bg-teal/[0.07] text-hi" : "border-line bg-ink-900/70 text-low hover:text-mid"
              }`}>
              {cc.id} · {state.vessels.find((v) => v.id === cc.vesselId)?.name}
              <StateChip state={cc.state} />
            </button>
          ))}
        </div>
      )}

      {/* case header + state rail */}
      <Panel
        title={<span>{c.id} · {vessel?.name ?? c.vesselId}</span>}
        right={
          <>
            <Chip tone="dim">detected {fmtUTC(c.disruption.detectedAt)}</Chip>
            <StateChip state={c.state} />
          </>
        }
        bodyClass="p-2.5"
      >
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-steel">{c.disruption.type.replace("_", " ")}</span>
          <span className="font-mono text-[10.5px] text-mid">{c.disruption.summary}</span>
        </div>

        {/* transition chain */}
        <div className="mt-2.5 flex flex-wrap items-center gap-y-1.5">
          {CHAIN.map((st, i) => {
            const isCurrent = c.state === st;
            const done = reached.has(st) && !isCurrent;
            return (
              <span key={st} className="flex items-center">
                <span className={`flex items-center gap-1 border px-1.5 py-[3px] font-mono text-[9px] uppercase tracking-[0.12em] transition-all duration-300 ${
                  isCurrent ? "border-teal bg-teal/15 text-teal shadow-[0_0_12px_rgba(63,216,180,0.25)]"
                  : done ? "border-line bg-ink-850 text-mid"
                  : "border-line-soft text-low/60"
                }`}>
                  <span className={isCurrent ? "text-teal" : done ? "text-teal" : ""}>{done ? "✓" : String(i + 1).padStart(2, "0")}</span>
                  {CHAIN_LABEL[st]}
                </span>
                {i < CHAIN.length - 1 && <span className={`px-[3px] font-mono text-[10px] ${done || isCurrent ? "text-teal/70" : "text-line"}`}>▸</span>}
              </span>
            );
          })}
          {EXCEPTIONS.includes(c.state) && (
            <span className="ml-2 animate-rise flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-line">⇢ exception:</span>
              <StateChip state={c.state} />
            </span>
          )}
        </div>

        {/* canonical vessel-side state */}
        <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-line-soft pt-2">
          {Object.entries(c.vesselFields).map(([k, v]) => (
            <div key={k} className="bg-ink-950/60 px-2 py-1">
              <div className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-low">{k === "eta" ? "ETA (vessel-side)" : k === "dest" ? "Destination" : "SOG plan"}</div>
              <div className="font-mono text-[11px] text-teal">{k === "eta" ? v.replace("T", " ").replace("Z", "Z") : v}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* action gate */}
      <ActionGate caseId={c.id} />

      {/* evidence row */}
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <EventFeed />
        <ContextPanel caseId={c.id} />
      </div>

      <OptionsBoard caseId={c.id} />

      {/* timeline */}
      <Panel title="Case timeline · audited transitions" bodyClass="max-h-[180px] overflow-y-auto scroll-slim" className="shrink-0">
        {[...c.timeline].reverse().map((t, i) => (
          <div key={i} className="flex items-center gap-2 border-b border-b-line-soft px-2.5 py-1">
            <span className="w-[62px] shrink-0 font-mono text-[9.5px] text-low">{fmtUTC(t.at)}</span>
            <StateChip state={t.state} />
            <span className="font-mono text-[9.5px] uppercase tracking-wider text-steel">{t.by}</span>
            {t.note && <span className="truncate font-mono text-[9.5px] text-low">{t.note}</span>}
          </div>
        ))}
      </Panel>
      <div className="h-1 shrink-0" data-now={now} />
    </div>
  );
}

// ---------------------------------------------------------------- action gate

function ActionGate({ caseId }: { caseId: string }) {
  const { state, dispatch } = useOrchestrator();
  const c = state.cases[caseId];
  if (!c) return null;
  const roleLabel = ROLE_LABELS[state.role];
  const selected = c.options.find((o) => o.id === c.selectedOptionId);

  let body: React.ReactNode = null;

  if (c.state === "DisruptionDetected") {
    body = (
      <GateShell tone="cyan" title="Gate · context assembly (FR-02)">
        <p>The solver refuses to run without material evidence. Assemble port, cargo, weather, crew and telemetry context with full freshness stamps.</p>
        <Btn tone="cyan" onClick={() => dispatch({ type: "ASSEMBLE", caseId })}><Icon name="radar" size={12} /> Assemble context · as {roleLabel}</Btn>
      </GateShell>
    );
  } else if (c.state === "ImpactAssessed") {
    body = (
      <GateShell tone="cyan" title="Gate · deterministic solver (FR-03)">
        <p>Run the O2 constraint engine. Safety, crew and maintenance constraints override commercial value; missing material evidence forces abstention.</p>
        <div className="flex gap-1.5">
          <Btn tone="cyan" onClick={() => dispatch({ type: "GENERATE", caseId })}><Icon name="layers" size={12} /> Generate options · as {roleLabel}</Btn>
          <Btn tone="dim" onClick={() => dispatch({ type: "ASSEMBLE", caseId })}>Refresh context</Btn>
        </div>
      </GateShell>
    );
  } else if (c.state === "RecoveryOptionGenerated") {
    body = (
      <GateShell tone="teal" title="Gate · Master approval (FR-04)">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[220px] flex-1">
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-low">Staged option</div>
            <div className="font-display text-[15px] font-semibold text-hi">
              {selected ? `${selected.id} — ${selected.label}` : "Select a feasible option above"}
            </div>
            {selected && (
              <div className="mt-1 flex flex-wrap gap-1">
                {selected.evidenceRefs.map((r) => <Chip key={r} tone="cyan" className="!text-[8.5px]">{r}</Chip>)}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Btn tone="teal" disabled={!selected} onClick={() => selected && dispatch({ type: "APPROVE", caseId, optionId: selected.id })}
              title="Only the Master may approve. Any other role triggers SecurityViolationRaised (GS-07).">
              <Icon name="shield" size={12} /> Approve · as {roleLabel}
            </Btn>
            <Btn tone="steel" disabled={!selected} onClick={() => selected && dispatch({ type: "REJECT", caseId, optionId: selected.id })}>
              <Icon name="x" size={12} /> Reject
            </Btn>
          </div>
        </div>
        <p className="mt-1.5 font-mono text-[9px] text-low">
          Approval authority is non-delegable. A non-Master attempt is blocked, frozen and audited — try it with the role switcher (GS-07).
        </p>
      </GateShell>
    );
  } else if (c.state === "Blocked") {
    body = (
      <GateShell tone="red" title="Case frozen · SecurityViolationRaised (NFR-02)">
        <p>
          <span className="text-red">{c.violation?.actor}</span> attempted <span className="text-red">{c.violation?.attempted}</span> at {c.violation ? fmtUTC(c.violation.at) : "—"}.
          Execution halted, P1 trigger condition logged. Only Safety &amp; Compliance may roll the case back to its last safe state.
        </p>
        <Btn tone="red" onClick={() => dispatch({ type: "CLEAR_VIOLATION", caseId })}>
          <Icon name="shield" size={12} /> Safety rollback · as {roleLabel}
        </Btn>
      </GateShell>
    );
  } else if (c.state === "Abstention") {
    body = (
      <GateShell tone="amber" title="Abstention · option generation withheld (FR-03)">
        <p>{c.abstain?.reason} Manual fallback is in effect — see the checklist in the options board, then re-assemble context when material evidence is restored.</p>
        <div className="flex gap-1.5">
          <Btn tone="amber" onClick={() => dispatch({ type: "ASSEMBLE", caseId })}><Icon name="radar" size={12} /> Re-assemble context</Btn>
          <Btn tone="dim" onClick={() => dispatch({ type: "GENERATE", caseId })}>Re-run solver</Btn>
        </div>
      </GateShell>
    );
  } else if (c.state === "MasterApprovalRecorded") {
    body = (
      <GateShell tone="teal" title="Gate · controlled execution">
        <p>Master approval recorded at {c.approval ? fmtUTC(c.approval.at) : "—"}. The deterministic executor may now commit — before/after state will be written to the audit trail.</p>
        <Btn tone="teal" onClick={() => dispatch({ type: "COMMIT", caseId })}><Icon name="zap" size={12} /> Commit action · as {roleLabel}</Btn>
      </GateShell>
    );
  } else if (c.state === "RecoveryActionCommitted") {
    body = (
      <GateShell tone="teal" title="Gate · replan publication">
        <p>Action committed under approval. Publish the revised voyage plan to vessel and FOC.</p>
        <Btn tone="cyan" onClick={() => dispatch({ type: "PUBLISH", caseId })}><Icon name="book" size={12} /> Publish replanned voyage · as {roleLabel}</Btn>
      </GateShell>
    );
  } else if (c.state === "VoyageReplanned") {
    body = (
      <GateShell tone="teal" title="Gate · steady-state confirmation">
        <p>Replanned voyage lodged. Confirm steady state to close the case — the full transition chain stays reconstructible from the audit trail (GS-11).</p>
        <Btn tone="teal" onClick={() => dispatch({ type: "CLOSE", caseId })}><Icon name="check" size={12} /> Close case · as {roleLabel}</Btn>
      </GateShell>
    );
  } else if (c.state === "OfflineFallback") {
    body = (
      <GateShell tone="amber" title="OfflineFallback · essential continuity (FR-05, NFR-01)">
        <p>Shore link down. The deterministic core continues on vessel-edge cached evidence; the O3 advisory layer is unavailable. State transitions pause for shore sync but the recovery workflow proceeds.</p>
        <div className="flex gap-1.5">
          {!c.context
            ? <Btn tone="amber" onClick={() => dispatch({ type: "ASSEMBLE", caseId })}><Icon name="radar" size={12} /> Assemble from edge cache</Btn>
            : <Btn tone="amber" onClick={() => dispatch({ type: "GENERATE", caseId })}><Icon name="layers" size={12} /> Generate options offline</Btn>}
          <Btn tone="teal" onClick={() => dispatch({ type: "CONNECTIVITY", online: true })}><Icon name="link" size={12} /> Restore link</Btn>
        </div>
      </GateShell>
    );
  } else if (c.state === "ReconciliationPending") {
    body = (
      <GateShell tone="red" title="Reconciliation · vessel/shore divergence (FR-05)">
        <p>No silent overwrites. Resolve each divergent field explicitly; the choice and before/after values are written to the audit trail.</p>
        <div className="mt-1 space-y-1.5">
          {c.shoreEdits.filter((d) => !d.resolvedTo).map((d) => (
            <div key={d.field} className="flex flex-wrap items-center gap-2 border border-red/35 bg-red/[0.05] p-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-red">{d.field}</span>
              <span className="font-mono text-[10px] text-mid">vessel <span className="text-teal">{d.vesselValue.replace("T", " ")}</span></span>
              <span className="font-mono text-[10px] text-mid">shore <span className="text-amber">{d.shoreValue.replace("T", " ")}</span></span>
              <span className="ml-auto flex gap-1.5">
                <Btn tone="teal" onClick={() => dispatch({ type: "RESOLVE", caseId, field: d.field, to: "vessel" })}>Take vessel</Btn>
                <Btn tone="amber" onClick={() => dispatch({ type: "RESOLVE", caseId, field: d.field, to: "shore" })}>Take shore</Btn>
              </span>
            </div>
          ))}
          {c.shoreEdits.filter((d) => !d.resolvedTo).length === 0 && (
            <p className="font-mono text-[10px] text-low">All fields resolved — restoring link resumes the case.</p>
          )}
        </div>
      </GateShell>
    );
  } else if (c.state === "Nominal") {
    body = (
      <GateShell tone="teal" title="Case closed · voyage nominal">
        <p>Full chain audited: disruption → impact → options → Master approval → commit → replan → nominal. Inject a new event or reset the workshop to run another scenario.</p>
      </GateShell>
    );
  }

  return body;
}

function GateShell({ tone, title, children }: { tone: "teal" | "cyan" | "amber" | "red"; title: string; children: React.ReactNode }) {
  const border = { teal: "border-teal/45", cyan: "border-cyan/45", amber: "border-amber/50", red: "border-red/55" }[tone];
  const text = { teal: "text-teal", cyan: "text-cyan", amber: "text-amber", red: "text-red" }[tone];
  return (
    <section className={`animate-rise border ${border} bg-ink-900/85 p-2.5`}>
      <h4 className={`font-display text-[14px] font-semibold uppercase tracking-[0.22em] ${text}`}>{title}</h4>
      <div className="mt-1.5 space-y-1.5 [&_p]:font-mono [&_p]:text-[10px] [&_p]:leading-relaxed [&_p]:text-mid">{children}</div>
    </section>
  );
}
