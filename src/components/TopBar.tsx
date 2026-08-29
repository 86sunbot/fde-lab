import { useEffect, useState } from "react";
import { useOrchestrator } from "../store";
import { Btn, Chip, Icon } from "./atoms";
import type { Tone } from "./atoms";
import { BUDGETS, ROLE_LABELS, VERSIONS } from "../domain/policy";
import type { Role } from "../domain/types";

const VIEWS = [
  { id: "operations", label: "Operations" },
  { id: "verification", label: "Verification" },
  { id: "governance", label: "Governance" },
] as const;

export default function TopBar() {
  const { state, dispatch } = useOrchestrator();
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const online = state.connectivity === "online";
  const advisoryTone: Tone = !online ? "amber" : state.advisoryEnabled ? "cyan" : "dim";
  const advisoryLabel = !online ? "O3 · offline" : state.advisoryEnabled ? "O3 · armed" : "O3 · killed";
  const satPct = Math.round((state.cost.satKb / BUDGETS.satKbDay) * 100);

  return (
    <header className="relative z-20 flex h-[54px] shrink-0 items-stretch border-b border-line bg-ink-900/95">
      {/* brand */}
      <div className="flex items-center gap-2.5 border-r border-line pl-3 pr-4">
        <span className="flex h-8 w-8 items-center justify-center border border-teal/50 bg-teal/10 text-teal">
          <Icon name="anchor" size={17} />
        </span>
        <div className="leading-none">
          <div className="font-display text-[19px] font-bold uppercase tracking-[0.28em] text-hi">
            North<span className="text-teal">watch</span>
          </div>
          <div className="mt-[3px] font-mono text-[8.5px] uppercase tracking-[0.18em] text-low">
            Fleet disruption · voyage recovery orchestrator
          </div>
        </div>
      </div>

      {/* view tabs */}
      <nav className="flex items-stretch">
        {VIEWS.map((v) => {
          const active = state.view === v.id;
          return (
            <button
              key={v.id} type="button"
              onClick={() => dispatch({ type: "VIEW", view: v.id })}
              className={`relative border-r border-line-soft px-4 font-display text-[13px] font-semibold uppercase tracking-[0.22em] transition-colors ${
                active ? "bg-ink-800 text-teal" : "text-low hover:bg-ink-850 hover:text-mid"
              }`}
            >
              {v.label}
              <span className={`absolute inset-x-0 bottom-0 h-[2px] ${active ? "bg-teal" : "bg-transparent"}`} />
            </button>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2 pr-3">
        <Chip tone="amber" className="hidden lg:inline-flex">Synthetic data · workshop</Chip>

        {/* link toggle */}
        <Btn tone={online ? "teal" : "amber"} onClick={() => dispatch({ type: "CONNECTIVITY", online: !online })}
          title="Toggle satellite link (FR-05)">
          <Icon name={online ? "link" : "linkoff"} size={13} />
          {online ? "Link online" : <span className="animate-blink">Link down</span>}
        </Btn>

        {/* advisory layer */}
        <Btn tone={advisoryTone} onClick={() => dispatch({ type: "ADVISORY_TOGGLE" })} title="O3 advisory kill-switch (PRD §11)">
          <Icon name="spark" size={13} />
          {advisoryLabel}
        </Btn>

        {/* cost visibility */}
        <div className="hidden w-[128px] flex-col gap-[3px] xl:flex" title="Satellite bandwidth used today (NFR-05)">
          <div className="flex justify-between font-mono text-[9px] uppercase tracking-wider text-low">
            <span>SAT {state.cost.satKb.toFixed(0)} KB</span>
            <span className={satPct > 80 ? "text-amber" : ""}>{satPct}%</span>
          </div>
          <div className="h-[4px] border border-line-soft bg-ink-950">
            <div className={`h-full transition-all duration-500 ${satPct > 80 ? "bg-amber" : "bg-teal"}`} style={{ width: `${Math.min(100, satPct)}%` }} />
          </div>
        </div>

        {/* role switcher */}
        <label className="flex items-center gap-1.5 border border-line bg-ink-850 px-2 py-1" title="Active console role — RBAC enforced by the engine (NFR-02)">
          <Icon name="shield" size={13} className="text-steel" />
          <select
            value={state.role}
            onChange={(e) => dispatch({ type: "ROLE", role: e.target.value as Role })}
            className="bg-ink-850 font-mono text-[11px] uppercase tracking-wider text-hi outline-none"
          >
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </label>

        {/* UTC clock */}
        <div className="hidden flex-col items-end leading-none md:flex">
          <span className="font-mono text-[15px] font-medium tracking-wider text-teal">
            {new Date(clock).toISOString().slice(11, 19)}<span className="text-low">Z</span>
          </span>
          <span className="mt-[3px] font-mono text-[8.5px] uppercase tracking-[0.16em] text-low">
            {VERSIONS.engine} · {VERSIONS.dataset}
          </span>
        </div>
      </div>
    </header>
  );
}
