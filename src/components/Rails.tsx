import { useState } from "react";
import { useOrchestrator } from "../store";
import { Btn, Chip, Icon, Meter, Panel, StatusDot, fmtAgo, fmtDur, fmtUTC, useNow } from "./atoms";
import type { Tone } from "./atoms";
import { BUDGETS, VERSIONS } from "../domain/policy";
import type { AuditEntry, Vessel } from "../domain/types";

const VESSEL_TONE: Record<Vessel["status"], Tone> = {
  nominal: "teal", disruption: "red", offline: "amber", recovery: "cyan",
};

// ---------------------------------------------------------------- fleet board

export function FleetRail() {
  const { state, dispatch } = useOrchestrator();
  const now = useNow(15000);

  return (
    <aside className="flex w-[248px] shrink-0 flex-col gap-2 overflow-y-auto border-r border-line bg-ink-900/60 p-2 scroll-slim">
      {/* radar */}
      <div className="relative mx-auto aspect-square w-[210px]">
        <div className="absolute inset-0 rounded-full border border-line bg-ink-950/80" />
        <div className="absolute inset-[18%] rounded-full border border-line-soft" />
        <div className="absolute inset-[36%] rounded-full border border-line-soft" />
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-line-soft" />
        <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-line-soft" />
        <div className="radar-sweep absolute inset-0 animate-sweep rounded-full" />
        {state.vessels.map((v) => {
          const tone = VESSEL_TONE[v.status];
          const dot: Record<Tone, string> = {
            teal: "bg-teal", cyan: "bg-cyan", amber: "bg-amber", red: "bg-red", steel: "bg-steel", dim: "bg-low",
          };
          return (
            <div key={v.id} className="absolute" style={{ left: `${v.blip.x}%`, top: `${v.blip.y}%` }} title={`${v.name} · ${v.position}`}>
              {v.status === "disruption" && <span className="absolute -inset-2 rounded-full border border-red/60 animate-ping-ring" />}
              <span className={`relative block h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full ${dot[tone]} ${v.status === "offline" ? "animate-blink" : ""}`} />
              <span className="absolute left-2 top-[-5px] whitespace-nowrap font-mono text-[8.5px] tracking-wider text-low">{v.id}</span>
            </div>
          );
        })}
        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 font-mono text-[8px] uppercase tracking-[0.2em] text-low">sector scan · 12 nm</span>
      </div>

      {/* vessel cards */}
      {state.vessels.map((v) => {
        const c = v.caseId ? state.cases[v.caseId] : undefined;
        const active = c?.id === state.activeCaseId;
        const spoolCount = state.spool.filter((e) => e.vesselId === v.id).length;
        return (
          <button
            key={v.id} type="button"
            onClick={() => { if (c) { dispatch({ type: "SET_CASE", caseId: c.id }); dispatch({ type: "VIEW", view: "operations" }); } }}
            className={`group border p-2 text-left transition-colors ${active ? "border-teal/60 bg-teal/[0.06]" : "border-line bg-ink-850/70 hover:border-steel/40"} ${c ? "" : "cursor-default"}`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="font-display text-[14px] font-semibold uppercase tracking-[0.1em] text-hi group-hover:text-teal">{v.name}</span>
              <StatusDot tone={VESSEL_TONE[v.status]} pulse={v.status === "disruption"} />
            </div>
            <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-low">{v.kind} · {v.imo}</div>
            <div className="mt-1 font-mono text-[9.5px] text-mid">{v.route}</div>
            <div className="mt-1 flex items-center gap-1.5">
              <Chip tone={VESSEL_TONE[v.status]}>{v.status}</Chip>
              {c && <Chip tone="dim">{c.id}</Chip>}
              {spoolCount > 0 && <Chip tone="amber">{spoolCount} spooled</Chip>}
            </div>
            <div className="mt-1 font-mono text-[9px] text-low">
              SOG {v.sogKn} kn · HDG {String(v.hdg).padStart(3, "0")}° · draft {v.draftM} m
            </div>
          </button>
        );
      })}

      <div className="mt-auto border border-line-soft bg-ink-950/60 p-2 font-mono text-[9px] leading-relaxed text-low">
        <span className="text-steel">OFFLINE SPOOL</span> — {state.spool.length} event(s) at vessel edge
        {state.spool.length > 0 && <span className="text-amber"> · syncs on reconnect</span>}
        <br />
        <span className="text-steel">BLACKOUT</span> — {state.blackouts.filter((b) => b.end === null).length > 0
          ? `active ${fmtDur((now - (state.blackouts.find((b) => b.end === null)?.start ?? now)) / 60000)}`
          : `${state.blackouts.length} recorded (9.6% of fleet > 60 min baseline)`}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------- audit / cost / alerts

const SEV_BORDER: Record<AuditEntry["severity"], string> = {
  info: "border-l-line", ok: "border-l-teal/60", warn: "border-l-amber/70", violation: "border-l-red",
};
const SEV_TEXT: Record<AuditEntry["severity"], string> = {
  info: "text-mid", ok: "text-teal", warn: "text-amber", violation: "text-red",
};

export function AuditRail() {
  const { state } = useOrchestrator();
  const [tab, setTab] = useState<"audit" | "cost" | "alerts">("audit");
  const [openId, setOpenId] = useState<number | null>(null);
  const now = useNow(15000);

  const entries = [...state.audit].reverse();
  const alerts = buildAlerts(state, now);

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-line bg-ink-900/60">
      <div className="flex shrink-0 border-b border-line">
        {(["audit", "cost", "alerts"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`flex-1 border-r border-line-soft py-2 font-display text-[12px] font-semibold uppercase tracking-[0.22em] last:border-r-0 ${tab === t ? "bg-ink-800 text-teal" : "text-low hover:text-mid"}`}>
            {t === "audit" ? `Audit · ${state.audit.length}` : t === "cost" ? "Cost" : `Alerts · ${alerts.length}`}
          </button>
        ))}
      </div>

      {tab === "audit" && (
        <div className="min-h-0 flex-1 overflow-y-auto scroll-slim">
          {entries.map((a) => (
            <button key={a.id} type="button" onClick={() => setOpenId(openId === a.id ? null : a.id)}
              className={`block w-full border-b border-b-line-soft border-l-2 px-2.5 py-1.5 text-left transition-colors hover:bg-ink-850 ${SEV_BORDER[a.severity]}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`font-mono text-[10.5px] tracking-wide ${SEV_TEXT[a.severity]}`}>{a.action}</span>
                <span className="font-mono text-[9px] text-low">{fmtUTC(a.at)}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[9px] text-low">
                <span className="uppercase tracking-wider text-steel">{a.actor}</span>
                {a.caseId && <span>· {a.caseId}</span>}
                {a.severity === "violation" && <Chip tone="red" className="!text-[8.5px]">P1 trigger</Chip>}
              </div>
              {openId === a.id && (
                <div className="mt-1.5 animate-rise space-y-1.5">
                  <p className="font-mono text-[10px] leading-relaxed text-mid">{a.detail}</p>
                  {a.evidenceRefs.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {a.evidenceRefs.map((r) => <Chip key={r} tone="cyan" className="!text-[8.5px]">{r}</Chip>)}
                    </div>
                  )}
                  {a.beforeAfter && a.beforeAfter.length > 0 && (
                    <div className="border border-line-soft bg-ink-950/70 p-1.5 font-mono text-[9.5px]">
                      {a.beforeAfter.map((b) => (
                        <div key={b.field} className="flex gap-1">
                          <span className="text-steel">{b.field}:</span>
                          <span className="text-low line-through">{b.before}</span>
                          <span className="text-low">→</span>
                          <span className="text-teal">{b.after}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="font-mono text-[8.5px] text-low">
                    engine {a.versions.engine} · policy {a.versions.policy} · dataset {a.versions.dataset}
                    {a.versions.model && <> · model {a.versions.model}</>}
                    {a.versions.prompt && <> · prompt {a.versions.prompt}</>}
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {tab === "cost" && (
        <div className="space-y-3 overflow-y-auto p-3 scroll-slim">
          <div>
            <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-wider text-low">
              <span>Satellite bandwidth</span><span className="text-mid">{state.cost.satKb.toFixed(0)} / {BUDGETS.satKbDay} KB</span>
            </div>
            <Meter value={state.cost.satKb} max={BUDGETS.satKbDay} tone={state.cost.satKb / BUDGETS.satKbDay > 0.8 ? "amber" : "teal"} />
          </div>
          <div>
            <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-wider text-low">
              <span>AI compute (O3)</span><span className="text-mid">{state.cost.aiTokens.toLocaleString()} / {BUDGETS.aiTokensDay.toLocaleString()} tok</span>
            </div>
            <Meter value={state.cost.aiTokens} max={BUDGETS.aiTokensDay} tone={state.cost.aiTokens / BUDGETS.aiTokensDay > 0.8 ? "amber" : "cyan"} />
          </div>
          <div className="border border-line-soft bg-ink-950/60 p-2 font-mono text-[9.5px] leading-relaxed text-low">
            <div className="flex justify-between"><span className="text-steel">ADVISORY LAYER</span><span className={state.advisoryEnabled ? "text-cyan" : "text-red"}>{state.advisoryEnabled ? "ARMED" : "KILLED"}</span></div>
            <div className="flex justify-between"><span className="text-steel">LINK</span><span className={state.connectivity === "online" ? "text-teal" : "text-amber"}>{state.connectivity.toUpperCase()}</span></div>
            <div className="flex justify-between"><span className="text-steel">API RETRIES</span><span>{state.metrics.retries}</span></div>
            <div className="mt-1.5 text-low">Advisory auto-disables if the token ceiling is breached (NFR-05). Deterministic core is never throttled.</div>
          </div>
          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-low">Blackout log</div>
            {state.blackouts.length === 0 && <div className="font-mono text-[9.5px] text-low">none recorded</div>}
            {state.blackouts.map((b, i) => (
              <div key={i} className="mb-1 flex justify-between border border-line-soft bg-ink-950/60 px-2 py-1 font-mono text-[9.5px]">
                <span className="text-mid">{fmtUTC(b.start)} → {b.end ? fmtUTC(b.end) : "ongoing"}</span>
                <span className={b.end ? "text-low" : "text-amber animate-blink"}>{b.end ? fmtDur((b.end - b.start) / 60000) : "active"}</span>
              </div>
            ))}
          </div>
          <div className="font-mono text-[8.5px] text-low">Pinned: engine {VERSIONS.engine} · app {VERSIONS.app}</div>
        </div>
      )}

      {tab === "alerts" && (
        <div className="min-h-0 flex-1 overflow-y-auto p-2 scroll-slim">
          {alerts.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Icon name="check" size={22} className="text-teal" />
              <div className="font-mono text-[10.5px] uppercase tracking-wider text-low">No active alerts — fleet nominal</div>
            </div>
          )}
          {alerts.map((al, i) => (
            <div key={i} className={`animate-rise mb-1.5 border-l-2 p-2 ${al.tone === "red" ? "border-l-red bg-red/[0.06]" : "border-l-amber bg-amber/[0.05]"}`}>
              <div className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider ${al.tone === "red" ? "text-red" : "text-amber"}`}>
                <Icon name="alert" size={12} /> {al.title}
              </div>
              <div className="mt-0.5 font-mono text-[9.5px] leading-relaxed text-mid">{al.body}</div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function buildAlerts(state: ReturnType<typeof useOrchestrator>["state"], now: number) {
  const alerts: { tone: "red" | "amber"; title: string; body: string }[] = [];
  if (state.connectivity === "offline" && state.offlineSince) {
    alerts.push({ tone: "amber", title: "Satellite blackout active", body: `Link down ${fmtAgo(state.offlineSince, now)} — OfflineFallback engaged, edge spool ${state.spool.length} event(s), O3 advisory unavailable.` });
  }
  for (const c of Object.values(state.cases)) {
    if (c.state === "Blocked") alerts.push({ tone: "red", title: `${c.id} frozen — violation`, body: `${c.violation?.actor} attempted ${c.violation?.attempted}. SecurityViolationRaised logged; Safety & Compliance rollback available.` });
    if (c.state === "ReconciliationPending") alerts.push({ tone: "red", title: `${c.id} divergence`, body: `${c.shoreEdits.filter((e) => !e.resolvedTo).length} field(s) await manual vessel/shore resolution — no silent overwrite.` });
    if (c.state === "Abstention" && c.abstain) alerts.push({ tone: "amber", title: `${c.id} abstention`, body: `${c.abstain.code} — ${c.abstain.reason}` });
    if (c.commercialOptBlocked) alerts.push({ tone: "amber", title: `${c.id} stale material`, body: c.commercialOptBlocked });
    for (const w of c.context?.warnings.filter((x) => x.includes("UNAVAILABLE") || x.includes("Conflicting")) ?? []) {
      alerts.push({ tone: "amber", title: `${c.id} source gate`, body: w });
    }
  }
  return alerts;
}
