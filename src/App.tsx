import { useEffect } from "react";
import { OrchestratorProvider, useOrchestrator } from "./store";
import TopBar from "./components/TopBar";
import { FleetRail, AuditRail } from "./components/Rails";
import OperationsWorkspace from "./components/OperationsWorkspace";
import VerificationView from "./components/VerificationView";
import GovernanceView from "./components/GovernanceView";
import { Icon } from "./components/atoms";
import type { Toast } from "./domain/types";

function ToastItem({ toast }: { toast: Toast }) {
  const { dispatch } = useOrchestrator();
  useEffect(() => {
    const t = window.setTimeout(() => dispatch({ type: "TOAST_DISMISS", id: toast.id }), 4600);
    return () => window.clearTimeout(t);
  }, [toast.id, dispatch]);

  const styles = {
    info: "border-cyan/60 text-cyan",
    ok: "border-teal/60 text-teal",
    warn: "border-amber/60 text-amber",
    violation: "border-red bg-red/[0.12] text-red",
  }[toast.kind];
  const icon = { info: "link", ok: "check", warn: "alert", violation: "shield" }[toast.kind];

  return (
    <div className={`animate-rise pointer-events-auto flex items-start gap-2 border bg-ink-900/95 px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.5)] ${styles}`}>
      <Icon name={icon as never} size={14} className="mt-[1px] shrink-0" />
      <span className="font-mono text-[10.5px] leading-snug text-hi">{toast.text}</span>
      <button type="button" onClick={() => dispatch({ type: "TOAST_DISMISS", id: toast.id })} className="ml-2 text-low hover:text-hi">
        <Icon name="x" size={11} />
      </button>
    </div>
  );
}

function Shell() {
  const { state } = useOrchestrator();
  const offline = state.connectivity === "offline";

  return (
    <div className="chart-bg scanlines relative flex h-screen flex-col overflow-hidden bg-ink-950 text-hi">
      {/* ambient depth contours */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.05]" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
        <path d="M-20 620 C 240 560, 420 700, 700 640 S 1180 560, 1460 640" fill="none" stroke="#59c2f2" strokeWidth="1.4" />
        <path d="M-20 700 C 260 640, 460 780, 740 716 S 1200 640, 1460 724" fill="none" stroke="#59c2f2" strokeWidth="1.1" />
        <path d="M-20 780 C 280 730, 480 850, 760 792 S 1220 724, 1460 800" fill="none" stroke="#59c2f2" strokeWidth="0.9" />
        <path d="M-20 180 C 220 130, 480 240, 720 190 S 1200 120, 1460 200" fill="none" stroke="#3fd8b4" strokeWidth="0.8" />
        <circle cx="1150" cy="230" r="130" fill="none" stroke="#59c2f2" strokeWidth="0.7" strokeDasharray="4 7" />
        <circle cx="300" cy="690" r="90" fill="none" stroke="#59c2f2" strokeWidth="0.7" strokeDasharray="3 8" />
      </svg>

      {/* offline vignette */}
      {offline && <div className="pointer-events-none absolute inset-0 z-30 shadow-[inset_0_0_90px_rgba(245,169,75,0.14)]" />}

      <TopBar />

      <main className="relative z-10 flex min-h-0 flex-1">
        <FleetRail />
        {state.view === "operations" && <OperationsWorkspace />}
        {state.view === "verification" && <VerificationView />}
        {state.view === "governance" && <GovernanceView />}
        <AuditRail />
      </main>

      <footer className="relative z-10 flex h-[26px] shrink-0 items-center gap-4 border-t border-line bg-ink-900/95 px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-low">
        <span className="text-steel">Northwatch FOC · workshop build 0.9.0</span>
        <span className="hidden md:inline">synthetic data — not production evidence</span>
        <span className="hidden lg:inline">O2 deterministic core · O3 advisory optional</span>
        <span className="ml-auto flex items-center gap-1.5">
          {offline ? <span className="text-amber animate-blink">OFFLINE — essential continuity active</span> : <span className="text-teal">ALL SYSTEMS DETERMINISTIC</span>}
        </span>
      </footer>

      {/* toasts */}
      <div className="pointer-events-none absolute bottom-9 right-[312px] z-50 flex w-[340px] flex-col gap-1.5">
        {state.toasts.map((t) => <ToastItem key={t.id} toast={t} />)}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <OrchestratorProvider>
      <Shell />
    </OrchestratorProvider>
  );
}
