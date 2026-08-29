import { useState } from "react";
import { runGoldenSet } from "../domain/goldenSet";
import type { GoldenSummary } from "../domain/types";
import { Btn, Chip, Icon, Panel, fmtDur } from "./atoms";

export default function VerificationView() {
  const [summary, setSummary] = useState<GoldenSummary>(() => runGoldenSet());
  const [runId, setRunId] = useState(1);

  const m = summary.metrics;
  const metricRows: { metric: string; threshold: string; observed: string; pass: boolean }[] = [
    { metric: "Duplicate operational actions from replay", threshold: "= 0 · FR-01", observed: String(m.dupOperationalActions), pass: m.dupOperationalActions === 0 },
    { metric: "Successful unauthorized actions", threshold: "= 0 · NFR-02", observed: String(m.unauthorizedSuccess), pass: m.unauthorizedSuccess === 0 },
    { metric: "Unauthorized attempts detected & blocked", threshold: "100% blocked", observed: `${m.unauthorizedAttempts} blocked`, pass: m.unauthorizedAttempts >= 1 },
    { metric: "Essential workflow through shore outage", threshold: "100% pass · NFR-01", observed: `${m.offlineEssentialRuns} runs / ${m.offlineEssentialFailures} failures`, pass: m.offlineEssentialFailures === 0 },
    { metric: "Audit provenance completeness", threshold: "100% · NFR-04", observed: `${m.provenancePct}%`, pass: m.provenancePct === 100 },
    { metric: "Malformed inputs rejected without corruption", threshold: "all · GS-12", observed: `${m.rejectedInputs} rejected safely`, pass: m.rejectedInputs === 3 },
    { metric: "Correct abstentions (no fabricated options)", threshold: "GS-03 / 06 / 09", observed: `${m.abstentions} abstentions`, pass: m.abstentions >= 3 },
    { metric: "Disruption → recovery plan, median", threshold: "target* < 30 min", observed: m.medianPlanMin !== null ? fmtDur(m.medianPlanMin) : "—", pass: m.medianPlanMin !== null && m.medianPlanMin < 30 },
    { metric: "Disruption → recovery plan, P90", threshold: "target* < 45 min", observed: m.p90PlanMin !== null ? fmtDur(m.p90PlanMin) : "—", pass: m.p90PlanMin !== null && m.p90PlanMin < 45 },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 scroll-slim">
      {/* verdict banner */}
      <div className={`animate-rise flex flex-wrap items-center gap-3 border p-3 ${summary.allPass ? "border-teal/50 bg-teal/[0.06]" : "border-red/60 bg-red/[0.07]"}`}>
        <span className={summary.allPass ? "text-teal" : "text-red"}>
          <Icon name={summary.allPass ? "check" : "x"} size={26} />
        </span>
        <div>
          <div className={`font-display text-[22px] font-bold uppercase leading-none tracking-[0.18em] ${summary.allPass ? "text-teal" : "text-red"}`}>
            {summary.allPass ? "Golden set · all hard controls hold" : "Golden set · control failure"}
          </div>
          <div className="mt-1 font-mono text-[10.5px] text-mid">
            {summary.scenarios.filter((s) => s.pass).length}/{summary.scenarios.length} scenarios pass · {summary.suite} · dataset {summary.dataset} · run #{runId} — executed in this browser session
          </div>
        </div>
        <div className="ml-auto">
          <Btn tone={summary.allPass ? "teal" : "red"} onClick={() => { setSummary(runGoldenSet()); setRunId((r) => r + 1); }}>
            <Icon name="zap" size={12} /> Re-run suite
          </Btn>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-5">
        {/* metrics vs thresholds */}
        <Panel title="Metrics vs thresholds" className="xl:col-span-2" bodyClass="overflow-y-auto scroll-slim">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line font-mono text-[9px] uppercase tracking-[0.14em] text-low">
                <th className="px-2 py-1.5 text-left">Metric</th>
                <th className="px-2 py-1.5 text-left">Threshold</th>
                <th className="px-2 py-1.5 text-left">Observed</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {metricRows.map((r) => (
                <tr key={r.metric} className="border-b border-b-line-soft hover:bg-ink-850/60">
                  <td className="px-2 py-1.5 font-mono text-[10px] text-mid">{r.metric}</td>
                  <td className="px-2 py-1.5 font-mono text-[9.5px] text-low">{r.threshold}</td>
                  <td className={`px-2 py-1.5 font-mono text-[10.5px] font-medium ${r.pass ? "text-teal" : "text-red"}`}>{r.observed}</td>
                  <td className="px-2 py-1.5 text-right">
                    <span className={r.pass ? "text-teal" : "text-red"}><Icon name={r.pass ? "check" : "x"} size={12} /></span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="p-2 font-mono text-[8.5px] leading-relaxed text-low">
            * Exact performance targets, observation window and confidence method remain an OPEN DECISION (sponsor / process owner) — workshop proxies shown.
            Same suite runs headless: <span className="text-steel">npx vitest run</span> → src/domain/goldenSet.test.ts.
          </p>
        </Panel>

        {/* scenario results */}
        <Panel title="Golden scenarios · PRD §9" className="xl:col-span-3" bodyClass="overflow-y-auto scroll-slim">
          {summary.scenarios.map((s) => <ScenarioRow key={s.id} id={s.id} name={s.name} prdRef={s.prdRef} pass={s.pass} checks={s.checks} />)}
        </Panel>
      </div>
    </div>
  );
}

function ScenarioRow({ id, name, prdRef, pass, checks }: {
  id: string; name: string; prdRef: string; pass: boolean;
  checks: { label: string; pass: boolean; detail: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-b-line-soft">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-ink-850/60">
        <span className={`shrink-0 ${pass ? "text-teal" : "text-red"}`}><Icon name={pass ? "check" : "x"} size={14} /></span>
        <span className="w-14 shrink-0 font-mono text-[11px] font-medium text-steel">{id}</span>
        <span className="font-display text-[14px] font-semibold uppercase tracking-[0.08em] text-hi">{name}</span>
        <Chip tone="dim" className="ml-auto !text-[8.5px]">{prdRef}</Chip>
        <Chip tone={pass ? "teal" : "red"}>{checks.filter((c) => c.pass).length}/{checks.length}</Chip>
      </button>
      {open && (
        <div className="animate-rise space-y-1 border-t border-line-soft bg-ink-950/50 px-3 py-2">
          {checks.map((ch) => (
            <div key={ch.label} className="flex items-start gap-2">
              <span className={`mt-[2px] shrink-0 ${ch.pass ? "text-teal" : "text-red"}`}><Icon name={ch.pass ? "check" : "x"} size={11} /></span>
              <div>
                <span className="font-mono text-[10px] text-hi">{ch.label}</span>
                <span className="ml-2 font-mono text-[9.5px] text-low">{ch.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
