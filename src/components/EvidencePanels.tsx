import { useOrchestrator } from "../store";
import { Btn, Chip, FreshBadge, Icon, LicBadge, Meter, Panel, fmtAgo, fmtDur, fmtUTC, useNow } from "./atoms";
import type { Tone } from "./atoms";
import type { RecoveryOption, SourceSnapshot } from "../domain/types";

// ---------------------------------------------------------------- event feed

export function EventFeed() {
  const { state, dispatch } = useOrchestrator();
  const events = [...state.eventLog].reverse();

  return (
    <Panel
      title="Durable event log"
      right={
        <>
          <Chip tone="teal">{events.length} captured</Chip>
          {state.spool.length > 0 && <Chip tone="amber">{state.spool.length} spooled</Chip>}
          <Chip tone="steel">{state.metrics.dupDropped} dup dropped</Chip>
        </>
      }
      className="h-[248px]"
      bodyClass="overflow-y-auto scroll-slim"
    >
      {events.length === 0 && state.spool.length === 0 && (
        <div className="p-4 font-mono text-[10.5px] text-low">No events yet — inject telemetry from the scenario console.</div>
      )}
      {[...state.spool.map((e) => ({ ...e, spooled: true })), ...events.map((e) => ({ ...e, spooled: false }))].map((e) => (
        <div key={`${e.eventId}-${e.seq}`} className="animate-rise flex items-start gap-2 border-b border-b-line-soft px-2.5 py-1.5 hover:bg-ink-850/60">
          <span className="w-9 shrink-0 pt-[1px] font-mono text-[10px] text-steel">{e.spooled ? "SPOOL" : `#${e.seq}`}</span>
          <span className="w-[62px] shrink-0 pt-[1px] font-mono text-[10px] text-low">{fmtUTC(e.tsReceived)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[10px] font-medium text-hi">{e.vesselId}</span>
              <Chip tone="dim" className="!text-[8.5px]">{e.type.replace("_", " ")}</Chip>
              {e.driftNormalized && <Chip tone="cyan" className="!text-[8.5px]">drift±norm</Chip>}
              {e.spooled && <Chip tone="amber" className="!text-[8.5px]">edge spool</Chip>}
            </div>
            <div className="mt-0.5 truncate font-mono text-[10px] text-mid">{e.summary}</div>
          </div>
        </div>
      ))}
      <div className="flex gap-1.5 p-2">
        <Btn tone="cyan" onClick={() => dispatch({ type: "REPLAY_LAST" })} title="Re-transmit the last event — dedupe must drop it (FR-01)">
          <Icon name="layers" size={12} /> Replay last (dedupe test)
        </Btn>
        <Btn tone="dim" onClick={() => dispatch({ type: "MALFORMED", kind: "novessel" })} title="GS-12: malformed input must be rejected safely">
          <Icon name="alert" size={12} /> Malformed packet
        </Btn>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------- context assembly

export function ContextPanel({ caseId }: { caseId: string }) {
  const { state, dispatch } = useOrchestrator();
  const now = useNow(10000);
  const c = state.cases[caseId];
  const ctx = c?.context;

  if (!c) return null;
  if (!ctx) {
    return (
      <Panel title="Context assembly · FR-02" className="h-[248px]" bodyClass="flex flex-col items-center justify-center gap-3 p-4 text-center">
        <Icon name="radar" size={26} className="text-low" />
        <p className="max-w-[260px] font-mono text-[10.5px] leading-relaxed text-low">
          No assembled context. The solver will not run without material sources — abstain-by-default.
        </p>
        <Btn tone="cyan" onClick={() => dispatch({ type: "ASSEMBLE", caseId })}>
          <Icon name="radar" size={12} /> Assemble context
        </Btn>
      </Panel>
    );
  }

  return (
    <Panel
      title="Context · sources & freshness"
      right={<Chip tone="dim">assembled {fmtAgo(ctx.assembledAt, now)} ago</Chip>}
      className="h-[248px]"
      bodyClass="overflow-y-auto scroll-slim"
    >
      {ctx.warnings.length > 0 && (
        <div className="border-b border-amber/30 bg-amber/[0.06] px-2.5 py-1.5">
          {ctx.warnings.map((w) => (
            <div key={w} className="flex items-start gap-1.5 font-mono text-[9.5px] leading-relaxed text-amber">
              <Icon name="alert" size={11} className="mt-[2px] shrink-0" /> {w}
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5 p-2">
        {ctx.sources.map((s) => (
          <SourceCard key={s.id} s={s} now={now} caseId={caseId} />
        ))}
      </div>
    </Panel>
  );
}

function SourceCard({ s, now, caseId }: { s: SourceSnapshot; now: number; caseId: string }) {
  const { state, dispatch } = useOrchestrator();
  const restricted = s.license === "restricted";
  const grant = restricted ? state.restrictedGrants[caseId]?.[s.id === "cargo" ? "cargo" : "crew"] : undefined;
  const revealed = !restricted || (grant !== undefined && grant !== "denied");

  const borderTone =
    s.status === "unavailable" ? "border-red/50" :
    s.conflict ? "border-red/50" :
    s.status === "stale" ? "border-amber/50" :
    s.status === "cached" ? "border-cyan/40" : "border-line";

  const elapsedPct = s.elapsedMin !== null ? s.elapsedMin / s.staleAfterMin : 1;

  return (
    <div className={`border bg-ink-950/50 p-2 ${borderTone}`}>
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-steel">
          {s.label}{s.critical && <span className="text-amber"> ·critical</span>}
        </span>
        <FreshBadge status={s.status} />
      </div>
      <div className={`mt-1 font-mono text-[10.5px] leading-snug ${s.status === "unavailable" ? "text-red" : s.conflict ? "text-red" : "text-hi"}`}>
        {revealed ? s.headline : "▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮"}
      </div>
      <div className="mt-0.5 font-mono text-[9px] leading-snug text-low">{revealed ? s.detail : "Restricted detail — purpose-limited access gate (NFR-03)."}</div>

      {s.conflict && (
        <div className="mt-1 border border-red/40 bg-red/[0.07] p-1 font-mono text-[9px] text-red">
          CONFLICT — feed {s.conflict.valueA} vs {s.conflict.withLabel} {s.conflict.valueB}. Preserved, never silently resolved.
        </div>
      )}
      {s.note && <div className="mt-1 font-mono text-[9px] text-amber">{s.note}</div>}

      <div className="mt-1.5 flex items-center gap-1.5">
        <LicBadge license={s.license} />
        <span className="font-mono text-[9px] text-low">
          {s.retrievedAt !== null ? `${fmtAgo(s.retrievedAt, now)} old · limit ${Math.round(s.staleAfterMin / 60 * 10) / 10}h` : "no fix received"}
        </span>
      </div>
      {s.retrievedAt !== null && (
        <div className="mt-1">
          <Meter value={elapsedPct} max={1} tone={elapsedPct > 1 ? "red" : elapsedPct > 0.7 ? "amber" : "teal"} />
        </div>
      )}

      {restricted && !revealed && (
        <button type="button" onClick={() => dispatch({ type: "RESTRICTED", caseId, kind: s.id === "cargo" ? "cargo" : "crew" })}
          className="mt-1.5 flex w-full items-center justify-center gap-1 border border-amber/40 bg-amber/10 py-1 font-mono text-[9px] uppercase tracking-wider text-amber transition-colors hover:bg-amber/20">
          <Icon name="lock" size={11} /> Request access (audited)
        </button>
      )}
      {restricted && grant === "denied" && <div className="mt-1.5"><Chip tone="red">Access denied — no purpose basis</Chip></div>}
      {restricted && grant !== undefined && grant !== "denied" && (
        <div className="mt-1.5 border-t border-line-soft pt-1 font-mono text-[8.5px] text-low">
          Granted to <span className="text-steel">{grant.role}</span> · {fmtUTC(grant.at)} · purpose: {grant.purpose}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- options board

const RISK_TONE: Record<RecoveryOption["risk"], Tone> = { low: "teal", medium: "amber", high: "red" };

export function OptionsBoard({ caseId }: { caseId: string }) {
  const { state, dispatch } = useOrchestrator();
  const c = state.cases[caseId];
  if (!c) return null;

  const sorted = [...c.options].sort((a, b) => Number(b.feasible) - Number(a.feasible) || b.recoveryScore - a.recoveryScore);

  return (
    <Panel
      title="Recovery options · O2 deterministic solver"
      right={
        <>
          {c.commercialOptBlocked && <Chip tone="amber">Commercial opt blocked</Chip>}
          <Chip tone="teal">{c.options.filter((o) => o.feasible).length} feasible</Chip>
          <Chip tone="red">{c.options.filter((o) => !o.feasible).length} blocked</Chip>
          <Btn tone="cyan" onClick={() => dispatch({ type: "ADVISORY", caseId })} title="Optional O3 retrieval-grounded advisory (policy-gated)">
            <Icon name="spark" size={12} /> O3 advisory
          </Btn>
        </>
      }
      bodyClass="overflow-y-auto scroll-slim p-2"
      className="min-h-[220px] flex-1"
    >
      {c.abstain && <AbstainBanner code={c.abstain.code} reason={c.abstain.reason} missing={c.abstain.missingSources} caseId={caseId} />}

      {c.commercialOptBlocked && !c.abstain && (
        <div className="mb-2 flex items-start gap-2 border border-amber/40 bg-amber/[0.07] p-2">
          <Icon name="alert" size={14} className="mt-[1px] shrink-0 text-amber" />
          <div className="font-mono text-[10px] leading-relaxed text-amber">{c.commercialOptBlocked}</div>
        </div>
      )}

      {sorted.length === 0 && !c.abstain && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Icon name="layers" size={22} className="text-low" />
          <p className="font-mono text-[10.5px] text-low">No candidates yet — run the deterministic solver from the action gate.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-1.5 xl:grid-cols-2">
        {sorted.map((o, i) => (
          <OptionCard key={o.id} o={o} rank={i + 1} selected={c.selectedOptionId === o.id} caseId={caseId}
            onSelect={() => dispatch({ type: "SELECT", caseId, optionId: o.id })} />
        ))}
      </div>

      {c.advisoryNotes.map((n) => (
        <div key={n.at} className="mt-2 border border-cyan/40 bg-cyan/[0.05] p-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Icon name="spark" size={13} className="text-cyan" />
            <span className="font-display text-[13px] font-semibold uppercase tracking-[0.18em] text-cyan">Advisory note · O3 (optional layer)</span>
            <Chip tone="cyan">confidence {n.confidence}</Chip>
            <Chip tone="dim">{n.model}</Chip>
            <Chip tone="dim">prompt {n.prompt}</Chip>
          </div>
          <p className="mt-1.5 font-mono text-[10.5px] leading-relaxed text-mid">{n.summary}</p>
          <p className="mt-1 border-l-2 border-amber/60 pl-2 font-mono text-[10px] leading-relaxed text-amber">
            UNCERTAINTY — {n.uncertainty}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className="font-mono text-[9px] uppercase tracking-wider text-low">Cites:</span>
            {n.citations.map((ci) => <Chip key={ci} tone="cyan" className="!text-[8.5px]">{ci}</Chip>)}
            <span className="ml-auto font-mono text-[8.5px] uppercase tracking-wider text-low">Labeled advisory · approval still required · no write authority</span>
          </div>
        </div>
      ))}
    </Panel>
  );
}

function AbstainBanner({ code, reason, missing, caseId }: { code: string; reason: string; missing: string[]; caseId: string }) {
  const { dispatch } = useOrchestrator();
  return (
    <div className="mb-2 animate-rise border border-amber/50 bg-amber/[0.07] p-3">
      <div className="flex items-center gap-2">
        <Icon name="alert" size={16} className="text-amber" />
        <span className="font-display text-[16px] font-bold uppercase tracking-[0.2em] text-amber">System abstains · {code.replace(/_/g, " ")}</span>
      </div>
      <p className="mt-1 font-mono text-[10.5px] leading-relaxed text-mid">{reason}</p>
      {missing.length > 0 && (
        <div className="mt-1.5 flex items-center gap-1">
          <span className="font-mono text-[9px] uppercase tracking-wider text-low">Missing:</span>
          {missing.map((m) => <Chip key={m} tone="red">{m}</Chip>)}
        </div>
      )}
      <div className="mt-2 border-t border-amber/25 pt-2">
        <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-amber">Manual fallback checklist</div>
        <ol className="mt-1 list-inside list-decimal font-mono text-[9.5px] leading-relaxed text-mid">
          <li>FOC voice-net to port agent / vessel for primary data</li>
          <li>Master's independent assessment on the bridge</li>
          <li>Manual plan recorded into the case with evidence references</li>
        </ol>
        <div className="mt-2 flex gap-1.5">
          <Btn tone="amber" onClick={() => dispatch({ type: "ASSEMBLE", caseId })}><Icon name="radar" size={12} /> Re-assemble context</Btn>
          <Btn tone="dim" onClick={() => dispatch({ type: "GENERATE", caseId })}>Re-run solver</Btn>
        </div>
      </div>
    </div>
  );
}

function OptionCard({ o, rank, selected, onSelect }: { o: RecoveryOption; rank: number; selected: boolean; onSelect: () => void; caseId: string }) {
  return (
    <button
      type="button" onClick={onSelect} disabled={!o.feasible}
      className={`animate-rise border p-2 text-left transition-all duration-150 ${
        o.feasible
          ? selected ? "border-teal bg-teal/[0.08] shadow-[0_0_0_1px_rgba(63,216,180,0.4)]" : "border-line bg-ink-950/50 hover:border-teal/50"
          : "cursor-not-allowed border-red/30 bg-ink-950/70 opacity-75"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`font-mono text-[10px] ${o.feasible ? "text-teal" : "text-red"}`}>{String(rank).padStart(2, "0")}</span>
        <span className="font-mono text-[10px] text-steel">{o.id}</span>
        {o.advisory && <Chip tone="cyan" className="!text-[8.5px]"><Icon name="spark" size={9} /> advisory</Chip>}
        <span className="ml-auto">
          {o.feasible ? <Chip tone="teal">Feasible</Chip> : <Chip tone="red">Blocked</Chip>}
        </span>
      </div>
      <div className={`mt-1 font-display text-[15px] font-semibold leading-tight tracking-[0.04em] ${o.feasible ? "text-hi" : "text-mid line-through decoration-red/60"}`}>
        {o.label}
      </div>
      <div className="mt-0.5 font-mono text-[9.5px] text-low">{o.summary}</div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9.5px]">
        <span className="text-low">DELAY <span className="text-mid">{fmtDur(o.delayHrs * 60)}</span></span>
        <span className="text-low">COST <span className="text-mid">${(o.costUsd / 1000).toFixed(0)} k</span></span>
        <span className="text-low">RISK <span className={o.risk === "low" ? "text-teal" : o.risk === "medium" ? "text-amber" : "text-red"}>{o.risk.toUpperCase()}</span></span>
        <span className="ml-auto text-low">RVI <span className={`text-[13px] font-semibold ${o.feasible ? "text-teal" : "text-red"}`}>{o.feasible ? o.recoveryScore.toFixed(1) : "—"}</span></span>
      </div>

      <div className="mt-1.5 space-y-[3px] border-t border-line-soft pt-1.5">
        {o.checks.map((ch) => (
          <div key={ch.id} className="flex items-start gap-1.5">
            <span className={`mt-[1px] shrink-0 ${ch.pass === true ? "text-teal" : ch.pass === false ? "text-red" : "text-amber"}`}>
              <Icon name={ch.pass === true ? "check" : ch.pass === false ? "x" : "clock"} size={11} />
            </span>
            <span className="font-mono text-[9px] leading-snug text-mid">
              <span className="text-steel">[{ch.kind}{ch.critical ? "·crit" : ""}·{ch.sourceId}]</span> {ch.detail}
            </span>
          </div>
        ))}
      </div>

      {o.blockedReason && (
        <div className="mt-1.5 border-l-2 border-red/70 pl-1.5 font-mono text-[9px] leading-snug text-red">{o.blockedReason}</div>
      )}

      <div className="mt-1.5 flex flex-wrap gap-1">
        {o.evidenceRefs.map((r) => <Chip key={r} tone="dim" className="!text-[8.5px]">{r}</Chip>)}
      </div>
    </button>
  );
}
